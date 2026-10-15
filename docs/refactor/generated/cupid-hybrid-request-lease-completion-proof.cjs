/**
 * 负责本批真实前态、精确整程序正逆和保留算法证明；只解析／转译源码，不导入生产模块或执行规则。
 * F02 新字段读取、动态协议、guard、try/finally 与 settlement 是明确行为变化，不宣称完整新旧 JS 相同。
 */
const fs = require('node:fs'), assert = require('node:assert/strict'), {createHash} = require('node:crypto');
const ts = require('../../../backend/node_modules/typescript');
const prefix = 'docs/refactor/generated/cupid-hybrid-request-lease-completion-';
const before = JSON.parse(fs.readFileSync(prefix+'before.json','utf8'));
const edits = JSON.parse(fs.readFileSync(prefix+'edits.json','utf8')).edits;
const ready = JSON.parse(fs.readFileSync(prefix+'source-ready.json','utf8'));
const sha = text => createHash('sha256').update(text).digest('hex');
const totals = {typedNodesBothSides:0,nodeArraysBothSides:0,noncommentLeavesBothSides:0};
function parse(text,path) { const source = ts.createSourceFile(path,text,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS); assert.equal(source.parseDiagnostics.length,0,path); return source; }
function tree(node,source) {
  const walk = n => { totals.typedNodesBothSides++; const children=[];
    ts.forEachChild(n,c=>{children.push(walk(c));},array=>{totals.nodeArraysBothSides++;children.push(['NodeArray',array.length,!!array.hasTrailingComma,...array.map(walk)]);});
    return [n.kind,children]; };
  const leaves = n => { const children=n.getChildren(source).filter(c=>c.kind<ts.SyntaxKind.FirstJSDocNode||c.kind>ts.SyntaxKind.LastJSDocNode);
    if (!children.length) {totals.noncommentLeavesBothSides++;return[n.kind,n.getText(source)];} return[n.kind,children.map(leaves)]; };
  return [walk(node),leaves(node)];
}
function find(source,predicate,label) { const found=[]; function walk(n){if(predicate(n))found.push(n);ts.forEachChild(n,c=>{walk(c);});}walk(source);assert.equal(found.length,1,label+':'+found.length);return found[0]; }
function same(a,b,select,label) { assert.deepEqual(tree(select(a),a),tree(select(b),b),label);return{label,completeTypedNodeArrayAndLeavesSame:true}; }
function emit(text,path,module) { return ts.transpileModule(text,{fileName:path,compilerOptions:{target:ts.ScriptTarget.ES2022,module,removeComments:true}}).outputText; }
const parsed = new Map();
const programs = before.sources.map(original=>{
  assert.equal(sha(original.text),original.sha256,original.path);
  const current=fs.readFileSync(original.path,'utf8'),sample=ready.source.find(row=>row.path===original.path);
  assert.equal(sha(current),sample.sha256,original.path);
  let forward=original.text;const positions=[],own=edits.filter(edit=>edit.path===original.path);
  for(const edit of own){assert.equal(forward.split(edit.old).length,2,edit.path);const at=forward.indexOf(edit.old);positions.push(at);forward=forward.slice(0,at)+edit.new+forward.slice(at+edit.old.length);}
  assert.equal(forward,current,original.path+':whole_forward');
  let inverse=current;
  for(let index=own.length-1;index>=0;index--){const edit=own[index],at=positions[index];assert.equal(inverse.slice(at,at+edit.new.length),edit.new);inverse=inverse.slice(0,at)+edit.old+inverse.slice(at+edit.new.length);}
  assert.equal(inverse,original.text,original.path+':whole_inverse');
  const a=parse(original.text,original.path),b=parse(current,original.path);parsed.set(original.path,{a,b});
  const outputs=[ts.ModuleKind.ESNext,ts.ModuleKind.CommonJS].map(module=>{const old=emit(original.text,original.path,module),back=emit(inverse,original.path,module),now=emit(current,original.path,module);assert.equal(back,old);return{module:ts.ModuleKind[module],inverseWholeRawSame:true,actualOldAndNewRawSame:now===old,beforeSha256:sha(old),afterSha256:sha(now)};});
  return{path:original.path,beforeSha256:original.sha256,afterSha256:sha(current),exactEdits:own.length,wholeForwardInverse:true,outputs};
});
const retained=[];
const core=parsed.get('backend/src/core/domain/request-lease.ts');
for(const name of ['actorPhaseDayStage','stagePhaseDayActor','actorPhaseStageDay','item','bind','entry','capture','scope','openDelivery','bindDelivery','finish','inherit'])
  retained.push(same(core.a,core.b,source=>find(source,node=>ts.isMethodDeclaration(node)&&node.name?.getText(source)===name,name),'RequestLease.'+name));
for(const name of ['records','propagate']) retained.push(same(core.a,core.b,source=>find(source,node=>ts.isPropertyDeclaration(node)&&node.name?.getText(source)===name,name),'RequestLease.'+name));
retained.push(same(core.a,core.b,source=>find(source,ts.isConstructorDeclaration,'constructor'),'RequestLease.constructor'));
for(const family of ['cupid','hybrid']) {
  const pair=parsed.get('backend/src/game/mechanisms/roles/'+family+'/night_stage.ts');
  const names=['current','canAct','targets','requestActor','requestTools','requestExtras','requestArgs','invokeRequest','request','actionArgs','invokeAction','action','valid'];
  names.push(...(family==='cupid'?['pairIds','selected','record','memberIds']:['targetId','target','membership','commitChoice','days']));
  for(const name of names) retained.push(same(pair.a,pair.b,source=>find(source,node=>ts.isVariableDeclaration(node)&&ts.isIdentifier(node.name)&&node.name.text===name,name),family+':'+name));
  const oldFacts=[],newFacts=[];
  function facts(source,out){function walk(node){if(ts.isExpressionStatement(node)&&ts.isCallExpression(node.expression)&&node.expression.expression.getText(source)==='ctx.events.push')out.push(node);ts.forEachChild(node,c=>{walk(c);});}walk(source);}
  facts(pair.a,oldFacts);facts(pair.b,newFacts);assert.equal(newFacts.length,oldFacts.length);
  for(let i=0;i<oldFacts.length;i++){assert.deepEqual(tree(oldFacts[i],pair.a),tree(newFacts[i],pair.b),family+':fact'+i);retained.push({label:family+':complete_fact'+i,completeTypedNodeArrayAndLeavesSame:true});}
  const payment=family==='cupid'?'commitCupidChoice':'commitChoice';
  retained.push(same(pair.a,pair.b,source=>find(source,node=>ts.isExpressionStatement(node)&&ts.isCallExpression(node.expression)&&node.expression.expression.getText(source)===payment,payment),family+':choice_payment'));
  retained.push(same(pair.a,pair.b,source=>find(source,node=>ts.isCallExpression(node)&&node.expression.getText(source)==='ctx.world.addComponent','Victory install'),family+':Victory_install'));
  if(family==='hybrid') for(const callee of ['days.add','committed.set']) retained.push(same(pair.a,pair.b,source=>find(source,node=>ts.isCallExpression(node)&&node.expression.getText(source)===callee,callee),family+':'+callee));
}
for(const control of before.controls)assert.equal(sha(fs.readFileSync(control.path)),control.sha256,control.path);
for(const row of ready.source) assert.equal(sha(fs.readFileSync(row.path)),row.sha256,row.path);
const result={approved:true,baseCommit:before.baseCommit,sampledSourceReadySHA256:sha(fs.readFileSync(prefix+'source-ready.json')),programs,retained,controls:before.controls,
 summary:{existingPrograms:programs.length,newUnit:1,exactEdits:edits.length,inverseWholeOutputs:programs.reduce((n,p)=>n+p.outputs.length,0),retainedCompleteNodes:retained.length,...totals},
 limits:['完整精确整程序正逆是本批编辑来源证明；新旧实际JS有意不同，不代表F02行为等价。','原四协议、lease元数据／alias／finish、两族纯current／canAct、请求与Provider表达式及付款／事实完整节点按真实AST保留；新增guard、动态窗口和错误通知边界由新字面单元验收。','typed/NodeArray/非注释叶计数是多项两侧累计，不是distinct完整仓库节点；没有whole新旧AST等同、全consumer或冷执行声明。','只解析和转译选中源码，不运行类型／职责头／业务／产品／全量门禁；新selected-context捕获API及窗口行为变化单独公开。']};
fs.writeFileSync(prefix+'proof.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result.summary));
