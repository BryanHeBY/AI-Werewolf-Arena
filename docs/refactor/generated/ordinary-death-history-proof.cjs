/**
 * 只读实际 exact3 文本与 TypeScript AST；核原 assembly 完整正逆、18原调用顺序和新 owner 纯数据依赖。
 * 新拒绝政策没有旧算法等价主张；新 owner／unit 仅形成实际完整程序库存，不加载生产或运行测试／类型。
 */
const fs = require("node:fs"), { createHash } = require("node:crypto"), ts = require("../../../backend/node_modules/typescript");
const prefix = "docs/refactor/generated/ordinary-death-history-";
const hash = b => createHash("sha256").update(b).digest("hex");
const before = JSON.parse(fs.readFileSync(prefix + "before.json", "utf8"));
const edits = JSON.parse(fs.readFileSync(prefix + "edits.json", "utf8"));
const ready = JSON.parse(fs.readFileSync(prefix + "source-ready.json", "utf8"));
const assert = (v, label) => { if (!v) throw Error(label); };
function shape(text, name) {
  const source = ts.createSourceFile(name, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  assert(source.parseDiagnostics.length === 0, "syntax:" + name);
  let nodes = 0, arrays = 0, leaves = 0;
  const walk = n => {
    nodes++;
    const children = [];
    ts.forEachChild(n, c => { children.push(walk(c)); }, list => {
      arrays++; children.push(["NodeArray", list.length, list.hasTrailingComma === true, list.map(walk)]);
    });
    if (!children.length) leaves++;
    return [ts.SyntaxKind[n.kind], children.length ? children : n.getText(source)];
  };
  return { source, tree: walk(source), counts: { nodes, arrays, leaves } };
}
function emit(text, name, module) {
  return ts.transpileModule(text, { fileName: name, compilerOptions: { target: ts.ScriptTarget.ES2022, module, removeComments: true, strict: true } }).outputText;
}
const current = new Map(ready.source.map(r => { const b = fs.readFileSync(r.path); assert(hash(b) === r.sha256, "source_changed:" + r.path); return [r.path, b.toString("utf8")]; }));
const controls = before.controls.map(r => { const b = fs.readFileSync(r.path); assert(hash(b) === r.sha256, "control_changed:" + r.path); return { path: r.path, sha256: r.sha256 }; });
const assemblyPath = "backend/src/verification/reproduction/assembly.ts", old = before.source.find(r => r.path === assemblyPath).text;
let forward = old;
for (const e of edits.edits) { assert(e.path === assemblyPath, "foreign_edit"); assert(forward.split(e.before).length - 1 === e.count, "forward_anchor"); forward = forward.replace(e.before, e.after); }
assert(forward === current.get(assemblyPath), "whole_forward");
let inverse = current.get(assemblyPath);
for (const e of [...edits.edits].reverse()) { assert(inverse.split(e.after).length - 1 === e.count, "inverse_anchor"); inverse = inverse.replace(e.after, e.before); }
assert(inverse === old, "whole_inverse");
const oldShape = shape(old, assemblyPath), restored = shape(inverse, assemblyPath);
assert(JSON.stringify(oldShape.tree) === JSON.stringify(restored.tree), "whole_inverse_shape");
const raw = [ts.ModuleKind.ESNext, ts.ModuleKind.CommonJS].map(module => {
  const original = emit(old, assemblyPath, module), restoredOutput = emit(inverse, assemblyPath, module), actual = emit(current.get(assemblyPath), assemblyPath, module);
  assert(original === restoredOutput, "whole_inverse_emit");
  return { module: ts.ModuleKind[module], originalSHA256: hash(original), inverseSHA256: hash(restoredOutput), actualSHA256: hash(actual), inverseSame: true, actualSame: original === actual };
});
function calls(text) {
  const source = shape(text, assemblyPath).source;
  const fn = source.statements.find(n => ts.isFunctionDeclaration(n) && n.name?.text === "verifyReproductionMechanisms");
  assert(fn?.body, "assembly_body");
  const result = [];
  const visit = n => { if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && n.expression.text.startsWith("validate")) result.push(n.expression.text); ts.forEachChild(n, visit); };
  visit(fn.body); return result;
}
const oldCalls = calls(old), newCalls = calls(current.get(assemblyPath));
assert(oldCalls.length === 18 && JSON.stringify(newCalls) === JSON.stringify([...oldCalls, "validateDeathHistoryRecord"]), "original18_order_append");
const ownerPath = "backend/src/verification/reproduction/death-history.ts";
const inventory = ready.source.map(r => { const s = shape(current.get(r.path), r.path); return { path: r.path, sha256: r.sha256, ...s.counts }; });
const owner = shape(current.get(ownerPath), ownerPath).source;
const imports = owner.statements.filter(ts.isImportDeclaration).map(n => ({ specifier: n.moduleSpecifier.text, typeOnly: n.importClause?.isTypeOnly === true }));
assert(imports.length === 2 && imports.some(i => i.specifier === "@ai-werewolf-arena/game-contract" && !i.typeOnly) && imports.some(i => i.specifier === "../../recording/reproduction" && i.typeOnly), "pure_owner_import_boundary");
const report = { baseCommit: before.baseCommit, sourceReadySHA256: hash(fs.readFileSync(prefix + "source-ready.json")), source: ready.source, controls, assembly: { edits: edits.edits.length, wholeForward: true, wholeInverse: true, originalCalls: oldCalls, actualCalls: newCalls, raw }, inventory, ownerImports: imports, limits: ["New owner algorithm is a new strict semantic audit, not a mechanical-equivalence claim.", "AST inventory uses forEachChild typed nodes, leaves and explicit NodeArray callbacks; JSDoc text is not counted as semantic leaves.", "Only direct value/type import boundary is sampled here; no dynamic runtime, parser, types or behavioral test is executed."] };
fs.writeFileSync(prefix + "proof.json", JSON.stringify(report, null, 2) + "\n"); console.log(JSON.stringify(report));
