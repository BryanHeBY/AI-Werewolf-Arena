/** 只核独审指出的孤女特例单注释精度修订；读首绿完整现源快照，不复执行先前检查。 */
const fs = require('node:fs'), assert = require('node:assert/strict'), crypto = require('node:crypto');
const ts = require('../../../backend/node_modules/typescript');
const pre = 'docs/refactor/generated/player-checkpoint-chinese-contracts-';
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
const before = JSON.parse(fs.readFileSync(pre + 'peer-comment-before.json', 'utf8'));
const old = before.source.text, current = fs.readFileSync(before.source.path, 'utf8');
assert.equal(sha(old), before.source.sha256); assert.equal(sha(current), before.finalSHA256);
assert.equal(old.split(before.comment.before).length - 1, 1);
assert.equal(current, old.replace(before.comment.before, before.comment.after));
function shape(text) {
  const s = ts.createSourceFile('snapshot.ts', text, ts.ScriptTarget.Latest, true);
  assert.deepEqual(s.parseDiagnostics, []); let nodes = 0, leaves = 0;
  function tree(n) { if (n.kind >= ts.SyntaxKind.FirstJSDocNode && n.kind <= ts.SyntaxKind.LastJSDocNode) return null;
    nodes++; const c = []; ts.forEachChild(n, x => { c.push(tree(x)); }, a => { c.push(['array', a.length, !!a.hasTrailingComma, ...a.map(tree)]); }); return [n.kind, c]; }
  function tokens(n) { if (n.kind >= ts.SyntaxKind.FirstJSDocNode && n.kind <= ts.SyntaxKind.LastJSDocNode) return null;
    const c = n.getChildren(s).filter(x => x.kind < ts.SyntaxKind.FirstJSDocNode || x.kind > ts.SyntaxKind.LastJSDocNode);
    if (!c.length) { leaves++; return [n.kind, n.getText(s)]; } return [n.kind, c.map(tokens)]; }
  const typed = tree(s), token = tokens(s); return { typed, token, nodes, leaves };
}
const a = shape(old), b = shape(current); assert.deepEqual(b, a);
const outputs = [ts.ModuleKind.ESNext, ts.ModuleKind.CommonJS].map(module => {
  const emit = text => ts.transpileModule(text, { compilerOptions: { target: ts.ScriptTarget.ES2022, module, removeComments: true } }).outputText;
  const raw = emit(old); assert.equal(emit(current), raw); return { module: ts.ModuleKind[module], wholeRawSame: true, sha256: sha(raw) };
});
assert.equal(current.slice(0, current.indexOf('*/') + 2), old.slice(0, old.indexOf('*/') + 2));
const report = { source: [{ path: before.source.path, beforeSHA256: before.source.sha256, sha256: sha(current) }], preciseCommentEdits: 1,
  wholeTypedAndTokenTreeSame: true, typedNodes: b.nodes, noncommentLeaves: b.leaves, outputs, responsibilityHeadUnchanged: true,
  meaning: '保留已有孤女专属归一输出和两次查询；普通分支仍完整克隆私有容器，不将其替成玩家观察。',
  limits: ['桥只承接首绿到末字节的单注释精度修订，未重跑原证明、职责头、类型、行为或全门禁。'] };
fs.writeFileSync(pre + 'peer-comment-bridge.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ source: report.source, typedNodes: b.nodes, noncommentLeaves: b.leaves, outputs }));
