/** 负责两原程序的完整增量正逆及两个真实安装体接线；输入实际 Git 前样和冻结三源，输出语法／转译证据，不运行生产或行为。 */
const fs = require('node:fs'), assert = require('node:assert/strict'), { createHash } = require('node:crypto');
const ts = require('../../../backend/node_modules/typescript');
const prefix = 'docs/refactor/generated/noble-state-installation-', sha = x => createHash('sha256').update(x).digest('hex');
const before = JSON.parse(fs.readFileSync(prefix + 'before.json', 'utf8')), edits = JSON.parse(fs.readFileSync(prefix + 'edits.json', 'utf8')).edits;
const ready = JSON.parse(fs.readFileSync(prefix + 'source-ready.json', 'utf8'));
const parse = (p, text) => { const sf = ts.createSourceFile(p, text, ts.ScriptTarget.Latest, true); assert.deepEqual(sf.parseDiagnostics, []); return sf; };
const current = new Map(ready.source.map(row => { const text = fs.readFileSync(row.path, 'utf8'); assert.equal(sha(text), row.sha256); return [row.path, text]; }));
function transform(text, own, inverse) {
  for (const e of inverse ? [...own].reverse() : own) {
    const old = inverse ? e.after : e.before, replacement = inverse ? e.before : e.after;
    assert.equal(text.split(old).length, 2); text = text.replace(old, replacement);
  }
  return text;
}
const emit = (p, text, module) => ts.transpileModule(text, { fileName: p, compilerOptions: { target: ts.ScriptTarget.ES2022, module, removeComments: true } }).outputText;
let nodes = 0, arrays = 0, leaves = 0;
function tree(node, sf) {
  nodes++; const children = [];
  ts.forEachChild(node, n => { children.push(tree(n, sf)); }, items => { arrays++; children.push(['array', items.length, !!items.hasTrailingComma, ...items.map(n => tree(n, sf))]); });
  if (!children.length) { leaves++; return [node.kind, node.getText(sf)]; }
  return [node.kind, children];
}
const programs = before.source.map(row => {
  assert.equal(sha(row.text), row.sha256);
  const own = edits.filter(e => e.path === row.path), now = current.get(row.path), inverse = transform(now, own, true);
  assert.equal(transform(row.text, own, false), now); assert.equal(inverse, row.text);
  const a = parse(row.path, row.text), b = parse(row.path, inverse); assert.deepEqual(tree(a, a), tree(b, b));
  return { path: row.path, beforeSHA256: row.sha256, finalSHA256: sha(now), exactEdits: own.length, wholeForwardInverse: true,
    outputs: [ts.ModuleKind.ESNext, ts.ModuleKind.CommonJS].map(module => { const old = emit(row.path, row.text, module), restored = emit(row.path, inverse, module), actual = emit(row.path, now, module); assert.equal(old, restored); return { module, originalSHA256: sha(old), inverseSHA256: sha(restored), actualSHA256: sha(actual), inverseSame: true, actualSame: actual === old }; }) };
});
const statePath = before.source.find(r => r.path.endsWith('/state.ts')).path, profilePath = before.source.find(r => r.path.endsWith('/profile.ts')).path;
const stateBefore = parse(statePath, before.source.find(r => r.path === statePath).text), stateNow = parse(statePath, current.get(statePath));
const profileBefore = parse(profilePath, before.source.find(r => r.path === profilePath).text), profileNow = parse(profilePath, current.get(profilePath));
const retainedStateDeclarations = stateBefore.statements.filter(n => !ts.isImportDeclaration(n)).map(old => {
  const matches = stateNow.statements.filter(n => n.getText(stateNow) === old.getText(stateBefore)); assert.equal(matches.length, 1);
  return { kind: old.kind, wholeTextSHA256: sha(old.getText(stateBefore)), same: true };
});
function namedFunction(sf, name) { const found = sf.statements.filter(n => ts.isFunctionDeclaration(n) && n.name?.text === name && n.body); assert.equal(found.length, 1); return found[0]; }
function initBody(sf, name) {
  const statement = sf.statements.find(n => ts.isVariableStatement(n) && n.declarationList.declarations.some(d => d.name.getText(sf) === name));
  const root = statement.declarationList.declarations[0].initializer;
  const runtime = root.properties.find(n => n.name?.getText(sf) === 'runtime').initializer;
  return runtime.properties.find(n => n.name?.getText(sf) === 'init').initializer.body;
}
const actualInstallations = [];
for (const [profile, installer] of [['NIGHT_NOBLE_ROLE_PROFILE', 'installNobleState'], ['AWAKENED_IDIOT_ROLE_PROFILE', 'installSecretBodyState']]) {
  const oldBody = initBody(profileBefore, profile), newBody = initBody(profileNow, profile), implementation = namedFunction(stateNow, installer);
  assert.equal(oldBody.statements.length, 1); assert.equal(newBody.statements.length, 1); assert.equal(implementation.body.statements.length, 1);
  const original = oldBody.statements[0].expression, call = newBody.statements[0].expression, installed = implementation.body.statements[0].expression;
  assert(ts.isBinaryExpression(original)); assert(ts.isCallExpression(call)); assert(ts.isBinaryExpression(installed));
  assert.equal(call.expression.getText(profileNow), installer); assert.equal(call.arguments[0].getText(profileNow), 'role');
  assert.equal(installed.left.getText(stateNow), original.left.getText(profileBefore)); assert.equal(installed.operatorToken.kind, original.operatorToken.kind);
  assert.equal(installed.right.expression.getText(stateNow), original.right.expression.getText(profileBefore));
  assert.equal(installed.right.arguments.length, 1); assert.equal(installed.right.arguments[0].getText(stateNow), 'readPolicy()');
  const thunk = call.arguments[1]; assert(ts.isArrowFunction(thunk)); assert.equal(thunk.parameters.length, 0);
  assert.equal(thunk.body.getText(profileNow), original.right.arguments[0].getText(profileBefore));
  actualInstallations.push({ profile, installer, originalLHS: original.left.getText(profileBefore), originalFactory: original.right.expression.getText(profileBefore), originalPolicyExpressionSHA256: sha(thunk.body.getText(profileNow)), originalFactoryDeclarationRetained: true, actualAssignmentAndLatePolicyConnected: true });
}
const controls = before.controls.map(row => { assert.equal(sha(fs.readFileSync(row.path)), row.sha256); return { path: row.path, sha256: row.sha256 }; });
const report = { baseCommit: before.baseCommit, source: ready.source, sourceReadySHA256: sha(fs.readFileSync(prefix + 'source-ready.json')), programs, retainedStateDeclarations, actualInstallations, controls,
  summary: { existingPrograms: 2, source: 3, exactEdits: edits.length, wholeInverseOutputs: 4, retainedStateDeclarations: retainedStateDeclarations.length, actualInstallations: actualInstallations.length, nodesBothSides: nodes, nodeArraysBothSides: arrays, leavesBothSides: leaves },
  limits: ['完整两原稿正逆仅界定六处增量；实际模块输出因两个安装导出和调用布局而改变，不称JS/API完全相同。', '完整原数据声明/工厂/schema/writer/影子class逐文本保持；两个实际安装赋值与原惰性政策表达式接线单独核对。', '新增callback及安装调用栈/导出/分配观察面；不承诺任意模块namespace改写等价，不运行类型/业务或门禁。'] };
fs.writeFileSync(prefix + 'proof.json', JSON.stringify(report, null, 2) + '\n'); console.log(JSON.stringify(report.summary));
