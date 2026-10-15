/**
 * 负责本批75完整程序的纯注释来源、非注释语法及整转译输出核验。输入固定Git全文前样、178精确记录和source-ready；
 * 输出正逆、AST／NodeArray／叶文本、受保护指令与150份ES/CJS比较，不加载生产或执行类型／业务。
 */
const fs = require('node:fs');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const ts = require('../../../backend/node_modules/typescript');
const prefix = 'docs/refactor/generated/mechanism-contracts-chinese-maintenance-';
const before = JSON.parse(fs.readFileSync(prefix + 'before.json', 'utf8'));
const edits = JSON.parse(fs.readFileSync(prefix + 'edits.json', 'utf8'));
const ready = JSON.parse(fs.readFileSync(prefix + 'source-ready.json', 'utf8'));
const sha = (text) => createHash('sha256').update(text).digest('hex');
function parse(text, path) {
  const source = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  assert.deepEqual(source.parseDiagnostics, [], 'parse:' + path);
  return source;
}
function program(text, path) {
  const source = parse(text, path);
  let nodes = 0, arrays = 0;
  function walk(node) {
    nodes++;
    const children = [];
    ts.forEachChild(node, (child) => { children.push(walk(child)); }, (array) => {
      arrays++;
      children.push(['array', array.length, !!array.hasTrailingComma, ...array.map(walk)]);
    });
    return [node.kind, children];
  }
  const typed = walk(source), leaves = [];
  function tokenTree(node) {
    const children = node.getChildren(source).filter((child) =>
      child.kind < ts.SyntaxKind.FirstJSDocNode || child.kind > ts.SyntaxKind.LastJSDocNode);
    if (!children.length) {
      const leaf = [node.kind, node.getText(source)]; leaves.push(leaf); return leaf;
    }
    return [node.kind, children.map(tokenTree)];
  }
  const completeNoncommentTree = tokenTree(source), jsdocTypesAndTags = [];
  function docs(node) {
    for (const doc of node.jsDoc ?? []) {
      for (const tag of doc.tags ?? []) {
        jsdocTypesAndTags.push({kind: tag.kind, name: tag.tagName.getText(source),
          nameNode: tag.name?.getText(source) ?? null,
          typeExpression: tag.typeExpression?.getText(source) ?? null,
          typeParameters: tag.typeParameters?.map((p) => p.getText(source)) ?? null});
      }
      if (doc.typeExpression) jsdocTypesAndTags.push({typeExpression: doc.typeExpression.getText(source)});
    }
    ts.forEachChild(node, (child) => { docs(child); });
  }
  docs(source);
  return {typed, completeNoncommentTree, nodes, arrays, leaves, jsdocTypesAndTags};
}
function protectedComments(text, path) {
  const source = parse(text, path), ranges = new Map();
  function add(items) { for (const item of items ?? []) ranges.set(item.pos, item); }
  function walk(node) {
    add(ts.getLeadingCommentRanges(text, node.getFullStart()));
    add(ts.getTrailingCommentRanges(text, node.end));
    for (const child of node.getChildren(source)) walk(child);
  }
  walk(source);
  const result = [...ranges.values()].sort((a,b) => a.pos-b.pos)
    .map((range) => text.slice(range.pos, range.end))
    .filter((value) => /@(?:ts-|jsx|license)|SPDX|copyright|eslint|prettier|noinspection|<reference|istanbul|\bc8\b/i.test(value));
  if (text.startsWith('#!')) result.unshift(text.split('\n', 1)[0]);
  return result;
}
assert.equal(before.source.length, 75);
assert.equal(edits.source.length, 75);
assert.equal(ready.source.length, 75);
assert.equal(sha(fs.readFileSync(prefix + 'before.json')), ready.before.sha256);
assert.equal(sha(fs.readFileSync(prefix + 'edits.json')), ready.edits.sha256);
assert.deepEqual(edits.source.map((entry) => entry.path), before.source.map((entry) => entry.path));
assert.deepEqual(ready.source.map((entry) => entry.path), before.source.map((entry) => entry.path));
const programs = before.source.map((original, index) => {
  const entry = edits.source[index], current = fs.readFileSync(original.path, 'utf8');
  assert.equal(sha(original.text), original.sha256);
  assert.equal(entry.beforeSHA256, original.sha256);
  assert.equal(sha(current), entry.afterSHA256);
  assert.equal(sha(current), ready.source[index].sha256);
  assert.equal(Buffer.byteLength(current), ready.source[index].bytes);
  let forward = original.text;
  const positions = [];
  for (const edit of entry.edits) {
    let position;
    if (edit.operation === 'prepend') {
      assert.equal(edit.before, ''); position = 0;
    } else {
      assert.notEqual(edit.before, '');
      assert.equal(forward.split(edit.before).length, 2, original.path + ':' + edit.label);
      position = forward.indexOf(edit.before);
    }
    positions.push(position);
    forward = forward.slice(0, position) + edit.after + forward.slice(position + edit.before.length);
  }
  assert.equal(forward, current, 'whole_forward:' + original.path);
  let inverse = current;
  for (let i = entry.edits.length - 1; i >= 0; i--) {
    const edit = entry.edits[i], position = positions[i];
    assert.equal(inverse.slice(position, position + edit.after.length), edit.after);
    inverse = inverse.slice(0, position) + edit.before + inverse.slice(position + edit.after.length);
  }
  assert.equal(inverse, original.text, 'whole_inverse:' + original.path);
  const a = program(original.text, original.path), b = program(current, original.path);
  assert.deepEqual(b, a, 'complete_noncomment_program:' + original.path);
  const protectedBefore = protectedComments(original.text, original.path);
  assert.deepEqual(protectedComments(current, original.path), protectedBefore);
  const outputs = [ts.ModuleKind.ESNext, ts.ModuleKind.CommonJS].map((module) => {
    const emit = (text) => ts.transpileModule(text, {fileName: original.path,
      compilerOptions: {target: ts.ScriptTarget.ES2022, module, removeComments: true}}).outputText;
    const oldOutput = emit(original.text), actual = emit(current);
    assert.equal(actual, oldOutput, 'whole_emit:' + original.path + ':' + module);
    return {module: ts.ModuleKind[module], wholeRawSame: true, bytes: Buffer.byteLength(actual), sha256: sha(actual)};
  });
  return {path: original.path, beforeSHA256: original.sha256, afterSHA256: sha(current),
    exactCommentEdits: entry.edits.length, wholeForwardInverse: true,
    completeTypedAndTokenTreeSame: true, typedNodes: a.nodes, nodeArrays: a.arrays,
    noncommentLeaves: a.leaves.length, jsdocTypesAndTags: a.jsdocTypesAndTags.length,
    protectedComments: protectedBefore.length, outputs};
});
for (const control of before.controls) assert.equal(sha(fs.readFileSync(control.path)), control.sha256, control.path);
const summary = {sources: programs.length, exactCommentEdits: programs.reduce((n,p) => n+p.exactCommentEdits,0),
  typedNodes: programs.reduce((n,p) => n+p.typedNodes,0), nodeArrays: programs.reduce((n,p) => n+p.nodeArrays,0),
  noncommentLeaves: programs.reduce((n,p) => n+p.noncommentLeaves,0), jsdocTypesAndTags: programs.reduce((n,p) => n+p.jsdocTypesAndTags,0),
  protectedComments: programs.reduce((n,p) => n+p.protectedComments,0), wholeRawOutputs: programs.length*2};
assert.equal(summary.exactCommentEdits, ready.exactCommentEdits);
const result = {approved: true, baseCommit: before.baseCommit,
  sampledSourceReadySHA256: sha(fs.readFileSync(prefix + 'source-ready.json')), programs,
  controls: before.controls.map(({text,...entry}) => entry), summary,
  countConvention: 'AST／NodeArray／非注释叶为每个前态完整程序各计一次的累计；与后态逐项深比，不把两侧或递归次数冒distinct源码数。',
  limits: ['75完整TS程序的AST/NodeArray顺序及trailingComma、完整非注释token树/叶文本、JSDoc类型/tag名和受保护原文保持；150份ESNext/CommonJS移除注释整输出相同。',
    '没有类型检查、生产加载、行为测试、全门禁或模型调用；只转译实际源码文本。',
    '完整精确正逆证明注释变换来源，不替代对中文语义及真实调用方的人工审查。',
    '注释改变新构建sourceHash；不重写历史字段、指纹或精确内部档案兼容政策。']};
fs.writeFileSync(prefix + 'proof.json', JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(summary));
