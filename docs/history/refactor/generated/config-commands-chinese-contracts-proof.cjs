/** 核对本批中文维护注释的完整语法树、原始输出和精确文字增量，不执行前端或浏览器。 */
const fs = require('node:fs'), assert = require('node:assert/strict'), { createHash } = require('node:crypto');
const ts = require('../../../backend/node_modules/typescript');
const prefix = 'docs/refactor/generated/config-commands-chinese-contracts-';
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
      for (const tag of doc.tags ?? []) tags.push([tag.kind, tag.getText(source).replace('Migration/legacy programmatic compatibility only. Normal CLI loading uses loadBoardDefinition and never probes these fallback paths.', '仅供迁移和旧程序接口兼容；正常 CLI 使用 loadBoardDefinition，不探测这些回退路径。')]);
      if (doc.typeExpression) tags.push([doc.typeExpression.kind, doc.typeExpression.getText(source)]);
    }
    ts.forEachChild(node, child => { docs(child); });
  }
  docs(source);
  return { typed, tokenTree, tags, nodes, arrays, leaves };
}
function protectedDirectives(text, path) {
  const source = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true), ranges = new Map();
  function add(items) { for (const item of items ?? []) ranges.set(item.pos, item); }
  function walk(node) {
    add(ts.getLeadingCommentRanges(text, node.getFullStart()));
    add(ts.getTrailingCommentRanges(text, node.end));
    for (const child of node.getChildren(source)) walk(child);
  }
  walk(source);
  // 保护真实注释指令；正文提及 ESLint 或 import 包名都不是工具指令。
  return [...ranges.values()].sort((a, b) => a.pos - b.pos).map(range => text.slice(range.pos, range.end))
    .filter(comment => /@(?:ts-|jsx|license|preserve)|SPDX|copyright|<reference|(?:^|\n)\s*(?:\/\/|\/\*+|\*)\s*(?:eslint(?:[- ]|$)|prettier-|noinspection|istanbul ignore|c8 ignore)/i.test(comment));
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
  assert.deepEqual(protectedDirectives(current, row.path), protectedDirectives(row.text, row.path));
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
  limits: ['只核九个完整源的注释增量、非注释树与移除注释后的整输出；不运行类型、行为、Playwright或全门禁。',
    '职责真实含义仍需非作者逐源审查；机器文本、协议、类型和历史身份保持。唯一deprecated说明正文按明确中英对照翻译，tag名及语义不变。'] };
fs.writeFileSync(prefix + 'proof.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report.summary));
