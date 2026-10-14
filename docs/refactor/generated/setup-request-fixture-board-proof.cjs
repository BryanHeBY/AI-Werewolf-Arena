/** 核对两首夜夹具的精确输入修正；只读源码和原 Git，不运行或生成测试预期。 */
const fs = require("node:fs"), cp = require("node:child_process"), assert = require("node:assert/strict"), crypto = require("node:crypto");
const ts = require("../../../backend/node_modules/typescript");
const prefix = "docs/refactor/generated/setup-request-fixture-board-", before = JSON.parse(fs.readFileSync(prefix + "before.json")), edits = JSON.parse(fs.readFileSync(prefix + "edits.json"));
const sha = (value) => crypto.createHash("sha256").update(value).digest("hex"), parse = (text) => ts.createSourceFile("fixture.ts", text, ts.ScriptTarget.Latest, true);
const emit = (text, module) => ts.transpileModule(text, { compilerOptions: { target: ts.ScriptTarget.ES2022, module, removeComments: true } }).outputText;
function calls(text, name) {
  const source = parse(text), result = [];
  function visit(node) {
    if (ts.isCallExpression(node) && node.expression.getText(source) === name) result.push(node.getText(source));
    ts.forEachChild(node, visit);
  }
  visit(source);
  return result;
}
const rows = before.source.map((row) => {
  const original = cp.execFileSync("git", ["show", before.baseCommit + ":" + row.path], { encoding: "utf8" });
  assert.equal(original, row.text); assert.equal(sha(original), row.sha256);
  const current = fs.readFileSync(row.path, "utf8"), applied = [];
  let forward = original;
  for (const edit of edits[row.path]) {
    assert.equal(forward.split(edit.before).length - 1, edit.count);
    forward = forward.replace(edit.before, edit.after); applied.push(edit);
  }
  assert.equal(forward, current);
  let inverse = current;
  for (const edit of applied.reverse()) {
    assert.equal(inverse.split(edit.after).length - 1, edit.count);
    inverse = inverse.replace(edit.after, edit.before);
  }
  assert.equal(inverse, original);
  // 直接对原与实际末稿核所有 expect 表达式；输入适配不能改掉任何拒绝／引用预期。
  const oldExpect = calls(original, "expect"), newExpect = calls(current, "expect");
  assert.deepEqual(newExpect, oldExpect);
  const outputs = [ts.ModuleKind.ESNext, ts.ModuleKind.CommonJS].map((module) => {
    const oldJS = emit(original, module), inverseJS = emit(inverse, module), actualJS = emit(current, module);
    assert.equal(inverseJS, oldJS); assert.notEqual(actualJS, oldJS);
    return { module: ts.ModuleKind[module], completeInverseRawSame: true, actualRawSame: false, oldSHA256: sha(oldJS), actualSHA256: sha(actualJS) };
  });
  return { path: row.path, sha256: sha(current), exactEdits: edits[row.path].length, unchangedExpectExpressions: newExpect.length, outputs };
});
const controls = before.controls.map((row) => {
  assert.equal(sha(fs.readFileSync(row.path)), row.sha256);
  assert.equal(sha(cp.execFileSync("git", ["show", before.baseCommit + ":" + row.path])), row.sha256);
  return { ...row, actualGitAndCurrentSame: true };
});
const result = { baseCommit: before.baseCommit, source: rows, controls, preciseInputChanges: 2, productionChanges: 0, limits: ["实际 JavaScript 增加两个板子输入适配，不称原运行输入等价。", "完整源逆向与全部 expect 文本核同；不是全测试运行或任意 getter／模块反射证明。"] };
fs.writeFileSync(prefix + "proof.json", JSON.stringify(result, null, 2) + "\n");
console.log(JSON.stringify({ source: rows.length, exactEdits: rows.reduce((n, row) => n + row.exactEdits, 0), unchangedExpectExpressions: rows.reduce((n, row) => n + row.unchangedExpectExpressions, 0), controls: controls.length }));
