/** 只核独审两源三个消息映射注释精度修改的完整程序桥；不复执行首绿证明或头检查。 */
const fs = require('node:fs'), assert = require('node:assert/strict'), crypto = require('node:crypto');
const ts = require('../../../backend/node_modules/typescript');
const pre = 'docs/refactor/generated/sdk-transport-chinese-contracts-';
const before = JSON.parse(fs.readFileSync(pre + 'peer-comment-before.json', 'utf8'));
const sha = x => crypto.createHash('sha256').update(x).digest('hex');
function shape(text) {
  const s = ts.createSourceFile('transport.ts', text, ts.ScriptTarget.Latest, true); assert.deepEqual(s.parseDiagnostics, []);
  let nodes = 0, leaves = 0;
  function tree(n) { if (n.kind >= ts.SyntaxKind.FirstJSDocNode && n.kind <= ts.SyntaxKind.LastJSDocNode) return null;
    nodes++; const c = []; ts.forEachChild(n, x => { c.push(tree(x)); }, a => { c.push(['array', a.length, !!a.hasTrailingComma, ...a.map(tree)]); }); return [n.kind, c]; }
  function tokens(n) { if (n.kind >= ts.SyntaxKind.FirstJSDocNode && n.kind <= ts.SyntaxKind.LastJSDocNode) return null;
    const c = n.getChildren(s).filter(x => x.kind < ts.SyntaxKind.FirstJSDocNode || x.kind > ts.SyntaxKind.LastJSDocNode);
    if (!c.length) { leaves++; return [n.kind, n.getText(s)]; } return [n.kind, c.map(tokens)]; }
  const typed = tree(s), token = tokens(s); return { typed, token, nodes, leaves };
}
const source = before.source.map(row => {
  const current = fs.readFileSync(row.path, 'utf8'); assert.equal(sha(row.text), row.sha256); let forward = row.text;
  for (const e of before.edits[row.path]) { assert.equal(forward.split(e.before).length - 1, e.count); forward = forward.replace(e.before, e.after); }
  assert.equal(forward, current); const a = shape(row.text), b = shape(current); assert.deepEqual(b, a);
  const outputs = [ts.ModuleKind.ESNext, ts.ModuleKind.CommonJS].map(module => {
    const emit = text => ts.transpileModule(text, { compilerOptions: { target: ts.ScriptTarget.ES2022, module, removeComments: true } }).outputText;
    const raw = emit(row.text); assert.equal(emit(current), raw); return { module: ts.ModuleKind[module], wholeRawSame: true, sha256: sha(raw) };
  });
  return { path: row.path, beforeSHA256: row.sha256, sha256: sha(current), preciseCommentRecords: before.edits[row.path].length,
    wholeTypedAndTokenSame: true, typedNodes: b.nodes, noncommentLeaves: b.leaves, outputs };
});
const report = { source, meaning: before.meaning, limits: ['仅承接首绿到末两源的三个注释精度修改，未复执行旧证明、职责头、类型、行为、SDK或全门禁。'] };
fs.writeFileSync(pre + 'peer-comment-bridge.json', JSON.stringify(report, null, 2) + '\n'); console.log(JSON.stringify(report));
