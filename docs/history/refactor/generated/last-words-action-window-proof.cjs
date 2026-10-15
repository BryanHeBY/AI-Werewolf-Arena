/** 核完整遗言窗口迁移的真实输入、精确 DR 正逆、实际新方法映射和原参数／依赖绑定；只做静态程序与转译比较，不加载产品或运行风险测试。 */
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const ts = require('../../../backend/node_modules/typescript');
const prefix = 'docs/refactor/generated/last-words-action-window-';
const sha = text => crypto.createHash('sha256').update(text).digest('hex');
const read = name => fs.readFileSync(prefix + name, 'utf8');
const before = JSON.parse(read('before.json')), edits = JSON.parse(read('edits.json')), ready = JSON.parse(read('source-ready.json'));
const assert = (condition, label) => { if (!condition) throw new Error(label); };
const parse = (name, text) => {
  const sf = ts.createSourceFile(name, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  assert(!sf.parseDiagnostics.length, 'parse:' + name);
  return sf;
};
let nodes = 0, arrays = 0, leaves = 0;
function tree(node, sf) {
  nodes++;
  const children = [];
  ts.forEachChild(node, child => { children.push(tree(child, sf)); }, list => {
    arrays++;
    children.push({ array: list.map(child => tree(child, sf)), trailing: !!list.hasTrailingComma });
  });
  if (!children.length) { leaves++; return [node.kind, node.getText(sf)]; }
  return [node.kind, children];
}
function tokens(text) {
  const scanner = ts.createScanner(ts.ScriptTarget.Latest, true, ts.LanguageVariant.Standard, text), out = [];
  for (let kind = scanner.scan(); kind !== ts.SyntaxKind.EndOfFileToken; kind = scanner.scan()) out.push([kind, scanner.getTokenText()]);
  return out;
}
const modules = [['ESNext', ts.ModuleKind.ESNext], ['CommonJS', ts.ModuleKind.CommonJS]];
function emit(name, text, module) {
  const result = ts.transpileModule(text, { fileName: name, compilerOptions: { target: ts.ScriptTarget.ES2022, module, removeComments: true }, reportDiagnostics: true });
  assert(!result.diagnostics?.some(d => d.category === ts.DiagnosticCategory.Error), 'emit:' + name);
  return result.outputText;
}
function compare(label, left, right) {
  const a = parse(label + '.ts', left), b = parse(label + '.ts', right);
  assert(JSON.stringify(tree(a, a)) === JSON.stringify(tree(b, b)), 'whole_tree:' + label);
  assert(JSON.stringify(tokens(left)) === JSON.stringify(tokens(right)), 'whole_tokens:' + label);
  const outputs = modules.map(([name, module]) => {
    const first = emit(label + '.ts', left, module), second = emit(label + '.ts', right, module);
    assert(first === second, 'whole_emit:' + label);
    return { module: name, leftSHA256: sha(first), rightSHA256: sha(second), completeRawSame: true };
  });
  return { completeTreeAndTokensSame: true, outputs };
}
const current = new Map(ready.source.map(entry => {
  const text = fs.readFileSync(entry.path, 'utf8');
  assert(sha(text) === entry.sha256, 'source_ready_drift:' + entry.path);
  return [entry.path, text];
}));
const original = before.sources[0], dr = original.path, windowPath = before.newSources[0].path;
let forward = original.text, inverse = current.get(dr);
for (const step of edits.edits) {
  assert(step.path === dr, 'foreign_edit');
  assert(forward.slice(step.offsetAtApplication, step.offsetAtApplication + step.before.length) === step.before, 'forward_exact_offset');
  forward = forward.slice(0, step.offsetAtApplication) + step.after + forward.slice(step.offsetAtApplication + step.before.length);
}
assert(forward === current.get(dr), 'whole_dr_forward');
for (const step of [...edits.edits].reverse()) {
  assert(inverse.slice(step.offsetAtApplication, step.offsetAtApplication + step.after.length) === step.after, 'inverse_exact_offset');
  inverse = inverse.slice(0, step.offsetAtApplication) + step.before + inverse.slice(step.offsetAtApplication + step.after.length);
}
assert(inverse === original.text, 'whole_dr_inverse');
const wholeDR = compare('complete_dr_exact_inverse', original.text, inverse);
wholeDR.actualOutputs = modules.map(([name, module]) => {
  const oldJS = emit(dr, original.text, module), nowJS = emit(dr, current.get(dr), module);
  return { module: name, originalSHA256: sha(oldJS), actualCurrentSHA256: sha(nowJS), actualRawSame: oldJS === nowJS };
});
const oldSF = parse(dr, original.text), newSF = parse(windowPath, current.get(windowPath)), actualDR = parse(dr, current.get(dr));
function find(sf, predicate, label) {
  const matches = [];
  function visit(node) { if (predicate(node)) matches.push(node); ts.forEachChild(node, visit); }
  visit(sf); assert(matches.length === 1, 'nonunique:' + label); return matches[0];
}
const oldMethod = find(oldSF, n => ts.isMethodDeclaration(n) && n.name?.getText(oldSF) === 'collectLastWords', 'old_method');
const newMethod = find(newSF, n => ts.isMethodDeclaration(n) && n.name?.getText(newSF) === 'collect', 'actual_new_method');
assert(oldMethod.parameters.length === 9 && newMethod.parameters.length === 9, 'parameter_count');
assert(edits.movedMethod.originalText.includes(oldMethod.getText(oldSF)), 'captured_actual_old_method');
let mappedMethod = newMethod.getText(newSF);
const routing = [];
function collectRouting(node) {
  if (ts.isPropertyAccessExpression(node) && node.expression.getText(newSF) === 'this.runtime') {
    const field = node.name.text;
    assert(['requestFactory', 'world', 'events', 'state', 'toolGateway', 'lastWordsMechanism'].includes(field), 'unapproved_runtime_field');
    routing.push({ before: node.getText(newSF), after: field === 'requestFactory' ? 'GameActionRequestFactory' : 'this.' + field, offset: node.getStart(newSF) - newMethod.getStart(newSF), field });
  }
  ts.forEachChild(node, collectRouting);
}
collectRouting(newMethod);
for (const step of [...routing].sort((a, b) => b.offset - a.offset)) {
  assert(mappedMethod.slice(step.offset, step.offset + step.before.length) === step.before, 'actual_method_mapping');
  mappedMethod = mappedMethod.slice(0, step.offset) + step.after + mappedMethod.slice(step.offset + step.before.length);
}
const normalizedOld = oldMethod.getText(oldSF).replace(/^private async collectLastWords/, 'async collect');
assert(normalizedOld !== oldMethod.getText(oldSF), 'method_name_access_mapping');
const movedProgram = compare('complete_actual_moved_method', 'class Extracted {\n' + normalizedOld + '\n}', 'class Extracted {\n' + mappedMethod + '\n}');
const parameterTrees = oldMethod.parameters.map((parameter, index) => {
  assert(JSON.stringify(tree(parameter, oldSF)) === JSON.stringify(tree(newMethod.parameters[index], newSF)), 'complete_parameter:' + index);
  return { index, name: parameter.name.getText(oldSF), completeDeclarationSame: true };
});
const oldCall = find(oldSF, n => ts.isCallExpression(n) && n.expression.getText(oldSF) === 'this.collectLastWords', 'old_caller');
const newCall = find(actualDR, n => ts.isCallExpression(n) && n.expression.getText(actualDR) === 'this.lastWordsWindow.collect', 'actual_new_caller');
assert(oldCall.arguments.length === 9 && newCall.arguments.length === 9, 'caller_arity');
const argumentsSame = oldCall.arguments.map((argument, index) => {
  assert(JSON.stringify(tree(argument, oldSF)) === JSON.stringify(tree(newCall.arguments[index], actualDR)), 'complete_caller_argument:' + index);
  return { index, text: argument.getText(oldSF), completeTreeSame: true };
});
const oldResolve = find(oldSF, n => ts.isMethodDeclaration(n) && n.name?.getText(oldSF) === 'resolve', 'old_resolve');
const newResolve = find(actualDR, n => ts.isMethodDeclaration(n) && n.name?.getText(actualDR) === 'resolve', 'actual_resolve');
let mappedResolve = newResolve.getText(actualDR);
const callOffset = newCall.expression.getStart(actualDR) - newResolve.getStart(actualDR), oldCallee = oldCall.expression.getText(oldSF), newCallee = newCall.expression.getText(actualDR);
assert(mappedResolve.slice(callOffset, callOffset + newCallee.length) === newCallee, 'resolve_mapping');
mappedResolve = mappedResolve.slice(0, callOffset) + oldCallee + mappedResolve.slice(callOffset + newCallee.length);
const retainedResolve = compare('complete_resolve_only_callee_mapping', 'class Extracted {\n' + oldResolve.getText(oldSF) + '\n}', 'class Extracted {\n' + mappedResolve + '\n}');
const singleton = sf => find(sf, n => ts.isPropertyDeclaration(n) && n.name?.getText(sf) === 'lastWordsMechanism', 'singleton').getText(sf);
assert(singleton(oldSF) === singleton(actualDR), 'singleton_init_changed');
const runtimeProperty = find(actualDR, n => ts.isPropertyDeclaration(n) && n.name?.getText(actualDR) === 'lastWordsWindow', 'runtime_wiring');
const wiring = [];
function inspectWiring(node) {
  if (ts.isGetAccessorDeclaration(node)) {
    const field = node.name.getText(actualDR), expected = field === 'requestFactory' ? 'GameActionRequestFactory' : 'resolution.' + field;
    assert(node.body.statements.length === 1 && ts.isReturnStatement(node.body.statements[0]), 'wiring_getter_body');
    assert(node.body.statements[0].expression.getText(actualDR) === expected, 'late_wiring_binding:' + field);
    wiring.push({ field, getterReturn: expected, lateSameReference: true });
  }
  ts.forEachChild(node, inspectWiring);
}
inspectWiring(runtimeProperty); assert(wiring.length === 6, 'wiring_count');
const factoryInput = find(newSF, n => ts.isNewExpression(n) && n.expression.getText(newSF) === 'this.runtime.requestFactory', 'late_new');
assert(factoryInput.arguments.map(n => n.getText(newSF)).join('|') === 'this.runtime.world|this.runtime.events|this.runtime.state.day', 'factory_arg_order');
assert(newMethod.body.statements[1].getText(newSF) === 'const day = this.runtime.state.day;', 'second_day_read');
const imports = sf => sf.statements.filter(ts.isImportDeclaration).flatMap(n => {
  const out = [], clause = n.importClause, specifier = n.moduleSpecifier.text;
  if (clause?.name) out.push({ local: clause.name.text, imported: 'default', specifier, typeOnly: !!clause.isTypeOnly });
  if (clause?.namedBindings && ts.isNamedImports(clause.namedBindings)) for (const binding of clause.namedBindings.elements) out.push({ local: binding.name.text, imported: binding.propertyName?.text ?? binding.name.text, specifier, typeOnly: !!clause.isTypeOnly || !!binding.isTypeOnly });
  return out;
});
const configFile = ts.readConfigFile('backend/tsconfig.tests.json', ts.sys.readFile);
assert(!configFile.error, 'compiler_config_read');
const options = ts.parseJsonConfigFileContent(configFile.config, ts.sys, path.resolve('backend')).options;
function endpoint(specifier, file) {
  const resolved = ts.resolveModuleName(specifier, path.resolve(file), options, ts.sys).resolvedModule;
  assert(resolved, 'module_endpoint:' + specifier); return path.relative(process.cwd(), resolved.resolvedFileName);
}
const originalImports = imports(oldSF), currentImports = imports(actualDR), windowImports = imports(newSF);
const retainedBindings = originalImports.filter(binding => binding.local !== 'LastWordsPolicy').map(binding => {
  const next = currentImports.find(candidate => candidate.local === binding.local);
  assert(next && next.imported === binding.imported && next.typeOnly === binding.typeOnly && endpoint(next.specifier, dr) === endpoint(binding.specifier, dr), 'retained_named_binding:' + binding.local);
  return { local: binding.local, imported: binding.imported, typeOnly: binding.typeOnly, moduleEndpoint: endpoint(next.specifier, dr), sameModeNameModuleEndpoint: true };
});
const movedBindings = ['ActionProvider', 'EntityId', 'GameEvent', 'Phase', 'RuntimeSnapshot', 'DeathSources', 'LastWordsPolicy', 'World', 'ToolGateway', 'LastWordsGrantContext'].map(local => {
  const old = originalImports.find(binding => binding.local === local), now = windowImports.find(binding => binding.local === local);
  assert(old && now && endpoint(old.specifier, dr) === endpoint(now.specifier, windowPath), 'moved_type_module:' + local);
  return { local, moduleEndpoint: endpoint(now.specifier, windowPath), windowTypeOnly: now.typeOnly };
});
assert(windowImports.every(binding => binding.typeOnly), 'window_value_dependency');
assert(windowImports.some(binding => binding.local === 'ActionRequestFactoryConstructorPort' && endpoint(binding.specifier, windowPath) === 'backend/src/core/domain/actions.ts'), 'neutral_ctor_endpoint');
const controls = before.controls.map(entry => { assert(sha(fs.readFileSync(entry.path)) === entry.sha256, 'control_drift:' + entry.path); return { path: entry.path, sha256: entry.sha256 }; });
const report = {
  baseCommit: before.baseCommit, source: ready.source.map(({ text, ...entry }) => entry), deleted: [],
  input: { beforeSHA256: sha(read('before.json')), editsSHA256: sha(read('edits.json')), sourceReadySHA256: sha(read('source-ready.json')) },
  wholeDR: { path: dr, originalSHA256: original.sha256, currentSHA256: sha(current.get(dr)), preciseEdits: edits.edits.length, completeForwardAndInverse: true, ...wholeDR },
  movedMethod: { originalPhysicalLines: edits.movedMethod.physicalLines, originalText: oldMethod.getText(oldSF), actualNewText: newMethod.getText(newSF), mappedActualText: mappedMethod, routing, accessAndNameChange: 'private collectLastWords → public collect', parameterTrees, ...movedProgram },
  retainedResolve: { onlyActualCalleeMapping: { before: oldCallee, after: newCallee }, argumentsSame, ...retainedResolve },
  singletonOriginalInitializationSame: true, runtimeWiring: wiring, factory: { requiredNeutralConstructorPort: true, originalArgumentOrder: true, constructorBeforeSeparateCollectionDayRead: true },
  bindings: { retainedBindings, movedBindings, constructorPortEndpoint: 'backend/src/core/domain/actions.ts', newWindowEndpoint: windowPath, noWindowValueImports: true },
  completeComparisons: { nodesBothSides: nodes, nodeArraysBothSides: arrays, leavesBothSides: leaves }, controls,
  newSources: before.newSources.map(entry => ({ path: entry.path, beforeGitAbsent: entry.absentAtGit, currentSHA256: sha(current.get(entry.path)) })),
  limits: [
    'Whole DR raw equality is only its full precise inverse; actual DR/new window JS and module/class/API layout intentionally differ.',
    'The complete actual moved method is mapped only at six named runtime routes and the constructor identifier; name/access changes are explicit. No body statements are replaced by the old block.',
    'Complete actual resolve is compared after mapping its one new callee to the old callee; nine original argument trees, singleton initialization, grant-before-await and all other resolve statements remain.',
    'Named binding endpoints are resolved module entries; reexport chains are not recursively declared ultimate physical owners.',
    'A new field/window object, runtime getter delegation, public method and call stack are explicit observations; arbitrary prototype/global/CJS mutation or full cold-load equivalence is not claimed.',
    'The new unit has no previous program to compare. Runtime evidence belongs to Root receipts, not this static tool; no production import, business test, typecheck or architecture gate runs here.'
  ]
};
fs.writeFileSync(prefix + 'proof.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ source: 3, oldPrograms: 1, preciseDREdits: edits.edits.length, movedMethodLines: edits.movedMethod.physicalLines, actualRuntimeRoutes: routing.length, completeInverseOutputs: 2, completeMovedMappedOutputs: 2, completeResolveMappedOutputs: 2, retainedNamedModuleBindings: retainedBindings.length, movedTypeModuleBindings: movedBindings.length, controls: controls.length, ...report.completeComparisons }));
