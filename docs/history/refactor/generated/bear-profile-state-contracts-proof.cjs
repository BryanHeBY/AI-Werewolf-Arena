/** 负责核熊资料清理的两条未消费导入及状态中文说明；输入完整原Git源码，输出全程序与运行编译文本对照，不执行游戏。 */
const fs = require("node:fs"), assert = require("node:assert/strict"), crypto = require("node:crypto"), ts = require("../../../backend/node_modules/typescript");
const prefix = "docs/refactor/generated/bear-profile-state-contracts-";
const before = JSON.parse(fs.readFileSync(prefix + "before.json", "utf8"));
const edits = JSON.parse(fs.readFileSync(prefix + "edits.json", "utf8"));
const sha = (text) => crypto.createHash("sha256").update(text).digest("hex");
const erasedImports = [];
function program(text, path) {
  const source = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true);
  assert.deepEqual(source.parseDiagnostics, []);
  let nodes = 0;
  function walk(node) {
    nodes++;
    const children = [];
    ts.forEachChild(node, (child) => { children.push(walk(child)); }, (array) => { children.push(["array", array.length, !!array.hasTrailingComma, ...array.map(walk)]); });
    return [node.kind, children];
  }
  const typed = walk(source), leaves = [];
  function tokens(node) {
    const children = node.getChildren(source).filter((child) => child.kind < ts.SyntaxKind.FirstJSDocNode || child.kind > ts.SyntaxKind.LastJSDocNode);
    if (!children.length) { const leaf = [node.kind, node.getText(source)]; leaves.push(leaf); return leaf; }
    return [node.kind, children.map(tokens)];
  }
  return { typed, tokens: tokens(source), nodes, leaves };
}
const programs = before.source.map((row) => {
  assert.equal(sha(row.text), row.sha256);
  const current = fs.readFileSync(row.path, "utf8"), changes = edits.filter((edit) => edit.path === row.path);
  let forward = row.text, comparable = row.text;
  for (const edit of changes) {
    assert.equal(forward.split(edit.before).length, 2);
    forward = forward.replace(edit.before, edit.after);
    if (edit.kind === "unused-import") {
      const parsed = ts.createSourceFile(row.path, row.text, ts.ScriptTarget.Latest, true);
      const declaration = parsed.statements.find((statement) => ts.isImportDeclaration(statement) && statement.getText(parsed) + "\n" === edit.before);
      assert.ok(declaration);
      const name = declaration.importClause.namedBindings.elements[0].name.text;
      let oldCount = 0, newCount = 0;
      function count(node, update) { if (ts.isIdentifier(node) && node.text === name) update(); ts.forEachChild(node, (child) => { count(child, update); }); }
      count(parsed, () => oldCount++);
      count(ts.createSourceFile(row.path, current, ts.ScriptTarget.Latest, true), () => newCount++);
      assert.equal(oldCount, 1); assert.equal(newCount, 0);
      comparable = comparable.replace(edit.before, "");
      erasedImports.push({ path: row.path, name, oldIdentifierOccurrences: oldCount, newIdentifierOccurrences: newCount, wholeImport: edit.before });
    }
  }
  assert.equal(forward, current);
  const originalProgram = program(comparable, row.path), currentProgram = program(current, row.path);
  assert.deepEqual(currentProgram, originalProgram);
  const outputs = [ts.ModuleKind.ESNext, ts.ModuleKind.CommonJS].map((module) => {
    const emit = (text) => ts.transpileModule(text, { fileName: row.path, compilerOptions: { target: ts.ScriptTarget.ES2022, module, removeComments: true } }).outputText;
    const original = emit(row.text), final = emit(current);
    assert.equal(original, final);
    return { module: ts.ModuleKind[module], completeOriginalRawSame: true, sha256: sha(final) };
  });
  return { path: row.path, beforeSHA256: row.sha256, sha256: sha(current), wholeExactForward: true, completeProgramExceptTwoUnusedImportsSame: true, typedNodes: currentProgram.nodes, noncommentLeaves: currentProgram.leaves.length, outputs };
});
assert.equal(erasedImports.length, 2);
const result = { baseCommit: before.baseCommit, programs, erasedImports, summary: { sources: programs.length, unusedImports: erasedImports.length, commentEditRecords: edits.filter((row) => row.kind === "comment").length, typedNodes: programs.reduce((sum, row) => sum + row.typedNodes, 0), noncommentLeaves: programs.reduce((sum, row) => sum + row.noncommentLeaves, 0), wholeOriginalRawOutputs: 2 * programs.length }, limits: ["原模块完整运行编译输出同，未执行冷导入或证明任意私有路径/namespace/反射恒同。", "不运行游戏、类型或全门禁；有效中文语义另由非作者实际源码审查。"] };
fs.writeFileSync(prefix + "proof.json", JSON.stringify(result, null, 2) + "\n");
console.log(JSON.stringify(result.summary));
