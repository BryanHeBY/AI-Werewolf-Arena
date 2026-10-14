/** 仅核两个参数／指纹源的24项中文注释完整正逆、全非注释程序与输出；不调用模型或重跑业务。 */
const fs = require('node:fs'), cp = require('node:child_process'), assert = require('node:assert/strict'), crypto = require('node:crypto');
const ts = require('../../../backend/node_modules/typescript');
const pre = 'docs/refactor/generated/parameters-fingerprint-chinese-contracts-';
const read = p => fs.readFileSync(p, 'utf8'), sha = x => crypto.createHash('sha256').update(x).digest('hex');
const before = JSON.parse(read(pre + 'before.json')), edits = JSON.parse(read(pre + 'edits.json'));
function shape(text) {
  const source = ts.createSourceFile('transport.ts', text, ts.ScriptTarget.Latest, true);
  assert.deepEqual(source.parseDiagnostics, []); let nodes = 0, leaves = 0;
  function tree(n) { if (n.kind >= ts.SyntaxKind.FirstJSDocNode && n.kind <= ts.SyntaxKind.LastJSDocNode) return null;
    nodes++; const c = []; ts.forEachChild(n, x => { c.push(tree(x)); }, a => { c.push(['array', a.length, !!a.hasTrailingComma, ...a.map(tree)]); }); return [n.kind, c]; }
  function tokens(n) { if (n.kind >= ts.SyntaxKind.FirstJSDocNode && n.kind <= ts.SyntaxKind.LastJSDocNode) return null;
    const c = n.getChildren(source).filter(x => x.kind < ts.SyntaxKind.FirstJSDocNode || x.kind > ts.SyntaxKind.LastJSDocNode);
    if (!c.length) { leaves++; return [n.kind, n.getText(source)]; } return [n.kind, c.map(tokens)]; }
  const typed = tree(source), token = tokens(source); return { typed, token, nodes, leaves };
}
const sources = before.source.map(row => {
  const original = cp.execFileSync('git', ['show', before.baseCommit + ':' + row.path]).toString();
  assert.equal(original, row.text); assert.equal(sha(original), row.sha256);
  const current = read(row.path); let forward = original;
  for (const e of edits[row.path]) { assert.equal(forward.split(e.before).length - 1, e.count); forward = forward.replace(e.before, e.after); }
  assert.equal(forward, current); let inverse = current;
  for (const e of [...edits[row.path]].reverse()) { assert.equal(inverse.split(e.after).length - 1, e.count); inverse = inverse.replace(e.after, e.before); }
  assert.equal(inverse, original);
  const a = shape(original), b = shape(current); assert.deepEqual(b, a);
  const outputs = [ts.ModuleKind.ESNext, ts.ModuleKind.CommonJS].map(module => {
    const emit = text => ts.transpileModule(text, { compilerOptions: { target: ts.ScriptTarget.ES2022, module, removeComments: true } }).outputText;
    const raw = emit(original); assert.equal(emit(current), raw); return { module: ts.ModuleKind[module], wholeRawSame: true, sha256: sha(raw) };
  });
  return { path: row.path, beforeSHA256: row.sha256, sha256: sha(current), commentRecords: edits[row.path].length,
    wholeExactForwardInverse: true, wholeTypedAndTokenSame: true, typedNodes: b.nodes, noncommentLeaves: b.leaves, outputs };
});
const controls = before.controls.map(row => { const original = cp.execFileSync('git', ['show', before.baseCommit + ':' + row.path]);
  assert.equal(sha(original), row.sha256); assert.ok(original.equals(fs.readFileSync(row.path))); return { ...row, wholeGitCurrentSame: true }; });
const report = { baseCommit: before.baseCommit, source: sources, controls,
  limits: ['两个首职责头和重要结构／顺序均仅注释；参数校验、配置绑定、枚举与哈希算法保持。',
    '运行栈行号与新sourceHash自然变化，历史归档身份保留；不宣称任意外部反射字节相同。',
    '只核完整源码与两现存控制源，不执行类型、业务、SDK请求、模型或全架构门禁。'] };
fs.writeFileSync(pre + 'proof.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ source: sources.map(({ outputs, ...row }) => row), rawOutputs: 4, controls: controls.length }));
