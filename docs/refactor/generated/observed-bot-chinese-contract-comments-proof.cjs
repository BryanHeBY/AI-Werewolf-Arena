/**
 * 负责观察策略九个源码的完整纯注释对照；输入为实际 Git before、精确注释编辑和当前全文。
 * 输出完整 typed AST、非注释叶／token、精确全文逆及两种 JS 输出的比对结果。
 * 不调用测试、类型检查或门禁；程序相同不代替契约说明的独立语义审查。
 */
const fs = require('node:fs');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { createHash } = require('node:crypto');
const ts = require('../../../backend/node_modules/typescript');
const prefix = 'docs/refactor/generated/observed-bot-chinese-contract-comments-';
const before = JSON.parse(fs.readFileSync(prefix + 'before.json', 'utf8'));
const edits = JSON.parse(fs.readFileSync(prefix + 'edits.json', 'utf8'));
const sha = text => createHash('sha256').update(text).digest('hex');
const isJSDoc = node => node.kind >= ts.SyntaxKind.FirstJSDocNode && node.kind <= ts.SyntaxKind.LastJSDocNode;
function parse(text, path) {
  const source = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true);
  assert.deepEqual(source.parseDiagnostics, []);
  return source;
}
function typedTree(source) {
  let count = 0;
  function visit(node) {
    count++;
    const children = [];
    // 两个回调均不返回 push 的 number，避免 forEachChild 提前结束；NodeArray 逐项保留。
    ts.forEachChild(node, child => { children.push(visit(child)); }, array => {
      children.push(['NodeArray', array.length, Boolean(array.hasTrailingComma), ...array.map(visit)]);
    });
    return [node.kind, children];
  }
  return { tree: visit(source), nodes: count };
}
function fullTokens(source) {
  let count = 0;
  const leaves = [];
  function visit(node) {
    if (isJSDoc(node)) return null;
    count++;
    const children = node.getChildren(source).filter(child => !isJSDoc(child));
    if (!children.length) {
      const leaf = [node.kind, node.getText(source)];
      leaves.push(leaf);
      return leaf;
    }
    return [node.kind, children.map(visit)];
  }
  return { tree: visit(source), nodes: count, leaves };
}
const results = before.source.map(file => {
  assert.equal(sha(file.text), file.sha256);
  const git = execFileSync('git', ['show', `${before.baseCommit}:${file.path}`], { encoding: 'utf8' });
  assert.equal(git, file.text);
  const current = fs.readFileSync(file.path, 'utf8');
  const fileEdits = edits.filter(edit => edit.path === file.path);
  let inverse = current;
  for (const edit of [...fileEdits].reverse()) {
    assert.equal(inverse.split(edit.after).length, (edit.expectedOccurrences ?? 1) + 1, `${file.path}: exact comment match`);
    inverse = inverse.replaceAll(edit.after, edit.before);
  }
  assert.equal(inverse, file.text, `${file.path}: exact full-source inverse`);
  const A = parse(file.text, file.path), B = parse(current, file.path);
  const a = typedTree(A), b = typedTree(B), tokensA = fullTokens(A), tokensB = fullTokens(B);
  assert.deepEqual(b, a, `${file.path}: complete typed tree with arrays`);
  assert.deepEqual(tokensB, tokensA, `${file.path}: complete noncomment tokens and raw literals`);
  const outputs = [ts.ModuleKind.ESNext, ts.ModuleKind.CommonJS].map(module => {
    const emit = text => ts.transpileModule(text, {
      fileName: file.path, compilerOptions: { target: ts.ScriptTarget.ES2022, module, removeComments: true },
    }).outputText;
    const oldOutput = emit(file.text), newOutput = emit(current);
    assert.equal(newOutput, oldOutput, `${file.path}: whole ${ts.ModuleKind[module]} output`);
    return { module: ts.ModuleKind[module], wholeRawSame: true, sha256: sha(newOutput) };
  });
  assert.match(current.match(/^\/\*\*([\s\S]*?)\*\//)?.[0] ?? '', /[\u4e00-\u9fff]/);
  return {
    path: file.path, beforeSHA256: file.sha256, sha256: sha(current), exactCommentRecords: fileEdits.length, exactCommentEdits: fileEdits.reduce((n, edit) => n + (edit.expectedOccurrences ?? 1), 0),
    actualGitBeforeSame: true, exactWholeSourceInverseSame: true, fullTypedTreeSame: true,
    typedNodes: a.nodes, fullTokenTreeSame: true, tokenTreeNodes: tokensA.nodes,
    noncommentLeaves: tokensA.leaves.length, tokenTreeSHA256: sha(JSON.stringify(tokensA.tree)), outputs,
    chineseHeadPresent: true,
  };
});
const report = {
  baseCommit: before.baseCommit, source: results, exactCommentRecords: edits.length, exactCommentEdits: edits.reduce((n, edit) => n + (edit.expectedOccurrences ?? 1), 0),
  summary: { programs: results.length, typedNodes: results.reduce((n, x) => n + x.typedNodes, 0),
    tokenTreeNodes: results.reduce((n, x) => n + x.tokenTreeNodes, 0), noncommentLeaves: results.reduce((n, x) => n + x.noncommentLeaves, 0),
    wholeRawOutputs: results.length * 2, mismatches: 0 },
  limitations: [
    '只核本批九个完整源码的注释迁移，不执行依赖闭包、模型、测试、类型编译、职责／架构门禁。',
    '中文首头存在只作采样，契约语义需另由实际消费者和独立审查核实。',
    '当前路径、注释源码会影响新构建 sourceHash；历史记录指纹保持，不声明跨构建复现豁免。',
  ],
};
fs.writeFileSync(prefix + 'proof.json', JSON.stringify(report, null, 2) + '\n');
process.stdout.write(JSON.stringify(report.summary) + '\n');
