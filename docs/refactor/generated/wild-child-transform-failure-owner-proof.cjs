/** 负责核本族失败政策的明确增量与原完整正文；不运行游戏、测试或架构门禁。 */
const fs = require('node:fs');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const ts = require('../../../backend/node_modules/typescript');
const prefix = 'docs/refactor/generated/wild-child-transform-failure-owner-';
const sha = x => crypto.createHash('sha256').update(x).digest('hex');
const baseline = JSON.parse(fs.readFileSync(prefix + 'before.json', 'utf8'));
const edit = JSON.parse(fs.readFileSync(prefix + 'edits.json', 'utf8'));
const paths = JSON.parse(fs.readFileSync(prefix + 'paths.json', 'utf8'));
const original = baseline.source[0].text;
const current = fs.readFileSync(edit.path, 'utf8');
let forward = original, inverse = current;
for (const x of edit.edits) forward = forward.replace(x.before, x.after);
for (const x of [...edit.edits].reverse()) inverse = inverse.replace(x.after, x.before);
assert.equal(forward, current);
assert.equal(inverse, original);
assert.equal(sha(original), baseline.source[0].sha256);
for (const x of baseline.controls) assert.equal(sha(fs.readFileSync(x.path)), x.sha256);
const parse = text => ts.createSourceFile('literal.ts', text, ts.ScriptTarget.Latest, true);
let nodes = 0, leaves = 0;
// 只比较实际语法节点、叶文本及 NodeArray；说明与空白不作为原行为身份。
function tree(node, source) {
  nodes++;
  const children = [];
  ts.forEachChild(node, child => {
    if (child.kind < ts.SyntaxKind.FirstJSDocNode || child.kind > ts.SyntaxKind.LastJSDocNode)
      children.push(tree(child, source));
  }, array => {
    children.push(['NodeArray', ...array.filter(x => x.kind < ts.SyntaxKind.FirstJSDocNode || x.kind > ts.SyntaxKind.LastJSDocNode).map(x => tree(x, source))]);
  });
  if (!children.length) { leaves++; return [node.kind, node.getText(source)]; }
  return [node.kind, ...children];
}
const oldSource = parse(original), newSource = parse(current);
const functions = source => source.statements.filter(ts.isFunctionDeclaration);
const altered = new Set(['installWildChild', 'validWildChildIdentity', 'resolveWildChildDeathWave']);
const retained = [];
for (const old of functions(oldSource)) {
  if (altered.has(old.name.text)) continue;
  const actual = functions(newSource).find(x => x.name.text === old.name.text);
  assert.ok(actual);
  assert.deepEqual(tree(old.body, oldSource), tree(actual.body, newSource));
  retained.push(old.name.text);
}
const resolve = functions(newSource).find(x => x.name.text === 'resolveWildChildDeathWave');
const core = resolve.body.statements.find(ts.isTryStatement);
assert.ok(core);
const oldCore = parse(edit.oldCore);
assert.deepEqual(tree(oldCore, oldCore), tree(parse(core.tryBlock.statements.map(x => x.getText(newSource)).join('\n')), parse(core.tryBlock.statements.map(x => x.getText(newSource)).join('\n'))));
// 核心 catch 只有先写失败标记、再抛原 catch 变量；完整 transformed push 保持在 try 后。
assert.equal(core.catchClause.block.statements.length, 2);
assert.equal(core.catchClause.block.statements[0].getText(newSource), 'failedTransformations.add(b);');
assert.equal(core.catchClause.block.statements[1].getText(newSource), 'throw error;');
const position = resolve.body.statements.indexOf(core);
assert.equal(resolve.body.statements[position + 1].expression.expression.getText(newSource), 'events.push');
const coreText = core.tryBlock.statements.map(x => x.getText(newSource)).join('\n');
const outputs = [];
for (const [name, module] of [['ES', ts.ModuleKind.ESNext], ['CJS', ts.ModuleKind.CommonJS]]) {
  const emit = text => ts.transpileModule(text, { compilerOptions: { target: ts.ScriptTarget.ES2022, module, removeComments: true } }).outputText;
  assert.equal(emit(inverse), emit(original));
  assert.equal(emit(edit.oldCore), emit(coreText));
  outputs.push({ module: name, inverseWholeSame: true, coreBodySame: true, actualWholeSame: emit(current) === emit(original) });
}
const source = paths.map(path => ({ path, sha256: sha(fs.readFileSync(path)) }));
const report = {
  baseCommit: baseline.baseCommit, source, deleted: [],
  exactWholeForwardInverse: true, exactEdits: edit.edits.length,
  originalCoreStatements: oldCore.statements.length,
  coreStatementsUnchanged: true, catchWritesThenThrowsOriginal: true, transformedFactOutsideCore: true,
  retainedCompleteFunctionBodies: retained, cumulativeTypedNodes: nodes, cumulativeASTLeaves: leaves,
  outputs, controls: baseline.controls.map(({ text, ...x }) => x),
  limits: ['F04 deliberately adds failed-owner state and a catch boundary; actual full JS differs.', 'No independent all-repo token inventory, cold-module graph or all gifted ability authorization claim.', 'Camp sole-source migration and Role.camp retirement are outside this batch.'],
};
fs.writeFileSync(prefix + 'proof.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report));
