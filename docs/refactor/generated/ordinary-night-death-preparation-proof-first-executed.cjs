/** 本批只核固定原文、完整迁出算法和实际 caller；输出静态／转译证据，不加载游戏、执行风险或运行类型／门禁。 */
const fs = require('node:fs'), crypto = require('node:crypto');
const ts = require('../../../backend/node_modules/typescript');
const prefix = 'docs/refactor/generated/ordinary-night-death-preparation-';
const sha = x => crypto.createHash('sha256').update(x).digest('hex');
const before = JSON.parse(fs.readFileSync(prefix + 'before.json', 'utf8'));
const edits = JSON.parse(fs.readFileSync(prefix + 'edits.json', 'utf8')).edits;
const ready = JSON.parse(fs.readFileSync(prefix + 'source-ready.json', 'utf8'));
const assert = (v, label) => { if (!v) throw Error(label); };
const parse = (p, text) => ts.createSourceFile(p, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
let nodes = 0, arrays = 0, leaves = 0;
function tree(n, sf) {
  nodes++;
  const out = [];
  ts.forEachChild(n, c => { out.push(tree(c, sf)); }, a => {
    arrays++; out.push({ array: a.map(c => tree(c, sf)), trailing: !!a.hasTrailingComma });
  });
  if (!out.length) { leaves++; return [n.kind, n.getText(sf)]; }
  return [n.kind, out];
}
function tokens(text) {
  const scan = ts.createScanner(ts.ScriptTarget.Latest, true, ts.LanguageVariant.Standard, text), out = [];
  for (let kind = scan.scan(); kind !== ts.SyntaxKind.EndOfFileToken; kind = scan.scan()) out.push([kind, scan.getTokenText()]);
  return out;
}
const sameTree = (a, b, label) => {
  const x = parse(label + '.ts', a), y = parse(label + '.ts', b);
  assert(JSON.stringify(tree(x, x)) === JSON.stringify(tree(y, y)), 'complete_tree:' + label);
  assert(JSON.stringify(tokens(a)) === JSON.stringify(tokens(b)), 'complete_tokens:' + label);
};
function find(sf, predicate, label) {
  const found = [];
  function visit(n) { if (predicate(n)) found.push(n); ts.forEachChild(n, visit); }
  visit(sf); assert(found.length === 1, 'unique:' + label); return found[0];
}
function findAll(sf, predicate) {
  const found = []; function visit(n) { if (predicate(n)) found.push(n); ts.forEachChild(n, visit); } visit(sf); return found;
}
const emit = (p, text, module) => {
  const r = ts.transpileModule(text, { fileName: p, compilerOptions: { target: ts.ScriptTarget.ES2022, module, removeComments: true }, reportDiagnostics: true });
  assert(!r.diagnostics?.some(d => d.category === ts.DiagnosticCategory.Error), 'emit_diagnostic:' + p); return r.outputText;
};
const modules = [['ESNext', ts.ModuleKind.ESNext], ['CommonJS', ts.ModuleKind.CommonJS]];
function outputs(label, oldText, newText, inverse = false) {
  return modules.map(([name, module]) => {
    const a = emit(label + '.ts', oldText, module), b = emit(label + '.ts', newText, module);
    sameTree(a, b, label + ':' + name);
    if (inverse) assert(a === b, 'inverse_raw:' + label);
    return { module: name, beforeSHA256: sha(a), mappedSHA256: sha(b), rawSame: a === b, completeEmittedTreeAndTokensSame: true };
  });
}
const current = new Map(ready.source.map(r => {
  const text = fs.readFileSync(r.path, 'utf8'); assert(sha(text) === r.sha256, 'ready_drift:' + r.path); return [r.path, text];
}));
const old = before.source.find(r => !r.expectedAbsent), path = old.path;
let forward = old.text, inverse = current.get(path);
for (const e of edits) { assert(forward.split(e.before).length === 2, 'forward_anchor:' + e.label); forward = forward.replace(e.before, e.after); }
for (const e of [...edits].reverse()) { assert(inverse.split(e.after).length === 2, 'inverse_anchor:' + e.label); inverse = inverse.replace(e.after, e.before); }
assert(forward === current.get(path), 'whole_forward'); assert(inverse === old.text, 'whole_inverse');
sameTree(old.text, inverse, 'whole_manager_inverse');
const wholeOutputs = outputs('whole_manager_inverse', old.text, inverse, true);
const actualManagerOutputs = modules.map(([name, module]) => {
  const a = emit(path, old.text, module), b = emit(path, current.get(path), module);
  return { module: name, beforeSHA256: sha(a), currentSHA256: sha(b), actualRawSame: a === b };
});
const oldSF = parse(path, old.text), nowSF = parse(path, current.get(path));
const settle = sf => find(sf, n => ts.isVariableDeclaration(n) && n.name.getText(sf) === 'settleNight', 'settleNight').initializer;
const oldSettle = settle(oldSF), nowSettle = settle(nowSF);
const oldTryIndex = oldSettle.body.statements.findIndex(ts.isTryStatement), nowTryIndex = nowSettle.body.statements.findIndex(ts.isTryStatement);
assert(oldTryIndex > 2 && nowTryIndex > 2, 'original_try_boundary');
const ownerPath = before.source[1].path, ownerText = current.get(ownerPath), ownerSF = parse(ownerPath, ownerText);
const prepare = find(ownerSF, n => ts.isFunctionDeclaration(n) && n.name.text === 'prepareOrdinaryNightDeaths', 'prepare_owner');
const publication = find(ownerSF, n => ts.isFunctionDeclaration(n) && n.name.text === 'ordinaryNightDeathPublication', 'publication_owner');
const printer = ts.createPrinter({ removeComments: true });
// 只逆两种明确的新委托：runtime 的三个实际 getter，及经理 callee 先于名单 thunk 的发布入口。
function mapped(n) {
  const transformed = ts.transform(n, [ctx => {
    function visit(node) {
      if (ts.isCallExpression(node) && node.expression.getText(ownerSF) === 'runtime.publishNightResolved') {
        assert(node.arguments.length === 1 && ts.isArrowFunction(node.arguments[0]), 'publication_thunk_shape');
        return ts.factory.createCallExpression(ts.factory.createPropertyAccessExpression(ts.factory.createThis(), 'emitNightResolved'), undefined, [visit(node.arguments[0].body)]);
      }
      if (ts.isPropertyAccessExpression(node) && node.expression.getText(ownerSF) === 'runtime') {
        if (node.name.text === 'night') return ts.factory.createIdentifier('night');
        if (['world', 'config'].includes(node.name.text)) return ts.factory.createPropertyAccessExpression(ts.factory.createThis(), node.name.text);
      }
      return ts.visitEachChild(node, visit, ctx);
    }
    return root => ts.visitNode(root, visit);
  }]);
  const result = printer.printNode(ts.EmitHint.Unspecified, transformed.transformed[0], ownerSF); transformed.dispose(); return result;
}
const oldPreparation = oldSettle.body.statements.slice(2, oldTryIndex).map(n => n.getText(oldSF)).join('\n');
const newPreparation = prepare.body.statements.slice(0, -1).map(mapped).join('\n');
const wrapped = text => 'function originalPreparation(){\n' + text + '\n}';
sameTree(wrapped(oldPreparation), wrapped(newPreparation), 'complete_preparation_kernel');
const preparationOutputs = outputs('complete_preparation_kernel', wrapped(oldPreparation), wrapped(newPreparation));
const returned = prepare.body.statements.at(-1).expression;
assert(ts.isObjectLiteralExpression(returned) && returned.properties.every(ts.isShorthandPropertyAssignment), 'own_result_fields');
assert(JSON.stringify(returned.properties.map(n => n.name.text)) === JSON.stringify(['sourceDamage', 'originalLives', 'retainedSources', 'nightDeaths', 'sources', 'deaths', 'deathPhases']), 'complete_result_refs');
const oldSpread = find(oldSettle, n => ts.isSpreadAssignment(n) && n.getText(oldSF).includes('onInitialWaveCommitted'), 'original_publication_spread');
const newReturn = publication.body.statements[0]; assert(ts.isReturnStatement(newReturn), 'publication_actual_return');
const oldPublication = 'const originalPublication = {' + oldSpread.getText(oldSF) + '};';
const newPublication = 'const originalPublication = {...(' + mapped(newReturn.expression) + ')};';
sameTree(oldPublication, newPublication, 'complete_publication_kernel');
const publicationOutputs = outputs('complete_publication_kernel', oldPublication, newPublication);
const oldTry = oldSettle.body.statements[oldTryIndex], nowTry = nowSettle.body.statements[nowTryIndex];
const oldResolve = find(oldTry, n => ts.isCallExpression(n) && n.expression.getText(oldSF) === 'this.deathResolution.resolve', 'old_resolve');
const nowResolve = find(nowTry, n => ts.isCallExpression(n) && n.expression.getText(nowSF) === 'this.deathResolution.resolve', 'actual_resolve');
assert(oldResolve.expression.getText(oldSF) === nowResolve.expression.getText(nowSF), 'resolve_callee');
assert(oldResolve.arguments.length === nowResolve.arguments.length, 'resolve_argument_count');
for (let i = 0; i < 6; i++) sameTree('const argument=' + oldResolve.arguments[i].getText(oldSF), 'const argument=' + nowResolve.arguments[i].getText(nowSF), 'resolve_argument:' + i);
const oldMetadata = oldResolve.arguments[6], nowMetadata = nowResolve.arguments[6];
assert(ts.isObjectLiteralExpression(oldMetadata) && ts.isObjectLiteralExpression(nowMetadata), 'metadata_shape');
sameTree('const metadata={' + oldMetadata.properties.slice(0, -1).map(n => n.getText(oldSF)).join(',') + '}', 'const metadata={' + nowMetadata.properties.slice(0, -1).map(n => n.getText(nowSF)).join(',') + '}', 'original_metadata_before_publication');
sameTree('function prefix(){' + oldSettle.body.statements.slice(0, 2).map(n => n.getText(oldSF)).join('\n') + '}', 'function prefix(){' + nowSettle.body.statements.slice(0, 2).map(n => n.getText(nowSF)).join('\n') + '}', 'night_settled_write_before_preparation');
sameTree('function finish(){' + oldTry.tryBlock.statements.slice(1).map(n => n.getText(oldSF)).join('\n') + '}', 'function finish(){' + nowTry.tryBlock.statements.slice(1).map(n => n.getText(nowSF)).join('\n') + '}', 'finish_only_after_original_await');
sameTree('function cleanup()' + oldTry.finallyBlock.getText(oldSF), 'function cleanup()' + nowTry.finallyBlock.getText(nowSF), 'original_finally');
sameTree('function tail(){' + oldSettle.body.statements.slice(oldTryIndex + 1).map(n => n.getText(oldSF)).join('\n') + '}', 'function tail(){' + nowSettle.body.statements.slice(nowTryIndex + 1).map(n => n.getText(nowSF)).join('\n') + '}', 'complete_after_await_current_animal_knowledge_and_seal');
const oldCalls = findAll(oldSF, n => ts.isCallExpression(n) && n.expression.getText(oldSF) === 'settleNight');
const nowCalls = findAll(nowSF, n => ts.isCallExpression(n) && n.expression.getText(nowSF) === 'settleNight');
assert(oldCalls.length === 3 && nowCalls.length === 3, 'three_original_calls');
for (let i = 0; i < 3; i++) sameTree(oldCalls[i].getText(oldSF), nowCalls[i].getText(nowSF), 'original_settle_caller:' + i);
const runtime = find(nowSettle, n => ts.isVariableDeclaration(n) && n.name.getText(nowSF) === 'ordinaryNightRuntime', 'actual_runtime').initializer;
assert(runtime.getText(nowSF).includes('return manager.emitNightResolved(deaths());'), 'callee_before_list_thunk');
assert(runtime.getText(nowSF).includes('get world() { return manager.world; }') && runtime.getText(nowSF).includes('get night() { return night; }') && runtime.getText(nowSF).includes('get config() { return manager.config; }'), 'actual_late_getters');
assert(ownerSF.statements.every(n => ts.isImportDeclaration(n) || ts.isInterfaceDeclaration(n) || ts.isFunctionDeclaration(n)), 'no_top_level_business_state');
const controls = before.controls.map(r => { assert(sha(fs.readFileSync(r.path)) === r.sha256, 'control_drift:' + r.path); return { path: r.path, sha256: r.sha256 }; });
const report = {
  baseCommit: before.baseCommit, source: ready.source, deleted: [], controls,
  input: { beforeSHA256: sha(fs.readFileSync(prefix + 'before.json')), editsSHA256: sha(fs.readFileSync(prefix + 'edits.json')), readySHA256: sha(fs.readFileSync(prefix + 'source-ready.json')) },
  wholeManager: { completeForward: true, completeInverse: true, preciseEdits: edits.length, wholeOutputs, actualManagerOutputs },
  preparation: { originalStatements: oldTryIndex - 2, originalText: oldPreparation, completeCurrentMappedText: newPreparation, completeTypedTreeAndTokensSame: true, outputs: preparationOutputs, sevenReturnedOriginalLocals: true },
  publication: { originalText: oldPublication, completeCurrentMappedText: newPublication, completeTypedTreeAndTokensSame: true, outputs: publicationOutputs },
  actualCaller: { nightSettledFirstWrite: true, threeOriginalCalls: true, sameResolveCalleeAndSixArguments: true, metadataBeforeLastSpreadSame: true, actualAwaitRetained: true, finishAndFinallySame: true, completePostAwaitTailSame: true, managerCalleeBeforeListThunk: true, lateWorldNightConfig: true },
  completeComparisons: { typedNodesBothSides: nodes, nodeArraysBothSides: arrays, astLeavesBothSides: leaves },
  limits: ['完整精确逆证明原经理之外只有五个显式编辑；当前经理与新增 owner 实际 JS/公开模块面有意改变。', '两个完整迁出算法只逆明确 getter／名单 thunk 委托，并比较全 typed tree／scanner tokens 及完整输出；不把新 runtime 对象／结果对象／函数栈与任意 monkeypatch 环境称全等。', '经理仍持原完成首写、真实 DR await 与原 finally；证明不执行死亡、typecheck、风险或架构门禁。', '新 unit 是独立字面风险输入，既有场景是否执行只能按独立运行收据说明。'],
};
fs.writeFileSync(prefix + 'proof.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ oldPrograms: 1, newSources: 2, preciseEdits: edits.length, wholeInverseOutputs: wholeOutputs.length, completePreparationStatements: oldTryIndex - 2, kernelOutputs: preparationOutputs.length + publicationOutputs.length, originalCallerSites: 3, controls: controls.length, typedNodesBothSides: nodes, nodeArraysBothSides: arrays, astLeavesBothSides: leaves }));
