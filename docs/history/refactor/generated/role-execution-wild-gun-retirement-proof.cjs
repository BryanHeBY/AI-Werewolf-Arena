/** 核对本四程序的政策差分、完整原文、付款谓词和直接 core 绑定；不执行业务或全门禁。 */
const fs = require("node:fs"), path = require("node:path"), assert = require("node:assert/strict"), { createHash } = require("node:crypto"), ts = require("../../../backend/node_modules/typescript");
const pre = "docs/refactor/generated/role-execution-wild-gun-retirement-";
const load = (name) => JSON.parse(fs.readFileSync(pre + name + ".json", "utf8"));
const sha = (text) => createHash("sha256").update(text).digest("hex");
const before = load("before"), edits = load("edits"), paths = load("paths");
const parse = (text, p) => {
  const f = ts.createSourceFile(p, text, ts.ScriptTarget.Latest, true);
  assert.equal(f.parseDiagnostics.length, 0);
  return f;
};
let typed = 0, leaves = 0;
function tree(node, file) {
  typed++;
  const children = [];
  ts.forEachChild(node, (n) => { children.push(tree(n, file)); }, (a) => { children.push(["NodeArray", ...a.map((n) => tree(n, file))]); });
  if (!children.length) { leaves++; return [node.kind, node.getText(file)]; }
  return [node.kind, ...children];
}
function find(file, predicate) {
  const matches = [];
  function walk(n) { if (predicate(n)) matches.push(n); ts.forEachChild(n, (n) => { walk(n); }); }
  walk(file);
  assert.equal(matches.length, 1);
  return matches[0];
}
const emit = (text, fileName, module) => ts.transpileModule(text, { fileName, compilerOptions: { target: ts.ScriptTarget.ES2022, module, removeComments: true } }).outputText;
const oldTrees = new Map(), actualTrees = new Map();
const programs = before.source.map((old) => {
  const now = fs.readFileSync(old.path, "utf8");
  assert.equal(sha(old.text), old.sha256);
  let forward = old.text, inverse = now;
  for (const row of edits.filter((x) => x.path === old.path)) { assert.equal(forward.split(row.before).length, 2); forward = forward.replace(row.before, row.after); }
  assert.equal(forward, now);
  for (const row of edits.filter((x) => x.path === old.path).reverse()) { assert.equal(inverse.split(row.after).length, 2); inverse = inverse.replace(row.after, row.before); }
  assert.equal(inverse, old.text);
  const a = parse(old.text, old.path), b = parse(inverse, old.path), current = parse(now, old.path);
  assert.deepEqual(tree(a, a), tree(b, b));
  oldTrees.set(old.path, a); actualTrees.set(old.path, current);
  const outputs = [ts.ModuleKind.ESNext, ts.ModuleKind.CommonJS].map((module) => {
    const original = emit(old.text, old.path, module), inverted = emit(inverse, old.path, module), actual = emit(now, old.path, module);
    assert.equal(inverted, original);
    return { module: ts.ModuleKind[module], completeInverseRawSame: true, actualRawSame: actual === original, actualSha256: sha(actual) };
  });
  return { path: old.path, beforeSha256: old.sha256, sha256: sha(now), completeExactForwardInverse: true, outputs };
});
// 原体与已消费提案谓词不加墓碑；request permission 只保正文，gift active 依赖仍是执行资格。
const preserved = [];
for (const [fileName, variable] of [
  [paths[1], "ownerCurrent"],
  [paths[3], "permissionCurrent"],
]) {
  const a = oldTrees.get(fileName), b = actualTrees.get(fileName);
  const predicate = (n) => ts.isVariableDeclaration(n) && n.name.getText(n.getSourceFile()) === variable;
  const old = find(a, predicate).initializer, now = find(b, predicate).initializer;
  assert.equal(now.getText(b), old.getText(a));
  assert.deepEqual(tree(old, a), tree(now, b));
  preserved.push({ path: fileName, predicate: variable, role: variable === "permissionCurrent" ? "original request body; gift active dependency may reject" : "original paid owner predicate", actualCompleteTextSame: true, actualTypedTreeSame: true });
}
const nativeOld = oldTrees.get(paths[2]), nativeNow = actualTrees.get(paths[2]);
const pending = (n) => ts.isPropertyAssignment(n) && n.name.getText(n.getSourceFile()) === "isCurrent" && n.initializer.getText(n.getSourceFile()).includes("world.isDeathActionOpen");
const paidOld = find(nativeOld, pending).initializer, paidNow = find(nativeNow, pending).initializer;
assert.equal(paidOld.getText(nativeOld), paidNow.getText(nativeNow));
assert.deepEqual(tree(paidOld, nativeOld), tree(paidNow, nativeNow));
preserved.push({ path: paths[2], predicate: "native.pendingShots.isCurrent", actualCompleteTextSame: true, actualTypedTreeSame: true });
const wildOld = oldTrees.get(paths[0]), wildNow = actualTrees.get(paths[0]);
const core = (n) => ts.isTryStatement(n) && n.tryBlock.getText(n.getSourceFile()).includes("b.actor.role.camp = Camp.Wolf");
const oldCore = find(wildOld, core), nowCore = find(wildNow, core);
assert.equal(oldCore.tryBlock.getText(wildOld), nowCore.tryBlock.getText(wildNow));
assert.deepEqual(tree(oldCore.tryBlock, wildOld), tree(nowCore.tryBlock, wildNow));
assert.equal(nowCore.catchClause.block.statements[0].getText(wildNow), oldCore.catchClause.block.statements[0].getText(wildOld));
assert.equal(nowCore.catchClause.block.statements[1].getText(wildNow), "retireRoleExecution(executionRole!);");
assert.equal(nowCore.catchClause.block.statements[2].getText(wildNow), oldCore.catchClause.block.statements[1].getText(wildOld));
const coreSource = "backend/src/core/domain/role-execution-authority.ts", coreText = fs.readFileSync(coreSource, "utf8"), coreFile = parse(coreText, coreSource);
assert(coreFile.statements.filter(ts.isImportDeclaration).every((n) => n.importClause?.isTypeOnly));
const bindings = [];
for (const p of paths.slice(0, 4)) {
  const f = actualTrees.get(p);
  const imports = f.statements.filter((n) => ts.isImportDeclaration(n) && n.moduleSpecifier.text.endsWith("/role-execution-authority"));
  assert.equal(imports.length, 1);
  const n = imports[0];
  assert.equal(path.resolve(path.dirname(p), n.moduleSpecifier.text + ".ts"), path.resolve(coreSource));
  for (const x of n.importClause.namedBindings.elements) {
    const name = x.name.text;
    assert(coreFile.statements.some((d) => ts.isFunctionDeclaration(d) && d.name?.text === name));
    bindings.push({ consumer: p, name, endpoint: coreSource, kind: "directOriginalCoreDeclaration" });
  }
}
for (const c of before.controls) assert.equal(sha(fs.readFileSync(c.path)), c.sha256);
const unitFile = parse(fs.readFileSync(paths[4], "utf8"), paths[4]);
const unitCases = unitFile.statements.filter((n) => ts.isExpressionStatement(n) && ts.isCallExpression(n.expression) && n.expression.expression.getText(unitFile) === "test").map((n) => n.expression.arguments[0].text);
assert.equal(unitCases.length, 4);
const out = { approved: true, baseCommit: before.baseCommit, source: paths.map((path) => ({ path, sha256: sha(fs.readFileSync(path)) })), deleted: [], programs, preservedPredicateBodies: preserved, originalWildCore: { statements: oldCore.tryBlock.statements.length, completeTextSame: true, typedTreeSame: true, catchOrder: ["original family WeakSet.add", "new retire captured Role", "original throw same error"] }, bindings, coreCohortSource: { path: coreSource, sha256: sha(coreText), typeOnlyImports: true, scope: "Root-owned shared dependency; not stable before control." }, controls: before.controls.map(({ text, ...c }) => c), unitCases, summary: { existingWholePrograms: 4, exactEdits: edits.length, completeInverseRawOutputs: 8, cumulativeTypedComparisons: typed, cumulativeASTLeaves: leaves, unchangedPaidPredicates: 2, unchangedRequestPredicateBodies: 1, directCoreBindings: bindings.length, newCases: 4 }, limits: ["F05a behavior delta, actual JS differs; inverse equality only confirms all retained body outside exact policy edits.", "Retirement is action-only; pure data/target/World/original scopes not filtered. Role.camp and constructors unchanged.", "Finite own scope does not prove all55special actor or Camp single-source completion.", "Root core/Initial and foreign resource/wolf owners are one runtime cohort; no claim whole fixed Git execution.", "Typed AST/leaf comparisons are cumulative and not a separate complete lexer token walker or arbitrary ambient monkeypatch equivalence."] };
fs.writeFileSync(pre + "proof.json", JSON.stringify(out, null, 2) + "\n");
console.log(JSON.stringify({ summary: out.summary, preservedPredicateBodies: preserved, core: out.originalWildCore }));
