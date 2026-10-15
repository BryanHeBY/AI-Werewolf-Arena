/**
 * 负责只注释批次的完整程序证据；输入为实际 Git 原文、精确变换及冻结源码。
 * 输出逐文件正逆、含类型语法／叶文本／NodeArray、受保护说明和完整双格式输出对照。
 * 不加载生产模块，不运行类型检查、业务测试或门禁；词项头检查由独立准备器执行。
 */
const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');
const { createHash } = require('node:crypto');
const ts = require(path.join(process.cwd(), 'backend/node_modules/typescript'));
const prefix = 'docs/refactor/generated/board-ruleset-chinese-contracts';
const read = suffix => JSON.parse(fs.readFileSync(prefix + suffix + '.json', 'utf8'));
const hash = value => createHash('sha256').update(value).digest('hex');
const ensure = (value, label) => { if (!value) throw Error(label); };
const before = read('-before'), edits = read('-edits'), ready = read('-source-ready');
const exact = (text, old, next, label) => {
  ensure(old.length > 0 && text.split(old).length === 2, 'exact_occurrence:' + label);
  return text.replace(old, () => next);
};
const isDoc = node => node.kind >= ts.SyntaxKind.FirstJSDocNode && node.kind <= ts.SyntaxKind.LastJSDocNode;
function program(file, text) {
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  ensure(source.parseDiagnostics.length === 0, 'parse:' + file);
  const tree = [], leaves = [], arrays = [], docs = [], directives = [];
  function physical(node) {
    if (isDoc(node)) return;
    const children = node.getChildren(source).filter(child => !isDoc(child));
    tree.push([node.kind, children.length]);
    if (children.length === 0) leaves.push([node.kind, node.getText(source)]);
    for (const child of children) physical(child);
  }
  function typed(node) {
    if (isDoc(node)) return;
    for (const doc of node.jsDoc ?? []) {
      for (const tag of doc.tags ?? []) docs.push({
        tag: tag.tagName.getText(source),
        name: tag.name?.getText(source) ?? null,
        type: tag.typeExpression?.getText(source) ?? null,
        typeParameters: tag.typeParameters?.map(part => part.getText(source)) ?? null,
        isBracketed: tag.isBracketed ?? null,
      });
    }
    ts.forEachChild(node, child => { typed(child); }, children => {
      arrays.push([children.length, children.hasTrailingComma === true]);
      for (const child of children) typed(child);
    });
  }
  physical(source); typed(source);
  // 工具／许可证说明按原整行保留；普通维护说明的正文变化已由精确记录独立列出。
  for (const line of text.split('\n')) if (/^\s*(?:\/\/\/|\/\/\s*@(?:ts-|jsx|license)|\/\*\s*(?:@(?:ts-|jsx|license)|eslint|prettier)|\*?\s*(?:Copyright\b|SPDX\b|Licensed\b))/i.test(line)) directives.push(line);
  const shape = { tree, leaves, arrays, docs, directives };
  return { shape, metrics: { syntaxNodesExcludingJSDoc: tree.length, syntaxLeavesExcludingJSDoc: leaves.length, nodeArrays: arrays.length, protectedJsDocTags: docs.length, protectedDirectiveLines: directives.length } };
}
function emit(file, text, module) {
  return ts.transpileModule(text, { fileName: file, compilerOptions: {
    module, target: ts.ScriptTarget.ES2022, removeComments: true,
    sourceMap: false, inlineSourceMap: false, declaration: false,
  } }).outputText;
}
const rows = [];
for (const original of before.source) {
  const file = original.path, current = fs.readFileSync(file, 'utf8');
  const frozen = ready.source.find(row => row.path === file);
  ensure(frozen && hash(current) === frozen.sha256, 'ready:' + file);
  ensure(hash(original.text) === original.sha256, 'captured_hash:' + file);
  ensure(cp.execFileSync('git', ['cat-file', 'blob', before.baseCommit + ':' + file], { encoding: 'utf8' }) === original.text, 'actual_git:' + file);
  const changes = edits.edits.filter(row => row.path === file);
  ensure(changes.length > 0, 'missing_edits:' + file);
  let forward = original.text;
  for (const change of changes) forward = exact(forward, change.before, change.after, file);
  ensure(forward === current, 'complete_forward:' + file);
  let inverse = current;
  for (const change of [...changes].reverse()) inverse = exact(inverse, change.after, change.before, file);
  ensure(inverse === original.text, 'complete_inverse:' + file);
  const oldProgram = program(file, original.text), newProgram = program(file, current);
  ensure(JSON.stringify(oldProgram.shape) === JSON.stringify(newProgram.shape), 'complete_program:' + file);
  const outputs = [];
  for (const [name, module] of [['ESNext', ts.ModuleKind.ESNext], ['CommonJS', ts.ModuleKind.CommonJS]]) {
    const oldOutput = emit(file, original.text, module), newOutput = emit(file, current, module);
    ensure(oldOutput === newOutput, 'actual_complete_emit:' + name + ':' + file);
    outputs.push({ module: name, bytes: Buffer.byteLength(oldOutput), beforeSHA256: hash(oldOutput), afterSHA256: hash(newOutput), rawEqual: true });
  }
  rows.push({ path: file, beforeSHA256: original.sha256, sha256: frozen.sha256, exactCommentEditRecords: changes.length, ...oldProgram.metrics, completeForward: true, completeInverse: true, completeTypedProgramAndLeafTexts: true, nodeArraysEqual: true, protectedJsDocAndDirectiveEqual: true, outputs });
}
const controls = [];
for (const control of before.controls) {
  ensure(hash(control.text) === control.sha256, 'control_capture:' + control.path);
  ensure(fs.readFileSync(control.path, 'utf8') === control.text, 'control_current:' + control.path);
  ensure(cp.execFileSync('git', ['cat-file', 'blob', before.baseCommit + ':' + control.path], { encoding: 'utf8' }) === control.text, 'control_git:' + control.path);
  controls.push({ path: control.path, sha256: control.sha256, actualGitAndCurrentEqual: true });
}
const total = key => rows.reduce((sum, row) => sum + row[key], 0);
const report = {
  approved: true, baseCommit: before.baseCommit, sourceReadySHA256: hash(fs.readFileSync(prefix + '-source-ready.json')),
  sourceCount: rows.length, commentEditRecords: edits.edits.length,
  syntaxNodesExcludingJSDoc: total('syntaxNodesExcludingJSDoc'), syntaxLeavesExcludingJSDoc: total('syntaxLeavesExcludingJSDoc'), nodeArrays: total('nodeArrays'),
  protectedJsDocTags: total('protectedJsDocTags'), protectedDirectiveLines: total('protectedDirectiveLines'),
  wholeRawOutputs: rows.length * 2, source: rows, controls,
  limits: ['58 个完整实际程序；语法节点、叶文本和 NodeArray 不比较偏移／说明正文，但类型、字符串、顺序和受保护 tag 保留。', '每源比较原文与当前源码实际完整 ESNext／CommonJS 输出，不是片段或同形镜像。', '不运行类型、业务、配置接受面、模型或完整门禁；语义与中文准确性仍须独立源码审查。', '注释会自然改变新构建来源指纹，不豁免严格档案身份或重写历史指纹。'],
};
fs.writeFileSync(prefix + '-proof.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ source: report.sourceCount, edits: report.commentEditRecords, nodes: report.syntaxNodesExcludingJSDoc, leaves: report.syntaxLeavesExcludingJSDoc, arrays: report.nodeArrays, outputs: report.wholeRawOutputs, controls: controls.length }));
