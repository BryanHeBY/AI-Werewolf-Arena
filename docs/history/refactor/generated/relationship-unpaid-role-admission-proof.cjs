/** 读取八源冻结输入；完整逆演七原程序与新 unit 阶段，核原纯 current／已付闭包／默认表达式，不加载生产或运行类型／业务。 */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const cp = require('node:child_process');
const root = process.cwd(), prefix = 'docs/refactor/generated/relationship-unpaid-role-admission-';
const ts = require(path.join(root, 'backend/node_modules/typescript'));
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
const read = name => JSON.parse(fs.readFileSync(prefix + name, 'utf8'));
const before = read('before.json'), first = read('source-ready.json'), ready = read('source-ready-reflect.json');
const originalEdits = read('edits.json').edits, reflectEdits = read('reflect-edits.json').edits;
const reflectBefore = read('reflect-before.json'), unitDelta = read('reflect-unit-edits.json');
const fail = message => { throw new Error(message); };
const count = (text, part) => text.split(part).length - 1;
function replace(text, edit, inverse) {
  const from = inverse ? edit.after : edit.before, to = inverse ? edit.before : edit.after;
  if (edit.operation === 'append-after-original-eof') {
    if (inverse) { if (!text.endsWith(from)) fail('append_inverse_anchor'); return text.slice(0, -from.length); }
    return text + to;
  }
  if (!from || count(text, from) !== edit.count) fail('exact_edit_count:' + (edit.path || unitDelta.path));
  return text.split(from).join(to);
}
function transform(text, edits, inverse) {
  for (const edit of inverse ? [...edits].reverse() : edits) text = replace(text, edit, inverse);
  return text;
}
const current = new Map(ready.source.map(entry => {
  const text = fs.readFileSync(entry.path, 'utf8');
  if (sha(text) !== entry.sha256) fail('frozen_source_drift:' + entry.path);
  return [entry.path, text];
}));
function parse(file, text) {
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  if (source.parseDiagnostics.length) fail('parse_diagnostics:' + file);
  return source;
}
function program(file, text) {
  const source = parse(file, text), totals = { typedNodes: 0, nodeArrays: 0, leaves: 0 };
  function walk(node) {
    if (node.kind >= ts.SyntaxKind.FirstJSDocNode && node.kind <= ts.SyntaxKind.LastJSDocNode) return null;
    totals.typedNodes++;
    const children = [];
    ts.forEachChild(node, child => { const value = walk(child); if (value) children.push(value); }, array => {
      totals.nodeArrays++;
      children.push(['NodeArray', ...array.map(walk).filter(Boolean)]);
    });
    if (!children.length) { totals.leaves++; return [node.kind, node.getText(source)]; }
    return [node.kind, children];
  }
  return { tree: walk(source), totals };
}
const tags = (file, text) => {
  const source = parse(file, text), output = [];
  function walk(node) {
    for (const doc of node.jsDoc || []) for (const tag of doc.tags || []) output.push(tag.getText(source));
    ts.forEachChild(node, child => { walk(child); });
  }
  walk(source);
  output.push(...(text.match(/^.*(?:@ts-(?:expect-error|ignore|nocheck)|eslint-|SPDX-License-Identifier|\/\/\/[ \t]*<reference).*$/gm) || []));
  return output;
};
const emit = (file, text, module) => ts.transpileModule(text, { fileName: file, compilerOptions: { target: ts.ScriptTarget.ES2022, module, removeComments: true } }).outputText;
const programs = [], outputs = [], aggregate = { typedNodes: 0, nodeArrays: 0, leaves: 0 };
for (const row of before.source) {
  const git = cp.execFileSync('git', ['cat-file', 'blob', before.baseCommit + ':' + row.path]);
  if (sha(git) !== row.sha256 || git.toString('utf8') !== row.text) fail('actual_git_before:' + row.path);
  const edits = originalEdits.filter(edit => edit.path === row.path), delta = reflectEdits.filter(edit => edit.path === row.path);
  const firstText = transform(row.text, edits, false), after = transform(firstText, delta, false);
  if (after !== current.get(row.path)) fail('whole_forward:' + row.path);
  const inverse = transform(transform(after, delta, true), edits, true);
  if (inverse !== row.text) fail('whole_inverse:' + row.path);
  const old = program(row.path, row.text), restored = program(row.path, inverse);
  if (JSON.stringify(old.tree) !== JSON.stringify(restored.tree)) fail('program_tree:' + row.path);
  for (const key of Object.keys(aggregate)) aggregate[key] += old.totals[key];
  if (JSON.stringify(tags(row.path, row.text)) !== JSON.stringify(tags(row.path, after))) fail('protected_tag:' + row.path);
  programs.push({ path: row.path, beforeSHA256: row.sha256, finalSHA256: sha(after), exactInitialEdits: edits.length, exactReflectEdits: delta.length, ...old.totals });
  for (const module of [ts.ModuleKind.ESNext, ts.ModuleKind.CommonJS]) {
    const original = emit(row.path, row.text, module), inverseEmit = emit(row.path, inverse, module), actual = emit(row.path, after, module);
    if (original !== inverseEmit) fail('whole_emit:' + row.path);
    outputs.push({ path: row.path, module, originalSHA256: sha(original), inverseSHA256: sha(inverseEmit), actualSHA256: sha(actual), inverseSame: true, actualSame: actual === original });
  }
}
const unit = unitDelta.path;
let unitText = transform(current.get(unit), unitDelta.edits, true);
if (unitText !== unitDelta.beforeText || sha(unitText) !== unitDelta.beforeSHA256) fail('unit_delta_inverse');
unitText = transform(unitText, reflectEdits.filter(edit => edit.path === unit), true);
const initialUnit = reflectBefore.source.find(row => row.path === unit);
if (unitText !== initialUnit.text || sha(unitText) !== initialUnit.sha256) fail('unit_reflect_inverse');
if (sha(unitText) !== first.source.find(row => row.path === unit).sha256) fail('first_unit_source');
parse(unit, current.get(unit));
const protectedPrograms = [];
function declarations(file, text, name, mode) {
  const source = parse(file, text), matches = [];
  function walk(node) {
    if (mode === 'variable' && ts.isVariableDeclaration(node) && node.name.getText(source) === name && node.initializer) matches.push(node.initializer.getText(source));
    if (mode === 'function' && ts.isFunctionDeclaration(node) && node.name?.text === name && node.body) matches.push(node.getText(source));
    ts.forEachChild(node, child => { walk(child); });
  }
  walk(source);
  if (matches.length !== 1) fail('protected_unique:' + file + ':' + name);
  return matches[0];
}
for (const file of ['cupid/night_stage.ts', 'hybrid/night_stage.ts', 'wolf_beauty/night_stages.ts']) {
  const full = 'backend/src/game/mechanisms/roles/' + file, row = before.source.find(row => row.path === full);
  const old = declarations(full, row.text, 'current', 'variable'), actual = declarations(full, current.get(full), 'current', 'variable');
  if (old !== actual) fail('pure_current_changed:' + file);
  protectedPrograms.push({ path: full, name: 'current', sha256: sha(actual), same: true });
}
const relationPath = 'backend/src/game/mechanisms/roles/cupid/relation.ts', oldRelation = before.source.find(row => row.path === relationPath).text;
for (const name of ['hasCupidNightCommit','projectLover','loversRecord','sameBody','livingOriginalLovers','prohibitsLoversVote','expandLoversWave']) {
  const old = declarations(relationPath, oldRelation, name, 'function'), actual = declarations(relationPath, current.get(relationPath), name, 'function');
  if (old !== actual) fail('paid_relation_changed:' + name);
  protectedPrograms.push({ path: relationPath, name, sha256: sha(actual), same: true });
}
for (const row of before.controls) {
  const git = cp.execFileSync('git', ['cat-file', 'blob', before.baseCommit + ':' + row.path]);
  if (sha(git) !== row.sha256 || fs.readFileSync(row.path, 'utf8') !== row.text) fail('stable_control:' + row.path);
}
// 默认绑定仍使用原完整三语句；额外受控尾不得以重写 paid 查询掩盖输入差异。
const defaultStatements = ['if (bindings.has(world)) throw new Error("cupid_relation_already_committed");', 'world.addComponent(record.actorId, COMPONENT.Lovers, record);', 'bindings.set(world, { record, lives, emitted: new Set() });'];
for (const statement of defaultStatements) if (!oldRelation.includes(statement) || !current.get(relationPath).includes(statement)) fail('default_statement_lost');
const bindImplementation = declarations(relationPath, current.get(relationPath), 'bindLovers', 'function');
if (!bindImplementation.includes('} else {') || !bindImplementation.includes('if (canAct) return true;')) fail('default_void_layout');
const report = { baseCommit: before.baseCommit, sourceReadySHA256: sha(fs.readFileSync(prefix + 'source-ready-reflect.json')), source: ready.source, programs, aggregate, wholeMappedOutputs: outputs, protectedPrograms, defaultStatements, unitStageInverseSame: true, stableControls: before.controls.map(({path,sha256}) => ({path,sha256})), limits: ['Complete seven original programs are restored through the original 42 edits and the linked Reflect successor, including all source bytes.', 'typedNodes/leaves use forEachChild with JSDoc excluded; NodeArray grouping and leaf text are compared, not a lexer-only token count.', 'Fourteen complete inverse ES/CJS outputs are equal; actual modified outputs are separately recorded and are not behavior equivalence.', 'The new unit has no original production baseline; its two unexecuted source stages are reversed only to the actual first source-ready unit.', 'Protected three pure current expressions, seven paid/data relation functions and seven complete stable controls are unchanged.', 'This script does not run TypeScript diagnostics, runtime tests, models or architectural gates.'] };
fs.writeFileSync(prefix + 'proof.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ source: ready.source.length, oldPrograms: programs.length, inverseMappedOutputs: outputs.length, protectedPrograms: protectedPrograms.length, controls: before.controls.length, aggregate }));
