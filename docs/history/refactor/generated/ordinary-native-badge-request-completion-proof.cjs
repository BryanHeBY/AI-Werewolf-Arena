/** Q2 明确新交付政策：完整原稿正逆、保留写体与实际结算／清理位置；不执行产品，不声称新旧行为等价。 */
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const ts = require('../../../backend/node_modules/typescript');
const prefix = 'docs/refactor/generated/ordinary-native-badge-request-completion-';
const before = JSON.parse(fs.readFileSync(prefix + 'before.json', 'utf8'));
const ready = JSON.parse(fs.readFileSync(prefix + 'source-ready.json', 'utf8'));
const edits = JSON.parse(fs.readFileSync(prefix + 'edits.json', 'utf8'));
const sha = value => createHash('sha256').update(value).digest('hex');
const newTexts = new Map(ready.source.map(row => {
  const text = fs.readFileSync(row.path, 'utf8'); assert.equal(sha(text), row.sha256); return [row.path, text];
}));
function parse(text, file) {
  const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
  assert.deepEqual(sf.parseDiagnostics, [], file); return sf;
}
function program(node, sf) {
  let typedNodes = 0, nodeArrays = 0, nonCommentLeaves = 0;
  const isDoc = n => n.kind >= ts.SyntaxKind.FirstJSDocNode && n.kind <= ts.SyntaxKind.LastJSDocNode;
  function tree(n) {
    typedNodes++;
    const children = [];
    ts.forEachChild(n, c => { if (!isDoc(c)) children.push(tree(c)); }, a => {
      nodeArrays++; children.push(['NodeArray', a.length, !!a.hasTrailingComma, a.filter(n => !isDoc(n)).map(tree)]);
    });
    return [n.kind, children];
  }
  function tokens(n) {
    const children = n.getChildren(sf).filter(n => !isDoc(n));
    if (!children.length) { nonCommentLeaves++; return [n.kind, n.getText(sf)]; }
    return [n.kind, children.map(tokens)];
  }
  return { tree: tree(node), tokens: tokens(node), metrics: { typedNodes, nodeArrays, nonCommentLeaves } };
}
function signature(node, sf) { const p = program(node, sf); return JSON.stringify({ tree:p.tree,tokens:p.tokens }); }
function collect(sf, predicate) {
  const nodes = [];
  function walk(n) { if (predicate(n)) nodes.push(n); ts.forEachChild(n, c => { walk(c); }); }
  walk(sf); return nodes;
}
function declared(sf, name) {
  const node = collect(sf, n => ts.isVariableStatement(n) && n.declarationList.declarations.some(d => d.name.getText(sf) === name))[0];
  assert.ok(node, 'declaration:' + name); return node;
}
function fn(sf, name) {
  const node = sf.statements.find(n => ts.isFunctionDeclaration(n) && n.name?.text === name);
  assert.ok(node, 'function:' + name); return node;
}
const emits = [], programs = [], oldSF = new Map(), actualSF = new Map();
const compilerOptions = module => ({ target:ts.ScriptTarget.ES2022,module,removeComments:true });
function emit(text, file, module) { return ts.transpileModule(text,{ fileName:file,compilerOptions:compilerOptions(module) }).outputText; }
for (const row of before.source) {
  assert.equal(sha(row.text), row.sha256);
  const current = newTexts.get(row.path), mapping = edits.source.find(n => n.path === row.path);
  let forward = row.text, inverse = current;
  for (const e of [...mapping.edits].reverse()) {
    assert.equal(row.text.slice(e.beforeStart,e.beforeEnd),e.before);
    assert.equal(current.slice(e.afterStart,e.afterEnd),e.after);
    forward = forward.slice(0,e.beforeStart)+e.after+forward.slice(e.beforeEnd);
    inverse = inverse.slice(0,e.afterStart)+e.before+inverse.slice(e.afterEnd);
  }
  assert.equal(forward,current);assert.equal(inverse,row.text);
  const a=parse(row.text,row.path),b=parse(current,row.path),c=parse(inverse,row.path);
  assert.equal(signature(c,c),signature(a,a));oldSF.set(row.path,a);actualSF.set(row.path,b);
  programs.push({path:row.path,wholeForwardInverse:true,exactEdits:mapping.edits.length,original:program(a,a).metrics,current:program(b,b).metrics});
  for (const module of [ts.ModuleKind.ESNext,ts.ModuleKind.CommonJS]) {
    const originalJS=emit(row.text,row.path,module),restoredJS=emit(inverse,row.path,module),actualJS=emit(current,row.path,module);
    assert.equal(originalJS,restoredJS);
    emits.push({path:row.path,module:ts.ModuleKind[module],wholeInverseRawSame:true,originalSHA256:sha(originalJS),inverseSHA256:sha(restoredJS),actualSHA256:sha(actualJS),intentionalActualDifference:actualJS!==originalJS});
  }
}
for (const row of ready.source.filter(row => !oldSF.has(row.path))) {
  const sf=parse(newTexts.get(row.path),row.path);actualSF.set(row.path,sf);
  programs.push({path:row.path,newSource:true,current:program(sf,sf).metrics});
}
const seerPath=before.source[0].path,badgeChoicePath=before.source[1].path,badgePath=before.source[2].path;
const seerOld=oldSF.get(seerPath),seer=actualSF.get(seerPath),choiceOld=oldSF.get(badgeChoicePath),choice=actualSF.get(badgeChoicePath),badgeOld=oldSF.get(badgePath),badge=actualSF.get(badgePath);
const protectedPrograms=[];
function same(name,left,leftSF,right,rightSF) {
  assert.equal(signature(left,leftSF),signature(right,rightSF),name);
  protectedPrograms.push({name,completeProgramSame:true,sha256:sha(signature(left,leftSF))});
}
// 每个原 if 的完整正文仍实际存在；新增交付守卫不能替代原生命／资格／错误分支。
const newSeerIfs=collect(seer,ts.isIfStatement).map(n=>signature(n,seer));
for(const oldIf of collect(seerOld,ts.isIfStatement)) {
  const s=signature(oldIf,seerOld),i=newSeerIfs.indexOf(s);assert.notEqual(i,-1,'original_seer_if:'+oldIf.expression.getText(seerOld));newSeerIfs.splice(i,1);
}
for(const name of ['day','targets','identities','legalTargets','result','targetId','target','mapping','receipt','effectiveId','effectiveIdentity','inspection','isWerewolf','seerRole','seerState'])
  same('seer_declaration_'+name,declared(seerOld,name),seerOld,declared(seer,name),seer);
same('seer_export',declared(seerOld,'SEER_NIGHT_STAGES'),seerOld,declared(seer,'SEER_NIGHT_STAGES'),seer);
const oldReq=declared(seerOld,'req').getText(seerOld),newReq=declared(seer,'req').getText(seer);
const assignment='(requestAbilityId = ability.id)';
assert.equal(newReq.split(assignment).length,2);
const mappedRequest=parse(newReq.replace(assignment,'ability.id'),'mapped-request.ts');
const originalRequest=parse(oldReq,'mapped-request.ts');
assert.equal(signature(mappedRequest,mappedRequest),signature(originalRequest,originalRequest));
function statementText(sf,needle) {
  const node=collect(sf,n=>ts.isExpressionStatement(n)&&n.getText(sf).startsWith(needle))[0];assert.ok(node,'statement:'+needle);return node;
}
// 原支付前缀在同步启动后完整保序；此后不插 isEligible／current 反查。
function expressionStatements(sf) { return collect(sf,ts.isExpressionStatement); }
for(const needle of ['commitFoxInspection(','ctx.state.seerChecks.push(','recordNightAbilityUse(','ctx.nativeNightEffects.recordModifierTarget(','ctx.nativeNightEffects.commitNativeReflection(','recordOwnNightAction(','ctx.events.push('])
  same('seer_paid_'+needle,statementText(seerOld,needle),seerOld,statementText(seer,needle),seer);
for(const name of ['badge','life','role','version','weight','current','candidates','scopes','permit','authorized','request','checked'])
  same('badge_choice_declaration_'+name,declared(choiceOld,name),choiceOld,declared(choice,name),choice);
for(const oldFunction of badgeOld.statements.filter(ts.isFunctionDeclaration)) {
  if(oldFunction.name.text==='commitSheriffBadgeChoice')continue;
  same('badge_retained_'+oldFunction.name.text,oldFunction,badgeOld,fn(badge,oldFunction.name.text),badge);
}
const oldCommit=fn(badgeOld,'commitSheriffBadgeChoice'),newCommit=fn(badge,'commitSheriffBadgeChoice');
assert.equal(newCommit.parameters.length,oldCommit.parameters.length+2);
for(let i=0;i<oldCommit.parameters.length;i++)same('badge_original_parameter_'+i,oldCommit.parameters[i],badgeOld,newCommit.parameters[i],badge);
assert.equal(newCommit.parameters.at(-2).name.getText(badge),'onDomainCommitted');
assert.equal(newCommit.parameters.at(-1).name.getText(badge),'beforeDomainCommit');
const callbackCalls=collect(newCommit,n=>ts.isExpressionStatement(n)&&n.expression.expression?.getText(badge)==='onDomainCommitted');
assert.equal(callbackCalls.length,2);
// 从 actual 新函数只移除两处完成通知与新增首写守卫；其余完整原体必须逐字程序相同。
const unpaidGuard=collect(newCommit,n=>ts.isIfStatement(n)&&n.expression.getText(badge).startsWith('beforeDomainCommit !== undefined'))[0];
assert.ok(unpaidGuard);
assert.equal(unpaidGuard.thenStatement.getText(badge),'return null;');
const commitStatements=newCommit.body.statements,guardIndex=commitStatements.indexOf(unpaidGuard);
assert.ok(commitStatements[guardIndex-1].getText(badge).startsWith('const nextSheriffId'));
assert.equal(commitStatements[guardIndex+1].getText(badge),'badge.isSheriff = false;');
let mappedBody=newCommit.body.getText(badge);
const bodyStart=newCommit.body.getStart(badge);
for(const n of [...callbackCalls,unpaidGuard].sort((a,b)=>b.getStart(badge)-a.getStart(badge))) {
  const start=n.getStart(badge)-bodyStart,end=n.getEnd()-bodyStart;mappedBody=mappedBody.slice(0,start)+mappedBody.slice(end);
}
const oldBody=parse('function original()'+oldCommit.body.getText(badgeOld),'commit-body.ts');
const restoredBody=parse('function original()'+mappedBody,'commit-body.ts');
assert.equal(signature(oldBody,oldBody),signature(restoredBody,restoredBody));
function ordered(text,needles) {let at=0;for(const n of needles){const i=text.indexOf(n,at);assert.notEqual(i,-1,'ordered:'+n);at=i+n.length;}return needles;}
const seerText=newTexts.get(seerPath),choiceText=newTexts.get(badgeChoicePath),badgeText=newTexts.get(badgePath);
const seerOrder=ordered(seerText,['delivery = openNativeNightRequestDelivery({','const provider = ctx.actionProvider;','const getAction = provider.getAction;','const actionArguments:','const invokeAction = Reflect.apply.bind(Reflect);','if (!delivery.current()) continue;','await invokeAction(getAction, provider, actionArguments);','const effects = ctx.nativeNightEffects;','const commitReflectedTarget = effects.commitReflectedTarget;','const reflectedArguments:','const invokeReflectedTarget = Reflect.apply.bind(Reflect);','if (!delivery.current()) continue;','invokeReflectedTarget(commitReflectedTarget, effects, reflectedArguments);','if (seerState)','commitFoxInspection(','ctx.state.seerChecks.push(','recordNightAbilityUse(','ctx.nativeNightEffects.recordModifierTarget(','ctx.nativeNightEffects.commitNativeReflection(','recordOwnNightAction(','delivery.complete();','ctx.events.push({']);
const paidStart=seerText.indexOf('invokeReflectedTarget(commitReflectedTarget, effects, reflectedArguments);'),completeAt=seerText.indexOf('delivery.complete();',paidStart);
const paidSection=seerText.slice(paidStart,completeAt);
assert.equal(paidSection.includes('scope.isEligible()'),false);assert.equal(paidSection.includes('delivery.current()'),false);
assert.equal((seerText.match(/delivery\.complete\(\)/g)||[]).length,1);
const choiceOrder=ordered(choiceText,['const permit = world.openDeathAction(','let delivery: RequestLeaseTurn | undefined;','const request = new construction.requestFactory(','const requestScope: BadgeChoiceRequestScope','badgeRequests.bind(requestScope, request);','delivery = badgeRequests.openDelivery(requestScope, request);','const getAction = provider.getAction;','const actionArguments:','const invokeAction = Reflect.apply.bind(Reflect);','if (!delivery.current()) return;','await invokeAction(getAction, provider, actionArguments);','if (!authorized()) return;','const commit = commitSheriffBadgeChoice;','const commitArguments:','world, fromId, reason, events, target, undefined,','() => delivery!.complete(), () => delivery!.current(),','const invokeCommit = Reflect.apply.bind(Reflect);','if (!delivery.current()) return;','invokeCommit(commit, undefined, commitArguments);','} catch (error)','permit.close();','if (failed)','delivery?.close();']);
for(const call of callbackCalls) {
  const siblings=call.parent.statements,i=siblings.indexOf(call);
  assert.ok(siblings[i-1].getText(badge).startsWith('frame?.commit('));
  assert.ok(siblings[i+1].getText(badge).startsWith('events.push('));
}
const nativePath='backend/src/game/mechanisms/stages/night/native-request-lease.ts',native=actualSF.get(nativePath);
function leaseMetadata(sf,name,order,pins) {
  const statement=declared(sf,name),call=statement.declarationList.declarations[0].initializer;
  assert.equal(call.expression.getText(sf),'RequestLease.window');assert.equal(call.arguments[1].getText(sf),String(order));
  assert.deepEqual(call.arguments[2].elements.map(n=>n.text),pins);
  return {order,contextPins:pins,actualWholeStatementSHA256:sha(signature(statement,sf))};
}
const nativeLease=leaseMetadata(native,'nativeNightRequests',140,['ability_id']);
const badgeLease=leaseMetadata(choice,'badgeRequests',150,['trigger','death_action_id','badge_candidates','allow_fallback']);
assert.ok(newTexts.get(nativePath).includes('if (request.context.ability_id !== scope.abilityId) return;'));
assert.equal(collect(native,n=>ts.isNewExpression(n)&&n.expression.getText(native)==='WeakMap').length,0);
const retainedImports=[];
for(const row of before.source) {
  const old=oldSF.get(row.path),now=actualSF.get(row.path);
  for(const i of old.statements.filter(ts.isImportDeclaration)) {
    const kept=now.statements.find(n=>ts.isImportDeclaration(n)&&signature(n,now)===signature(i,old));
    assert.ok(kept,'original_import:'+row.path+':'+i.moduleSpecifier.text);
    retainedImports.push({consumer:row.path,module:i.moduleSpecifier.text,completeClauseSame:true});
  }
}
const directImports=[];
for(const file of [nativePath,seerPath,badgeChoicePath]) {
  const sf=actualSF.get(file);
  for(const i of sf.statements.filter(ts.isImportDeclaration)) {
    if(!['../../../../domain/request-lease','../../../domain/request-lease','../../stages/night/native-request-lease'].includes(i.moduleSpecifier.text))continue;
    const resolved=ts.resolveModuleName(i.moduleSpecifier.text,path.resolve(file),{moduleResolution:ts.ModuleResolutionKind.Bundler},ts.sys).resolvedModule;
    assert.ok(resolved);directImports.push({consumer:file,module:i.moduleSpecifier.text,endpoint:path.relative(process.cwd(),resolved.resolvedFileName),clause:i.importClause.getText(sf)});
  }
}
assert.equal(directImports.length,4);
const unitPath='backend/tests/unit/mechanisms/ordinary-native-badge-request-completion.test.ts',unit=actualSF.get(unitPath);
const testCalls=collect(unit,n=>ts.isCallExpression(n)&&ts.isIdentifier(n.expression)&&n.expression.text==='test');assert.equal(testCalls.length,9);
const controls=before.controls.map(row=>{assert.equal(sha(fs.readFileSync(row.path)),row.sha256);return {path:row.path,sha256:row.sha256};});
const report={baseCommit:before.baseCommit,sourceReadySHA256:sha(fs.readFileSync(prefix+'source-ready.json')),source:ready.source,programs,exactEdits:edits.source.reduce((n,r)=>n+r.edits.length,0),wholeForwardInversePrograms:before.source.length,inverseEmits:emits,protectedPrograms,originalSeerCompleteIfPrograms:collect(seerOld,ts.isIfStatement).length,originalRequestMappedOnlyCapturedAssignment:true,actualBadgeBodyInverseOnlyTwoCallbackStatementsAndUnpaidGuard:true,retainedImports,directImports,nativeLease,badgeLease,seerOrder,choiceOrder,paidSectionDoesNotQueryEligibility:true,newTestDeclarations:testCalls.map(n=>n.arguments[0].text),controls,
 limits:['有意新增F02绑定／期限／结算行为；完整逆证明文本范围而非新旧行为等价。','全NodeArray／非注释叶比较覆盖旧程序逆与指定保留体；原committer移除恰好两个新callback及首写守卫后完整原体相同。','两个新文件解析和九声明只属静态输入；不执行产品、单元、类型或职责头，不据此冒实际测试绿。','新增Reflect查找／bind分配／调用栈和callback参数、函数length／模块加载是明确API观察；不声称任意Proxy／setter事务隔离。']};
fs.writeFileSync(prefix+'proof.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({wholeOriginals:before.source.length,newSources:ready.source.length-before.source.length,exactEdits:report.exactEdits,programs:programs.map(n=>({path:n.path,...n.current})),inverseWholeOutputs:emits.length,completeProtectedPrograms:protectedPrograms.length,originalSeerIfs:report.originalSeerCompleteIfPrograms,retainedImports:retainedImports.length,directImports:directImports.length,testDeclarations:testCalls.length,controls:controls.length}));
