/** 只核遗言交付政策的真实完整增量、保留程序和实际接线；不加载产品、不冒政策新旧行为等价。 */
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const { createHash } = require('node:crypto'), ts = require('../../../backend/node_modules/typescript');
const prefix = 'docs/refactor/generated/last-words-request-lease-';
const before = JSON.parse(fs.readFileSync(prefix + 'before.json', 'utf8'));
const ready = JSON.parse(fs.readFileSync(prefix + 'source-ready.json', 'utf8'));
const edits = JSON.parse(fs.readFileSync(prefix + 'edits.json', 'utf8'));
const sha = text => createHash('sha256').update(text).digest('hex');
const row = before.source[0], original = row.text, current = fs.readFileSync(row.path, 'utf8');
for (const source of ready.source) assert.equal(sha(fs.readFileSync(source.path)), source.sha256);
assert.equal(sha(original), row.sha256);
let inverse = current, forward = original;
for (const edit of [...edits.source[0].edits].reverse()) {
  assert.equal(original.slice(edit.beforeStart, edit.beforeEnd), edit.before);
  assert.equal(current.slice(edit.afterStart, edit.afterEnd), edit.after);
  inverse = inverse.slice(0, edit.afterStart) + edit.before + inverse.slice(edit.afterEnd);
  forward = forward.slice(0, edit.beforeStart) + edit.after + forward.slice(edit.beforeEnd);
}
assert.equal(forward, current); assert.equal(inverse, original);
function source(text, name = row.path) {
  const parsed = ts.createSourceFile(name, text, ts.ScriptTarget.Latest, true);
  assert.deepEqual(parsed.parseDiagnostics, []); return parsed;
}
function program(parsed) {
  let nodes = 0, arrays = 0, leaves = 0;
  function walk(n) {
    nodes++; const children = [];
    ts.forEachChild(n, c => { children.push(walk(c)); }, a => {
      arrays++; children.push(['array', a.length, !!a.hasTrailingComma, a.map(walk)]);
    }); return [n.kind, children];
  }
  function token(n) {
    const children = n.getChildren(parsed).filter(c => c.kind < ts.SyntaxKind.FirstJSDocNode || c.kind > ts.SyntaxKind.LastJSDocNode);
    if (!children.length) { leaves++; return [n.kind, n.getText(parsed)]; }
    return [n.kind, children.map(token)];
  }
  const tree = walk(parsed), tokens = token(parsed), docs = [];
  function collect(n) {
    for (const d of n.jsDoc ?? []) {
      for (const t of d.tags ?? []) docs.push(t.getText(parsed));
      if (d.typeExpression) docs.push(d.typeExpression.getText(parsed));
    }
    ts.forEachChild(n, c => { collect(c); });
  }
  collect(parsed);
  return { tree, tokens, docs, nodes, arrays, leaves };
}
const old = source(original), actual = source(current), restored = source(inverse);
const oldProgram = program(old), restoredProgram = program(restored), actualProgram = program(actual);
assert.deepEqual(restoredProgram, oldProgram);
const printer = ts.createPrinter({ removeComments: true });
function print(node, parsed) { return printer.printNode(ts.EmitHint.Unspecified, node, parsed); }
function layout(parsed) {
  const clazz = parsed.statements.find(n => ts.isClassDeclaration(n) && n.name.text === 'LastWordsWindow');
  const method = clazz.members.find(n => ts.isMethodDeclaration(n) && n.name.getText(parsed) === 'collect');
  const loop = method.body.statements.find(ts.isForOfStatement);
  const attempt = loop.statement.statements.find(ts.isTryStatement);
  return { clazz, method, loop, attempt };
}
function declaration(statements, name) {
  const statement = statements.find(n => ts.isVariableStatement(n) && n.declarationList.declarations.some(d => d.name.getText() === name));
  assert.ok(statement, 'missing:' + name); return statement;
}
function retained(parsed) {
  const { clazz, method, loop, attempt } = layout(parsed);
  const outer = method.body.statements, body = loop.statement.statements, inner = attempt.tryBlock.statements;
  const condition = (statements, text) => {
    const node = statements.find(n => ts.isIfStatement(n) && n.expression.getText(parsed).includes(text));
    assert.ok(node, 'missing:' + text); return node;
  };
  return {
    runtime: parsed.statements.find(n => ts.isInterfaceDeclaration(n) && n.name.text === 'LastWordsWindowRuntime'),
    constructor: clazz.members.find(ts.isConstructorDeclaration),
    parameters: method.parameters,
    factory: declaration(outer, 'requests'),
    collectionDay: declaration(outer, 'day'),
    actualDeathPhase: declaration(body, 'actualDeathPhase'),
    policyGuard: condition(body, 'shouldGrantLastWords'),
    earlyDomainGuard: condition(body, '!scopeCurrent()'),
    openPermit: declaration(body, 'permit'),
    createRequest: declaration(inner, 'request'),
    actionKindContinue: condition(inner, 'action?.name'),
    gateway: declaration(inner, 'validated'),
    gatewayContinue: condition(inner, '!validated.ok'),
  };
}
const oldRetained = retained(old), newRetained = retained(actual), protectedPrograms = [];
for (const key of Object.keys(oldRetained)) {
  const left = oldRetained[key], right = newRetained[key];
  const a = Array.isArray(left) ? left.map(n => print(n, old)).join('\n') : print(left, old);
  const b = Array.isArray(right) ? right.map(n => print(n, actual)).join('\n') : print(right, actual);
  assert.equal(b, a, 'retained:' + key);
  protectedPrograms.push({ name: key, completePrintedSame: true, sha256: sha(a) });
}
const { attempt } = layout(actual), statements = attempt.tryBlock.statements;
const scopeStatement = declaration(statements, 'requestScope');
const scopeObject = scopeStatement.declarationList.declarations[0].initializer;
const currentQuery = scopeObject.properties.find(n => n.name.getText(actual) === 'current').initializer;
function andTerms(node) {
  return ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken
    ? [...andTerms(node.left), ...andTerms(node.right)] : [print(node, actual)];
}
const currentTerms = andTerms(currentQuery.body);
assert.deepEqual(currentTerms, [
  'scopeCurrent()', 'this.runtime.state.phase === phase', 'this.runtime.state.day === day',
  '!this.runtime.state.gameOver', 'this.runtime.world.hasDeathAction(deadId, "speak", phase, day, permit.id)',
]);
function ordered(needles) { let index = 0; for (const text of needles) { const at = current.indexOf(text, index); assert.notEqual(at, -1, text); index = at + text.length; } return needles; }
const providerOrder = ordered(['lastWordsRequests.bind(requestScope, request);', 'delivery = lastWordsRequests.openDelivery(requestScope, request);', 'if (!delivery) return;', 'const getAction = actionProvider.getAction;', 'const actionArguments:', 'const invokeAction = Reflect.apply.bind(Reflect);', 'if (!delivery.current()) return;', 'await invokeAction(getAction, actionProvider, actionArguments);', 'if (!delivery.current()) return;']);
const publicationOrder = ordered(['if (!validated.ok || !validated.sanitizedCall)', 'if (!delivery.current()) return;', 'const events = this.runtime.events;', 'const publish = events.push;', 'const publication: GameEvent = {', 'timestamp: Date.now()', 'day: this.runtime.state.day', 'text: validated.sanitizedCall.args.text', 'const publicationArguments:', 'const invokePublication = Reflect.apply.bind(Reflect);', 'if (!delivery.current()) return;', 'invokePublication(publish, events, publicationArguments);', 'delivery.complete();']);
assert.equal((current.match(/delivery\.complete\(\)/g) ?? []).length, 1);
assert.equal((current.match(/Reflect\.apply\.bind\(Reflect\)/g) ?? []).length, 2);
const bindingImport = actual.statements.find(n => ts.isImportDeclaration(n) && n.moduleSpecifier.text === '../../../core/domain/request-lease');
assert.ok(bindingImport);
const imported = bindingImport.importClause.namedBindings.elements.map(n => ({ name: n.name.text, typeOnly: n.isTypeOnly }));
assert.deepEqual(imported, [{ name: 'RequestLease', typeOnly: false }, { name: 'RequestLeaseTurn', typeOnly: true }]);
const leaseStatement = declaration(actual.statements, 'lastWordsRequests'), leaseCall = leaseStatement.declarationList.declarations[0].initializer;
assert.equal(leaseCall.expression.getText(actual), 'RequestLease.window');
assert.equal(leaseCall.arguments[1].getText(actual), '130');
assert.deepEqual(leaseCall.arguments[2].elements.map(n => n.text), ['trigger', 'death_phase', 'death_action_id']);
const cleanup = attempt.finallyBlock.getText(actual);
assert.ok(cleanup.includes('permit.close();'));
assert.ok(cleanup.includes('failed = true;'));
assert.ok(cleanup.includes('if (failed)'));
assert.ok(cleanup.indexOf('permit.close();') < cleanup.indexOf('delivery?.close();'));
const outputs = [ts.ModuleKind.ESNext, ts.ModuleKind.CommonJS].map(module => {
  const emit = text => ts.transpileModule(text, { fileName: row.path, compilerOptions: {
    target: ts.ScriptTarget.ES2022, module, removeComments: true,
  } }).outputText;
  const a = emit(original), b = emit(inverse), c = emit(current);
  assert.equal(b, a);
  return { module: ts.ModuleKind[module], wholeInverseRawSame: true, originalSHA256: sha(a), inverseSHA256: sha(b), currentSHA256: sha(c), actualPolicyOutputDifferent: c !== a };
});
const unit = ready.source[1], unitProgram = program(source(fs.readFileSync(unit.path, 'utf8'), unit.path));
const controls = before.controls.map(r => { assert.equal(sha(fs.readFileSync(r.path)), r.sha256); return { path: r.path, sha256: r.sha256 }; });
const report = {
  baseCommit: before.baseCommit, sourceReadySHA256: sha(fs.readFileSync(prefix + 'source-ready.json')),
  source: ready.source, exactEdits: edits.source[0].edits.length, wholeForwardInverse: true,
  originalProgram: { typedNodes: oldProgram.nodes, nodeArrays: oldProgram.arrays, nonCommentLeaves: oldProgram.leaves },
  currentProgram: { typedNodes: actualProgram.nodes, nodeArrays: actualProgram.arrays, nonCommentLeaves: actualProgram.leaves },
  newUnitProgram: { typedNodes: unitProgram.nodes, nodeArrays: unitProgram.arrays, nonCommentLeaves: unitProgram.leaves },
  protectedPrograms, currentTerms, providerOrder, publicationOrder,
  sharedBinding: { path: 'backend/src/core/domain/request-lease.ts', sha256: sha(fs.readFileSync('backend/src/core/domain/request-lease.ts')), imported, propagationOrder: 130, contextPins: leaseCall.arguments[2].elements.map(n => n.text) },
  actualCleanup: { completeCurrentTextSHA256: sha(cleanup), permitCloseBeforeNotification: true, failedBooleanPreservesThrownUndefined: true },
  outputs, controls,
  limits: ['新租约/字段pin/期限/完成/Reflect调用是明确政策和API观察，完整逆仅证明范围，不冒有意变化全等价。', '保留13组完整程序/签名或原条件与body；新增请求和发表序列另按实际源码核，运行意义由独立风险和人工审查支持。', '共享core由另一作者拥有，当前摘要只链接其本阶段，不当本批immutable；不运行产品/测试/类型/头或架构门禁。'],
};
fs.writeFileSync(prefix + 'proof.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ sources: ready.source.length, exactEdits: report.exactEdits, protectedPrograms: protectedPrograms.length, originalProgram: report.originalProgram, currentProgram: report.currentProgram, newUnitProgram: report.newUnitProgram, wholeInverseRawOutputs: outputs.length, controls: controls.length }));
