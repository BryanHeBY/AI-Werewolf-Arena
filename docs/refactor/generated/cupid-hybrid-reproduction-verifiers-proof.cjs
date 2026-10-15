/** 核四源冻结字节、旧装配16步完整保留及新增独立算法边界；不加载生产、计算预期或运行类型／行为。 */
const fs = require("node:fs"), path = require("node:path"), crypto = require("node:crypto"), cp = require("node:child_process");
const ts = require(path.join(process.cwd(), "backend/node_modules/typescript"));
const prefix = "docs/refactor/generated/cupid-hybrid-reproduction-verifiers-";
const read = name => JSON.parse(fs.readFileSync(prefix + name, "utf8"));
const sha = value => crypto.createHash("sha256").update(value).digest("hex");
const before = read("before.json"), ready = read("source-ready.json"), edits = read("edits.json");
function check(ok, label) { if (!ok) throw new Error(label); }
function parse(file, text) {
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  check(!source.parseDiagnostics.length, "parse:" + file);
  return source;
}
function program(file, text) {
  const source = parse(file, text), parts = [];
  let typedNodes = 0, nodeArrays = 0, leaves = 0;
  function visit(node) {
    if (node.kind >= ts.SyntaxKind.FirstJSDocNode && node.kind <= ts.SyntaxKind.LastJSDocNode) return;
    typedNodes++; parts.push(node.kind); let children = 0;
    ts.forEachChild(node, child => { children++; visit(child); }, array => {
      nodeArrays++; parts.push(["NodeArray", array.length, !!array.hasTrailingComma]);
      for (const child of array) { children++; visit(child); }
    });
    if (!children) { leaves++; parts.push(["leaf", node.getText(source)]); }
  }
  visit(source);
  return { sha256: sha(JSON.stringify(parts)), typedNodes, nodeArrays, leaves };
}
function protectedTags(file, text) {
  const source = parse(file, text), tags = [];
  function visit(node) {
    for (const doc of node.jsDoc || []) for (const tag of doc.tags || []) tags.push(tag.getText(source));
    ts.forEachChild(node, visit);
  }
  visit(source);
  tags.push(...(text.match(/^.*(?:@ts-(?:expect-error|ignore|nocheck)|eslint-|SPDX-License-Identifier|\/\/\/[ \t]*<reference).*$/gm) || []));
  return tags;
}
const emit = (file, text, module) => ts.transpileModule(text, { fileName: file,
  compilerOptions: { target: ts.ScriptTarget.ES2022, module, removeComments: true } }).outputText;
const current = new Map();
for (const row of ready.source) {
  const text = fs.readFileSync(row.path, "utf8");
  check(sha(text) === row.sha256, "ready_drift:" + row.path);
  current.set(row.path, text);
}
const gitBefore = [];
for (const row of before.source) {
  if (row.expectedAbsent) {
    const result = cp.spawnSync("git", ["cat-file", "-e", before.baseCommit + ":" + row.path]);
    check(result.status === 128, "new_path_not_absent:" + row.path);
    gitBefore.push({ path: row.path, absentAtActualGit: true });
  } else {
    const bytes = cp.execFileSync("git", ["cat-file", "blob", before.baseCommit + ":" + row.path]);
    check(sha(bytes) === row.sha256 && bytes.toString("utf8") === row.text, "actual_git:" + row.path);
    gitBefore.push({ path: row.path, sha256: row.sha256, same: true });
  }
}
const controls = before.controls.map(row => {
  const bytes = cp.execFileSync("git", ["cat-file", "blob", before.baseCommit + ":" + row.path]);
  check(sha(bytes) === row.sha256 && bytes.toString("utf8") === row.text, "control_git:" + row.path);
  const parallel = ready.parallelProducers.find(p => p.path === row.path);
  if (!parallel) check(sha(fs.readFileSync(row.path)) === row.sha256, "control_current:" + row.path);
  return { path: row.path, sha256: row.sha256, actualGitSame: true, currentImmutableCompared: !parallel,
    ...(parallel ? { limit: parallel.scope } : { currentSame: true }) };
});
const traceBefore = read("trace-outcome-before.json"), traceEdits = read("trace-outcome-edits.json");
const precheckDelta = traceEdits.source.map(row => {
  const old = traceBefore.source.find(p => p.path === row.path), edit = row.edit;
  check(sha(old.text) === row.beforeSHA256, "precheck_before:" + row.path);
  check(old.text.slice(edit.offset, edit.offset + edit.before.length) === edit.before, "precheck_anchor:" + row.path);
  const after = old.text.slice(0, edit.offset) + edit.after + old.text.slice(edit.offset + edit.before.length);
  check(after === current.get(row.path) && sha(after) === row.afterSHA256, "precheck_complete_forward:" + row.path);
  const inverse = after.slice(0, edit.offset) + edit.before + after.slice(edit.offset + edit.after.length);
  check(inverse === old.text, "precheck_complete_inverse:" + row.path);
  return { path: row.path, beforeSHA256: row.beforeSHA256, afterSHA256: row.afterSHA256, exactForwardAndInverse: true,
    policyDelta: "首检查前静态finding修正；新opaque证据政策及字面unit行为确有变化，不称runtime等价。" };
});
const assemblyPath = edits.path, oldAssembly = before.source.find(row => row.path === assemblyPath).text;
let forward = oldAssembly; const steps = [];
for (const edit of edits.edits) {
  const offset = forward.indexOf(edit.before);
  check(offset >= 0 && forward.indexOf(edit.before, offset + 1) < 0, "forward_anchor:" + edit.label);
  forward = forward.slice(0, offset) + edit.after + forward.slice(offset + edit.before.length);
  steps.push({ ...edit, offset });
}
check(forward === current.get(assemblyPath), "complete_assembly_forward");
let inverse = forward;
for (const edit of [...steps].reverse()) {
  check(inverse.slice(edit.offset, edit.offset + edit.after.length) === edit.after, "inverse_anchor:" + edit.label);
  inverse = inverse.slice(0, edit.offset) + edit.before + inverse.slice(edit.offset + edit.after.length);
}
check(inverse === oldAssembly, "complete_assembly_inverse");
check(program(assemblyPath, inverse).sha256 === program(assemblyPath, oldAssembly).sha256, "complete_assembly_program");
check(JSON.stringify(protectedTags(assemblyPath, oldAssembly)) === JSON.stringify(protectedTags(assemblyPath, forward)), "assembly_protected_tags");
const oldFile = parse(assemblyPath, oldAssembly), newFile = parse(assemblyPath, forward);
const entry = file => file.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === "verifyReproductionMechanisms");
const oldEntry = entry(oldFile), newEntry = entry(newFile);
check(oldEntry.body.statements.length === 16 && newEntry.body.statements.length === 18, "actual_fixed_16_plus_2");
const oldStatements = [...oldEntry.body.statements].map(node => node.getText(oldFile));
check(JSON.stringify(oldStatements) === JSON.stringify([...newEntry.body.statements].slice(0, 16).map(node => node.getText(newFile))), "original_16_whole_statement_bytes");
const tail = [...newEntry.body.statements].slice(16).map(node => node.getText(newFile));
check(JSON.stringify(tail) === JSON.stringify(["validateCupidRecord(result);", "validateHybridRecord(result);"]), "last_two_order");
const inverseOutputs = [ts.ModuleKind.ESNext, ts.ModuleKind.CommonJS].map(module => {
  const old = emit(assemblyPath, oldAssembly, module), restored = emit(assemblyPath, inverse, module);
  check(old === restored, "assembly_whole_inverse_emit:" + module);
  return { module, beforeSHA256: sha(old), inverseSHA256: sha(restored), same: true,
    actualCurrentSame: emit(assemblyPath, forward, module) === old };
});
const owners = [];
for (const [file, endpoint, factModule] of [
  ["backend/src/verification/reproduction/cupid.ts", "validateCupidRecord", "@ai-werewolf-arena/game-contract/facts/cupid"],
  ["backend/src/verification/reproduction/hybrid.ts", "validateHybridRecord", "@ai-werewolf-arena/game-contract/facts/hybrid"],
]) {
  const source = parse(file, current.get(file));
  const imports = source.statements.filter(ts.isImportDeclaration).map(node => ({
    specifier: node.moduleSpecifier.text, typeOnly: !!node.importClause?.isTypeOnly,
  }));
  for (const row of imports) check(row.typeOnly
    ? row.specifier === "../../recording/reproduction"
    : ["@ai-werewolf-arena/game-contract", factModule, "@ai-werewolf-arena/replay-contract"].includes(row.specifier), "independent_import_boundary:" + file);
  const exported = source.statements.filter(node => node.modifiers?.some(modifier => modifier.kind === ts.SyntaxKind.ExportKeyword));
  check(exported.length === 1 && ts.isFunctionDeclaration(exported[0]) && exported[0].name.text === endpoint, "one_actual_owner_endpoint:" + file);
  const imported = newFile.statements.find(node => ts.isImportDeclaration(node) && node.moduleSpecifier.text === "./" + path.basename(file, ".ts"));
  check(imported.importClause.namedBindings.elements.some(node => node.name.text === endpoint && (node.propertyName?.text || node.name.text) === endpoint), "same_actual_assembly_endpoint:" + file);
  owners.push({ path: file, endpoint, imports, actualNewAlgorithm: true });
}
const unitPath = "backend/tests/unit/recording/relationship-reproduction-ledgers.test.ts";
const unitFile = parse(unitPath, current.get(unitPath)), unitImports = unitFile.statements.filter(ts.isImportDeclaration).map(node => node.moduleSpecifier.text);
check(!unitImports.some(specifier => /\/game\/|\/core\/|\/rulesets\//.test(specifier)), "unit_does_not_run_production_owner");
const tests = unitFile.statements.filter(node => ts.isExpressionStatement(node) && ts.isCallExpression(node.expression) && node.expression.expression.getText(unitFile) === "test")
  .map(node => node.expression.arguments[0].text);
const programs = ready.source.map(row => ({ ...row, ...program(row.path, current.get(row.path)), protectedTags: protectedTags(row.path, current.get(row.path)),
  outputs: [ts.ModuleKind.ESNext, ts.ModuleKind.CommonJS].map(module => ({ module, sha256: sha(emit(row.path, current.get(row.path), module)) })) }));
const report = { baseCommit: before.baseCommit, sourceReadySHA256: sha(fs.readFileSync(prefix + "source-ready.json")), source: ready.source,
  gitBefore, precheckDelta, exactAssemblyEdits: steps.map(({ label, offset }) => ({ label, offset })), original16WholeStatements: oldStatements,
  tail, assemblyInverseProgram: program(assemblyPath, inverse), inverseOutputs, owners, unitImports, distinctTestDeclarations: tests, programs, controls,
  limits: ["四source包含两新增独立算法与新unit；不把新拒绝政策称原运行程序等价。", "旧assembly16完整语句保持，完整正逆与两emit只证明接线边界；新算法正确性由独立字面测试及非作者源码审判断。", "此脚本只parse/transpile源码和读取公开Git，不运行新verifier、生产结算、类型diagnostics或任何业务。", "Tape没有生命版本/原体ref/租约/逐请求游标；没有全55角色、完整隐私档案或全部死亡因果闭包完成声明。"] };
fs.writeFileSync(prefix + "proof.json", JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify({ source: ready.source.length, originalWholeStatements: oldStatements.length, appended: tail.length, actualNewOwners: owners.length,
  tests: tests.length, controls: controls.length, inverseWholeOutputs: inverseOutputs.length }));
