/** 核对本批中文维护注释的完整语法树、原始输出和精确文字增量，不执行前端或浏览器。 */
const fs = require('node:fs'), assert = require('node:assert/strict'), { createHash } = require('node:crypto');
const ts = require('../../../backend/node_modules/typescript');
const prefix = 'docs/refactor/generated/frontend-playback-chinese-contracts-';
const before = JSON.parse(fs.readFileSync(prefix + 'before.json', 'utf8'));
const ready = JSON.parse(fs.readFileSync(prefix + 'source-ready.json', 'utf8'));
const edits = JSON.parse(fs.readFileSync(prefix + 'edits.json', 'utf8'));
const sha = text => createHash('sha256').update(text).digest('hex');
function program(text, path) {
  const source = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true);
  assert.deepEqual(source.parseDiagnostics, []);
  let nodes = 0, arrays = 0, leaves = 0;
  function walk(node) {
    nodes++;
    const children = [];
    ts.forEachChild(node, child => { children.push(walk(child)); }, items => {
      arrays++;
      children.push(['array', items.length, !!items.hasTrailingComma, items.map(walk)]);
    });
    return [node.kind, children];
  }
  function tokens(node) {
    const children = node.getChildren(source).filter(child => child.kind < ts.SyntaxKind.FirstJSDocNode || child.kind > ts.SyntaxKind.LastJSDocNode);
    if (!children.length) { leaves++; return [node.kind, node.getText(source)]; }
    return [node.kind, children.map(tokens)];
  }
  const typed = walk(source), tokenTree = tokens(source), tags = [];
  function docs(node) {
    for (const doc of node.jsDoc ?? []) {
      for (const tag of doc.tags ?? []) tags.push([tag.kind, tag.getText(source)]);
      if (doc.typeExpression) tags.push([doc.typeExpression.kind, doc.typeExpression.getText(source)]);
    }
    ts.forEachChild(node, child => { docs(child); });
  }
  docs(source);
  return { typed, tokenTree, tags, nodes, arrays, leaves };
}
function protectedDirectives(text) {
  return text.match(/(?:@ts-(?:expect-error|ignore|check|nocheck)|@jsx(?:ImportSource|Runtime|Frag)?|@license|@preserve|SPDX|copyright|eslint|prettier|noinspection|<reference|istanbul|\bc8\b)[^\r\n]*/gi) ?? [];
}
const programs = before.source.map(row => {
  const current = fs.readFileSync(row.path, 'utf8'), item = edits.find(item => item.path === row.path);
  assert.equal(sha(row.text), row.sha256);
  assert.equal(sha(current), ready.source.find(item => item.path === row.path).sha256);
  let forward = row.text, inverse = current;
  for (const edit of [...item.edits].reverse()) {
    assert.equal(row.text.slice(edit.beforeStart, edit.beforeEnd), edit.before);
    assert.equal(current.slice(edit.afterStart, edit.afterEnd), edit.after);
    forward = forward.slice(0, edit.beforeStart) + edit.after + forward.slice(edit.beforeEnd);
    inverse = inverse.slice(0, edit.afterStart) + edit.before + inverse.slice(edit.afterEnd);
  }
  assert.equal(forward, current); assert.equal(inverse, row.text);
  const a = program(row.text, row.path), b = program(current, row.path);
  assert.deepEqual(b, a);
  assert.deepEqual(protectedDirectives(current), protectedDirectives(row.text));
  const outputs = [ts.ModuleKind.ESNext, ts.ModuleKind.CommonJS].map(module => {
    const emit = text => ts.transpileModule(text, { fileName: row.path, compilerOptions: {
      target: ts.ScriptTarget.ES2022, module, jsx: ts.JsxEmit.ReactJSX, removeComments: true,
    } }).outputText;
    const original = emit(row.text), actual = emit(current);
    assert.equal(actual, original);
    return { module: ts.ModuleKind[module], sha256: sha(actual), wholeRawSame: true };
  });
  return { path: row.path, beforeSha256: row.sha256, sha256: sha(current), exactTextEdits: item.edits.length,
    typedNodes: a.nodes, nodeArrays: a.arrays, nonCommentLeaves: a.leaves,
    wholeForwardInverse: true, wholeTypedAndTokenTreeSame: true, protectedDirectivesSame: true, outputs };
});
for (const control of before.controls) assert.equal(sha(fs.readFileSync(control.path)), control.sha256);
const report = { baseCommit: before.baseCommit, sourceReadySHA256: sha(fs.readFileSync(prefix + 'source-ready.json')),
  programs, controls: before.controls.map(({ text, ...row }) => row),
  summary: { sources: programs.length, typedNodes: programs.reduce((n, row) => n + row.typedNodes, 0),
    nodeArrays: programs.reduce((n, row) => n + row.nodeArrays, 0), nonCommentLeaves: programs.reduce((n, row) => n + row.nonCommentLeaves, 0), wholeRawOutputs: programs.length * 2 },
  limits: ['只核十八个完整源的注释增量、非注释树与移除注释后的整输出；不运行类型、行为、Playwright或全门禁。',
    '职责真实含义仍需非作者逐源审查；原标题、机器文本、协议、源码之外的历史身份和归档保持。'] };
fs.writeFileSync(prefix + 'proof.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report.summary));
