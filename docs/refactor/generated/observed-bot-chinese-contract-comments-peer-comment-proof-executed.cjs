/** 仅核 Mist 首头移项而非去重的说明精度注释桥；以首次五程序报告和实际保存全文为输入，不重跑测试／类型／门禁。 */
const fs = require('node:fs');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const ts = require('../../../backend/node_modules/typescript');
const prefix = 'docs/refactor/generated/observed-bot-chinese-contract-comments-';
const entries = JSON.parse(fs.readFileSync(prefix + 'peer-comment-before.json', 'utf8'));
const originalReport = JSON.parse(fs.readFileSync(prefix + 'proof.json', 'utf8'));
const sha = text => createHash('sha256').update(text).digest('hex');
function tree(text, path) {
  const source = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true);
  assert.deepEqual(source.parseDiagnostics, []);
  let nodes = 0, leaves = 0;
  function visit(node) {
    nodes++;
    const children = node.getChildren(source).filter(child => child.kind < ts.SyntaxKind.FirstJSDocNode || child.kind > ts.SyntaxKind.LastJSDocNode);
    if (children.length) return [node.kind, children.map(visit)];
    leaves++;
    return [node.kind, node.getText(source)];
  }
  return { tree: visit(source), nodes, leaves };
}
const source = entries.map(entry => {
  assert.equal(sha(entry.text), entry.sha256);
  const first = originalReport.source.find(file => file.path === entry.path);
  assert.equal(first.sha256, entry.sha256);
  const current = fs.readFileSync(entry.path, 'utf8');
  assert.equal(current.split(entry.after).length, 2);
  assert.equal(current.replace(entry.after, entry.before), entry.text);
  const A = tree(entry.text, entry.path), B = tree(current, entry.path);
  assert.deepEqual(B, A);
  assert.equal(A.nodes, first.tokenTreeNodes);
  assert.equal(A.leaves, first.noncommentLeaves);
  const outputs = [ts.ModuleKind.ESNext, ts.ModuleKind.CommonJS].map(module => {
    const emit = text => ts.transpileModule(text, {
      fileName: entry.path, compilerOptions: { target: ts.ScriptTarget.ES2022, module, removeComments: true },
    }).outputText;
    const old = emit(entry.text), output = emit(current);
    assert.equal(output, old);
    assert.equal(sha(output), first.outputs.find(item => item.module === ts.ModuleKind[module]).sha256);
    return { module: ts.ModuleKind[module], wholeRawSame: true, sha256: sha(output) };
  });
  first.prefinalSHA256 = entry.sha256;
  first.sha256 = sha(current);
  first.finalPrecisionEdits = 1;
  return { path: entry.path, prefinalSHA256: entry.sha256, sha256: sha(current), exactWholeSourceCommentInverseSame: true,
    fullNoncommentTokenTreeSame: true, tokenTreeNodes: A.nodes, noncommentLeaves: A.leaves, outputs };
});
originalReport.finalPrecisionCommentEdits = entries.length;
originalReport.precisionBridge = prefix + 'peer-comment-proof.json';
originalReport.summary.wholeRawOutputs = 10;
// 原九源全程序报告保持采样字节，桥单独连接最终SHA。
fs.writeFileSync(prefix + 'peer-comment-proof.json', JSON.stringify({ source, wholeOutputs: source.length * 2, mismatches: 0 }, null, 2) + '\n');
process.stdout.write(JSON.stringify({ preciseComments: entries.length, tokenNodes: source.reduce((n, file) => n + file.tokenTreeNodes, 0), wholeOutputs: source.length * 2, mismatches: 0 }) + '\n');
