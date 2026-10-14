/** 只核实际 F02 差分及保留的完整原协议／领域算法；不生成 oracle、不执行产品或重复检查。 */
const fs = require("node:fs"), cp = require("node:child_process"), crypto = require("node:crypto"), assert = require("node:assert/strict"), path = require("node:path");
const ts = require("../../../backend/node_modules/typescript"), prefix = "docs/refactor/generated/request-lease-terminal-revocation-";
const before = JSON.parse(fs.readFileSync(prefix + "before.json")), edits = JSON.parse(fs.readFileSync(prefix + "edits.json"));
const sha = (x) => crypto.createHash("sha256").update(x).digest("hex");
const parse = (file, text) => ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
const emit = (text, module) => ts.transpileModule(text, { compilerOptions: { target: ts.ScriptTarget.ES2022, module, removeComments: true } }).outputText;
const modules = [ts.ModuleKind.ESNext, ts.ModuleKind.CommonJS];
let typedComparisons = 0, leaves = 0;
function tree(node, source) {
  if (node.kind >= ts.SyntaxKind.FirstJSDocNode && node.kind <= ts.SyntaxKind.LastJSDocNode) return null;
  typedComparisons++;
  const children = [];
  ts.forEachChild(node, (child) => { const value = tree(child, source); if (value) children.push(value); }, (array) => {
    children.push({ array: array.map((child) => tree(child, source)).filter(Boolean) });
  });
  if (!children.length) { leaves++; return { kind: node.kind, leaf: node.getText(source) }; }
  return { kind: node.kind, children };
}
function sameActual(a, sa, b, sb) {
  assert.deepEqual(tree(a, sa), tree(b, sb));
  return modules.map((module) => { const old = emit(a.getText(sa), module), current = emit(b.getText(sb), module); assert.equal(current, old); return { module: ts.ModuleKind[module], wholeRawSame: true }; });
}
const source = before.source.map((row) => {
  const git = cp.execFileSync("git", ["show", before.baseCommit + ":" + row.path]);
  assert.equal(sha(git), row.sha256); assert.equal(git.toString(), row.text);
  const current = fs.readFileSync(row.path), changes = edits[row.path];
  let forward = Buffer.from(git), offset = 0;
  for (const edit of changes) {
    const at = edit.oldByteStart + offset, old = Buffer.from(edit.before), added = Buffer.from(edit.after);
    assert.equal(old.length, edit.oldByteLength); assert.equal(forward.subarray(at, at + old.length).toString(), edit.before);
    forward = Buffer.concat([forward.subarray(0, at), added, forward.subarray(at + old.length)]);
    offset += added.length - old.length;
  }
  assert.deepEqual(forward, current);
  let inverse = Buffer.from(current), total = changes.reduce((n, e) => n + Buffer.byteLength(e.after) - e.oldByteLength, 0);
  for (const edit of [...changes].reverse()) {
    total -= Buffer.byteLength(edit.after) - edit.oldByteLength;
    const at = edit.oldByteStart + total, added = Buffer.from(edit.after);
    assert.equal(inverse.subarray(at, at + added.length).toString(), edit.after);
    inverse = Buffer.concat([inverse.subarray(0, at), Buffer.from(edit.before), inverse.subarray(at + added.length)]);
  }
  assert.deepEqual(inverse, git);
  return { path: row.path, sha256: sha(current), exactEditSpans: changes.length, outputs: modules.map((module) => {
    const old = emit(row.text, module), actual = emit(current.toString(), module); assert.equal(emit(inverse.toString(), module), old);
    return { module: ts.ModuleKind[module], completeInverseRawSame: true, actualRawSame: actual === old };
  }) };
});
const ownerPath = "backend/src/core/domain/request-lease.ts", oldOwnerText = before.source.find((x) => x.path === ownerPath).text, newOwnerText = fs.readFileSync(ownerPath, "utf8");
const oldOwner = parse(ownerPath, oldOwnerText), newOwner = parse(ownerPath, newOwnerText);
const oldClass = oldOwner.statements.find(ts.isClassDeclaration), newClass = newOwner.statements.find(ts.isClassDeclaration);
const comparators = ["sameIndexedFields", "everyIndexedField", "everyReflectedField"].map((name) => {
  const a = oldOwner.statements.find((x) => ts.isFunctionDeclaration(x) && x.name.text === name), b = newOwner.statements.find((x) => ts.isFunctionDeclaration(x) && x.name.text === name);
  return { name, outputs: sameActual(a.body, oldOwner, b.body, newOwner) };
});
const protocols = ["actorPhaseDayStage", "stagePhaseDayActor", "actorPhaseStageDay", "item"].map((name) => {
  const a = oldClass.members.find((x) => x.name?.getText(oldOwner) === name).body.statements[0].expression;
  const b = newClass.members.find((x) => x.name?.getText(newOwner) === name).body.statements[0].expression;
  const abind = a.arguments[1].body, bbind = b.arguments[1].body;
  const ai = abind.statements.find(ts.isIfStatement), bi = bbind.statements.find(ts.isIfStatement);
  const outputs = sameActual(a.arguments[2], oldOwner, b.arguments[2], newOwner);
  sameActual(ai.expression, oldOwner, bi.expression, newOwner);
  sameActual(abind.statements[0], oldOwner, bbind.statements[0], newOwner);
  const aset = ai.thenStatement.statements[0].expression, bset = bi.thenStatement.statements[0].expression;
  assert.equal(aset.expression.getText(oldOwner), bset.expression.getText(newOwner));
  const oldFields = aset.arguments[1].properties, newFields = bset.arguments[1].arguments[2].properties;
  assert.equal(newFields.length, oldFields.length + (name === "item" ? 1 : 0));
  oldFields.forEach((field, i) => assert.deepEqual(tree(field, oldOwner), tree(newFields[i], newOwner)));
  sameActual(ai.thenStatement.statements[1], oldOwner, bi.thenStatement.statements[1], newOwner);
  return { name, completeOriginalMatchesOutputs: outputs, originalConditionAndLookupSame: true, originalSetCalleeAndRecordFieldOrderSame: true,
    delta: "set 参数新增 entry 分配，item 尾增原 author ref；登记之后新增 envelope/期限捕获，query 外围新增 F02 政策。不是整个 bind/query 运行等价。" };
});
const domains = [];
for (const row of before.source.filter((x) => /\/(?:initial_identity\/setup|wild_child\/lifecycle|lonely_girl\/lifecycle|wall_notes\/authority)\.ts$/.test(x.path))) {
  const old = parse(row.path, row.text), current = parse(row.path, fs.readFileSync(row.path, "utf8"));
  for (const a of old.statements.filter(ts.isFunctionDeclaration)) {
    const b = current.statements.find((node) => ts.isFunctionDeclaration(node) && node.name.text === a.name.text);
    assert.ok(b); domains.push({ path: row.path, name: a.name.text, outputs: sameActual(a.body, old, b.body, current) });
  }
}
const typeBefore = JSON.parse(fs.readFileSync(prefix + "unit-type-before.json"));
const actualUnit = fs.readFileSync(typeBefore.path, "utf8"); assert.equal(actualUnit, typeBefore.text.replace(typeBefore.before, typeBefore.after));
const typeBridge = { path: typeBefore.path, beforeSHA256: sha(typeBefore.text), finalSHA256: sha(actualUnit), outputs: modules.map((module) => {
  assert.equal(emit(actualUnit, module), emit(typeBefore.text, module)); return { module: ts.ModuleKind[module], wholeRawSame: true };
}) };
const commentBridge = JSON.parse(fs.readFileSync(prefix + "final-comment-before.json")).source.map((row) => {
  const actual = fs.readFileSync(row.path, "utf8"); assert.equal(actual, row.text.replace(row.before, row.after));
  const a = parse(row.path, row.text), b = parse(row.path, actual); assert.deepEqual(tree(a, a), tree(b, b));
  return { path: row.path, beforeSHA256: sha(row.text), finalSHA256: sha(actual), outputs: modules.map((module) => { assert.equal(emit(actual, module), emit(row.text, module)); return { module: ts.ModuleKind[module], wholeRawSame: true }; }) };
});
const controls = before.controls.map((row) => { assert.equal(sha(fs.readFileSync(row.path)), row.sha256); assert.equal(sha(cp.execFileSync("git", ["show", before.baseCommit + ":" + row.path])), row.sha256); return row; });
const config = ts.readConfigFile(prefix + "types-config.json", ts.sys.readFile).config;
const options = ts.parseJsonConfigFileContent(config, ts.sys, process.cwd()).options;
const program = ts.createProgram(JSON.parse(fs.readFileSync(prefix + "paths.json")), options), checker = program.getTypeChecker();
const endpoint = (node) => {
  let symbol = checker.getSymbolAtLocation(node); if (!symbol) return { unresolved: true };
  if (symbol.flags & ts.SymbolFlags.Alias) symbol = checker.getAliasedSymbol(symbol);
  return (symbol.declarations ?? []).map((d) => ({ file: path.relative(process.cwd(), d.getSourceFile().fileName), kind: ts.SyntaxKind[d.kind], name: d.name?.getText(d.getSourceFile()) ?? symbol.name }));
};
const bindings = [];
for (const file of JSON.parse(fs.readFileSync(prefix + "paths.json"))) {
  const sf = program.getSourceFile(file); assert.ok(sf);
  for (const node of sf.statements.filter(ts.isImportDeclaration)) {
    const clause = node.importClause; if (!clause) continue;
    const names = clause.namedBindings;
    for (const spec of names && ts.isNamedImports(names) ? names.elements : []) bindings.push({ file, module: node.moduleSpecifier.text,
      mode: clause.isTypeOnly || spec.isTypeOnly ? "type" : "value", imported: (spec.propertyName ?? spec.name).text, local: spec.name.text, endpoint: endpoint(spec.name) });
  }
}
assert.ok(!bindings.some((x) => x.endpoint.unresolved));
const ownedImports = bindings.filter((x) => x.file === ownerPath);
assert.deepEqual(ownedImports.filter((x) => x.mode === "value").map((x) => x.module), ["./request_delivery", "./request_delivery", "./request_delivery"]);
const result = { baseCommit: before.baseCommit, source, newSource: { path: typeBefore.path, sha256: sha(actualUnit) }, controls,
  comparators, protocols, unchangedCompleteDomainFunctions: domains, typeBridge, commentBridge, bindings,
  counts: { sourceInverse: source.length, inverseOutputs: source.length * 2, comparators: comparators.length, protocols: protocols.length,
    completeUnchangedDomainFunctions: domains.length, cumulativeTypedComparisons: typedComparisons, cumulativeASTLeaves: leaves, namedImportBindings: bindings.length },
  limits: ["F02 是有意行为变化：完整 source 精确逆只证明已申明差分，不证明 actual JS 全等；新增 state-machine／窗口钩子须人工和新字面测试核验。",
    "typed AST 递归 kind/叶/NodeArray，不是独立全词法 token walker；计数为多项两侧累计比较。",
    "保留的每个完整 matches／领域函数对 actual current 独立比 old；没有以恢复整个旧 body 掩新 owner 算法。",
    "named import endpoint 为本次有限 compiler 解析到的实际声明 file/name，不是全仓冷执行／任意 CJS namespace 重绑定等价。",
    "首 head/runtime/type 的新 unit 与三末 comment 阶段由同输出桥承接，原绿不重跑。"] };
fs.writeFileSync(prefix + "proof.json", JSON.stringify(result, null, 2) + "\n");
console.log(JSON.stringify(result.counts));
