/** 只核末同族决定的三源真实增量和原13完整单元保留，不执行业务／类型／头或重复主证明。 */
const fs = require("node:fs"), path = require("node:path"), crypto = require("node:crypto");
const ts = require(path.join(process.cwd(), "backend/node_modules/typescript"));
const pre = "docs/refactor/generated/cupid-hybrid-reproduction-verifiers-";
const before = JSON.parse(fs.readFileSync(pre + "causal-admission-before.json", "utf8"));
const edits = JSON.parse(fs.readFileSync(pre + "causal-admission-edits.json", "utf8"));
const ready = JSON.parse(fs.readFileSync(pre + "source-ready-causal-repair.json", "utf8"));
const sha = value => crypto.createHash("sha256").update(value).digest("hex");
function check(ok, label) { if (!ok) throw Error(label); }
function parse(file, text) {
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  check(source.parseDiagnostics.length === 0, "parse:" + file); return source;
}
function shape(file, text) {
  const source = parse(file, text), parts = []; let typedNodes = 0, nodeArrays = 0, leaves = 0;
  function visit(node) {
    if (node.kind >= ts.SyntaxKind.FirstJSDocNode && node.kind <= ts.SyntaxKind.LastJSDocNode) return;
    typedNodes++; parts.push(node.kind); let children = 0;
    ts.forEachChild(node, child => { children++; visit(child); }, array => {
      nodeArrays++; parts.push(["NodeArray", array.length, !!array.hasTrailingComma]);
      for (const child of array) { children++; visit(child); }
    });
    if (!children) { leaves++; parts.push(["leaf", node.getText(source)]); }
  }
  visit(source); return { sha256: sha(JSON.stringify(parts)), typedNodes, nodeArrays, leaves };
}
const emit = (file, text, module) => ts.transpileModule(text, { fileName: file,
  compilerOptions: { target: ts.ScriptTarget.ES2022, module, removeComments: true } }).outputText;
const reports = []; let retainedUnitDeclarations = [];
for (const row of edits.source) {
  const old = before.source.find(x => x.path === row.path), actual = fs.readFileSync(row.path, "utf8");
  check(sha(old.text) === row.beforeSHA256 && sha(actual) === row.afterSHA256, "source_hash:" + row.path);
  check(sha(actual) === ready.source.find(x => x.path === row.path).sha256, "ready_hash:" + row.path);
  let forward = old.text; const steps = [];
  for (const edit of row.edits) {
    const offset = edit.operation === "append-after-original-eof" ? forward.length : forward.indexOf(edit.before);
    check(offset >= 0, "forward_missing:" + edit.label);
    if (edit.operation === "append-after-original-eof") check(forward.length === edit.beforeLength, "append_length");
    else check(forward.indexOf(edit.before, offset + 1) < 0, "forward_not_unique:" + edit.label);
    forward = forward.slice(0, offset) + edit.after + forward.slice(offset + edit.before.length);
    steps.push({ ...edit, offset });
  }
  check(forward === actual, "complete_forward:" + row.path);
  let inverse = actual;
  for (const edit of [...steps].reverse()) {
    check(inverse.slice(edit.offset, edit.offset + edit.after.length) === edit.after, "inverse_delta:" + edit.label);
    inverse = inverse.slice(0, edit.offset) + edit.before + inverse.slice(edit.offset + edit.after.length);
  }
  check(inverse === old.text, "complete_inverse:" + row.path);
  check(shape(row.path, inverse).sha256 === shape(row.path, old.text).sha256, "whole_inverse_tree:" + row.path);
  const outputs = [ts.ModuleKind.ESNext, ts.ModuleKind.CommonJS].map(module => {
    const a = emit(row.path, old.text, module), b = emit(row.path, inverse, module), c = emit(row.path, actual, module);
    check(a === b, "whole_inverse_emit:" + row.path);
    return { module, beforeSHA256: sha(a), inverseSHA256: sha(b), actualSHA256: sha(c), inverseSame: true, actualSame: c === a };
  });
  if (row.path.endsWith(".test.ts")) {
    check(actual.startsWith(old.text), "all_original_unit_bytes_retained");
    const declarations = (text) => { const file = parse(row.path, text); return file.statements.filter(node => ts.isExpressionStatement(node) &&
      ts.isCallExpression(node.expression) && node.expression.expression.getText(file) === "test").map(node => ({
        title: node.expression.arguments[0].text, wholeText: node.getText(file),
      })); };
    const a = declarations(old.text), b = declarations(actual);
    check(a.length === 13 && b.length === 14, "thirteen_plus_one_declaration");
    check(JSON.stringify(a) === JSON.stringify(b.slice(0, 13)), "all_original_thirteen_complete_declarations_and_assertions");
    retainedUnitDeclarations = a.map(row => ({ title: row.title, completeDeclarationSHA256: sha(row.wholeText) }));
  }
  reports.push({ path: row.path, beforeSHA256: row.beforeSHA256, actualSHA256: row.afterSHA256,
    exactDeltas: row.edits.length, oldProgram: shape(row.path, old.text), actualProgram: shape(row.path, actual), outputs });
}
const assembly = ready.source.find(row => row.path.endsWith("/assembly.ts"));
const first = JSON.parse(fs.readFileSync(pre + "source-ready.json", "utf8"));
check(sha(fs.readFileSync(assembly.path)) === assembly.sha256 && assembly.sha256 === first.source.find(row => row.path === assembly.path).sha256, "unchanged_assembly");
const report = { sourceReadySHA256: sha(fs.readFileSync(pre + "source-ready-causal-repair.json")), source: ready.source, reports,
  retainedUnitDeclarations, assemblyUnchanged: assembly,
  limits: ["独立审查静态因果finding修正，真实拒绝面与单元JS有意改变；不称actual raw同或算法等价。", "只当前3源增量完整正逆及6inverse raw；原13完整声明/断言逐字不改，未运行它们。", "原unit13/76、mainproof/heads/type-only桥仍各首采样；本工具不加载verifier或生产、不运行类型/行为/头。"] };
fs.writeFileSync(pre + "causal-admission-proof.json", JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify({ changedSource: reports.length, exactDeltas: reports.reduce((n, row) => n + row.exactDeltas, 0), retainedWholeDeclarations: retainedUnitDeclarations.length,
  newDeclarations: 1, inverseWholeOutputs: reports.flatMap(row => row.outputs).length, actualOutputDifferences: reports.flatMap(row => row.outputs).filter(row => !row.actualSame).length, assemblyUnchanged: true }));
