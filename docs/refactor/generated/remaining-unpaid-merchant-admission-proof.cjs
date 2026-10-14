/** 核两商人完整程序的精确编辑逆、未改数据程序及已付谓词；输入固定Git前样和冻结七源码，输出实际静态/转译证据，不执行阶段或新风险。 */
const fs=require('node:fs'),crypto=require('node:crypto');
const ts=require('../../../backend/node_modules/typescript');
const prefix='docs/refactor/generated/remaining-unpaid-merchant-admission-',sha=x=>crypto.createHash('sha256').update(x).digest('hex');
const before=JSON.parse(fs.readFileSync(prefix+'before.json','utf8')),edits=JSON.parse(fs.readFileSync(prefix+'edits.json','utf8')).edits,ready=JSON.parse(fs.readFileSync(prefix+'source-ready.json','utf8'));
const assert=(v,l)=>{if(!v)throw Error(l)};
const parse=(p,s)=>ts.createSourceFile(p,s,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS);
const current=new Map(ready.source.map(r=>{const text=fs.readFileSync(r.path,'utf8');assert(sha(text)===r.sha256,'ready_drift:'+r.path);return [r.path,text]}));
const files=[], restoredSources=new Map();let nodes=0,arrays=0,leaves=0;
function tree(n,sf){nodes++;const out=[];ts.forEachChild(n,c=>{out.push(tree(c,sf))},a=>{arrays++;out.push({array:a.map(c=>tree(c,sf)),trailing:!!a.hasTrailingComma})});if(!out.length){leaves++;return [n.kind,n.getText(sf)]}return [n.kind,out]}
const tokens=s=>{const scan=ts.createScanner(ts.ScriptTarget.Latest,true,ts.LanguageVariant.Standard,s),out=[];for(let t=scan.scan();t!==ts.SyntaxKind.EndOfFileToken;t=scan.scan())out.push([t,scan.getTokenText()]);return out};
const emit=(p,s,m)=>{const r=ts.transpileModule(s,{fileName:p,compilerOptions:{target:ts.ScriptTarget.ES2022,module:m,removeComments:true},reportDiagnostics:true});assert(!r.diagnostics?.some(x=>x.category===ts.DiagnosticCategory.Error),'emit_diagnostics');return r.outputText};
const modules=[['ESNext',ts.ModuleKind.ESNext],['CommonJS',ts.ModuleKind.CommonJS]];
for(const r of before.source){
 let forward=r.text,inverse=current.get(r.path);const steps=edits.filter(e=>e.path===r.path);
 for(const e of steps){assert(forward.split(e.before).length===2,'forward_anchor:'+r.path);forward=forward.replace(e.before,e.after)}
 for(const e of [...steps].reverse()){assert(inverse.split(e.after).length===2,'inverse_anchor:'+r.path);inverse=inverse.replace(e.after,e.before)}
 assert(forward===current.get(r.path),'whole_forward:'+r.path);assert(inverse===r.text,'whole_inverse:'+r.path);restoredSources.set(r.path,inverse);
 const old=parse(r.path,r.text),restored=parse(r.path,inverse);assert(JSON.stringify(tree(old,old))===JSON.stringify(tree(restored,restored)),'tree_inverse');assert(JSON.stringify(tokens(r.text))===JSON.stringify(tokens(inverse)),'tokens_inverse');
 const outputs=modules.map(([name,m])=>{const a=emit(r.path,r.text,m),b=emit(r.path,current.get(r.path),m),c=emit(r.path,inverse,m);assert(a===c,'whole_emit_inverse');return{module:name,beforeSHA256:sha(a),currentSHA256:sha(b),actualRawSame:a===b,completeInverseRawSame:true}});
 if(r.path.endsWith('/state.ts')){const now=parse(r.path,current.get(r.path));assert(JSON.stringify(tree(old,old))===JSON.stringify(tree(now,now)),'state_program_changed');assert(JSON.stringify(tokens(r.text))===JSON.stringify(tokens(current.get(r.path))),'state_tokens_changed');assert(outputs.every(x=>x.actualRawSame),'state_emit_changed')}
 files.push({path:r.path,beforeSHA256:r.sha256,currentSHA256:sha(current.get(r.path)),preciseEdits:steps.length,completeForward:true,completeInverse:true,outputs,stateCommentOnly:r.path.endsWith('/state.ts')});
}
const find=(sf,predicate)=>{const found=[];function visit(n){if(predicate(n))found.push(n);ts.forEachChild(n,visit)}visit(sf);assert(found.length===1,'protected_node_nonunique');return found[0]};
const protectedPrograms=[];
function protect(path,label,oldText,newText){
 const a=parse(label+'.ts',oldText),b=parse(label+'.ts',newText);assert(JSON.stringify(tree(a,a))===JSON.stringify(tree(b,b)),'protected_tree:'+label);assert(JSON.stringify(tokens(oldText))===JSON.stringify(tokens(newText)),'protected_tokens:'+label);
 const outputs=modules.map(([name,m])=>{const old=emit(label+'.ts',oldText,m),now=emit(label+'.ts',newText,m);assert(old===now,'protected_emit:'+label);return{module:name,sha256:sha(old),rawSame:true}});
 protectedPrograms.push({path,label,beforeText:oldText,currentText:newText,wholeSyntaxAndTokenSame:true,outputs});
}
for(const r of before.source.filter(x=>x.path.endsWith('/night_stage.ts'))){
 const a=parse(r.path,r.text),b=parse(r.path,current.get(r.path));
 for(const name of ['ownerCurrent','committed']){
  const old=find(a,n=>ts.isVariableDeclaration(n)&&n.name.getText(a)===name).initializer.getText(a),now=find(b,n=>ts.isVariableDeclaration(n)&&n.name.getText(b)===name).initializer.getText(b);
  protect(r.path,name,'const '+name+' = '+old+';','const '+name+' = '+now+';');
 }
 for(const name of ['recordCommit',r.path.includes('/miracle_merchant/')?'hasMerchantNightCommit':'hasBlackMarketNightCommit']){
  const old=find(a,n=>ts.isFunctionDeclaration(n)&&n.name?.text===name).getText(a),now=find(b,n=>ts.isFunctionDeclaration(n)&&n.name?.text===name).getText(b);protect(r.path,name,old,now);
 }
 const name=r.path.includes('/miracle_merchant/')?'!failure':'!failed';
 const inverseSF=parse(r.path,restoredSources.get(r.path));const oldGood=find(a,n=>ts.isIfStatement(n)&&n.expression.getText(a)===name).getText(a),inverseGood=find(inverseSF,n=>ts.isIfStatement(n)&&n.expression.getText(inverseSF)===name).getText(inverseSF);protect(r.path,'complete_good_grant_block_exact_inverse',oldGood,inverseGood);
 const tail=s=>{const start=s.lastIndexOf('recordCommit(ctx.world, day);'),end=s.indexOf('        completed = true;',start);assert(start>=0&&end>start,'paid_tail_range');return s.slice(start,end)};
 protect(r.path,'complete_paid_record_backlash_and_facts','function paidTail(){\n'+tail(r.text)+'\n}','function paidTail(){\n'+tail(current.get(r.path))+'\n}');
}
for(const r of before.source.filter(x=>x.path.endsWith('/profile.ts'))){
 const a=parse(r.path,r.text),b=parse(r.path,current.get(r.path));
 for(const name of ['metadata','init','configuration','toolSpecs','llmRepair','baselineAction','presentation']){
  const old=find(a,n=>ts.isPropertyAssignment(n)&&n.name.getText(a)===name).initializer.getText(a),now=find(b,n=>ts.isPropertyAssignment(n)&&n.name.getText(b)===name).initializer.getText(b);
  protect(r.path,'original_'+name,'const original = '+old+';','const original = '+now+';');
 }
}
const preparedGrantCalls=[];
for(const r of before.source.filter(x=>x.path.endsWith('/night_stage.ts'))){
 const a=parse(r.path,r.text),b=parse(r.path,current.get(r.path)),oldCalls=[],tuples=[];
 function oldVisit(n){if(ts.isCallExpression(n)&&['grantNightAbility','grantDeathGun'].includes(n.expression.getText(a)))oldCalls.push(n);ts.forEachChild(n,oldVisit)}oldVisit(a);
 function newVisit(n){if(ts.isVariableDeclaration(n)&&n.name.getText(b)==='grantArgs')tuples.push(n);ts.forEachChild(n,newVisit)}newVisit(b);
 assert(oldCalls.length===tuples.length,'prepared_grant_count');
 for(let i=0;i<oldCalls.length;i++){
  const old=oldCalls[i],tuple=tuples[i],decls=tuple.parent.declarations,callee=decls.find(d=>d.name.getText(b)==='grant').initializer;
  assert(callee.getText(b)===old.expression.getText(a),'prepared_callee');assert(ts.isArrayLiteralExpression(tuple.initializer),'prepared_tuple');
  const args=tuple.initializer.elements;assert(args.length===old.arguments.length,'prepared_arity');
  for(let j=0;j<args.length;j++)assert(JSON.stringify(tree(old.arguments[j],a))===JSON.stringify(tree(args[j],b)),'whole_actual_argument_tree');
  const block=tuple.parent.parent.parent;assert(ts.isBlock(block),'prepared_own_block');
  const call=block.statements.find(n=>ts.isExpressionStatement(n)&&ts.isCallExpression(n.expression)&&n.expression.expression.getText(b)==='grant');
  const guard=block.statements.find(n=>ts.isIfStatement(n)&&n.expression.getText(b)==='isRoleExecutionRetired(role)');
  assert(call&&guard&&tuple.end<guard.getStart(b)&&guard.end<=call.getStart(b),'last_guard_order');
  assert(call.expression.arguments.every(n=>ts.isIdentifier(n)),'bare_prepared_arguments');
  preparedGrantCalls.push({path:r.path,originalCallee:old.expression.getText(a),originalArgumentCount:old.arguments.length,completeOriginalArgumentTreesSame:true,tupleText:tuple.initializer.getText(b),preparedOwnSlotLocals:true,terminalGuardAfterAllArguments:true,bareOriginalCalleeAfterGuard:true});
 }
}
const exportNames=sf=>sf.statements.filter(n=>n.modifiers?.some(m=>m.kind===ts.SyntaxKind.ExportKeyword)).flatMap(n=>ts.isVariableStatement(n)?n.declarationList.declarations.map(d=>d.name.getText(sf)):n.name?[n.name.getText(sf)]:[]);
const bindings=before.source.map(r=>{const a=parse(r.path,r.text),b=parse(r.path,current.get(r.path));const x=exportNames(a),y=exportNames(b);assert(JSON.stringify(x)===JSON.stringify(y),'public_exports_changed');return{path:r.path,namedExports:x,currentSameNamesOrder:true}});
const controls=before.controls.map(r=>{assert(sha(fs.readFileSync(r.path))===r.sha256,'control_drift:'+r.path);return{path:r.path,sha256:r.sha256}});
const report={baseCommit:before.baseCommit,source:ready.source,deleted:[],input:{beforeSHA256:sha(fs.readFileSync(prefix+'before.json')),editsSHA256:sha(fs.readFileSync(prefix+'edits.json')),sourceReadySHA256:sha(fs.readFileSync(prefix+'source-ready.json'))},wholePrograms:files,preciseEdits:edits.length,completeComparisons:{nodesBothSides:nodes,nodeArraysBothSides:arrays,leavesBothSides:leaves},protectedPrograms,preparedGrantCalls,bindings,controls,unit:{path:before.new[0].path,beforeGitAbsent:true,currentSHA256:sha(current.get(before.new[0].path)),scope:'New independent literal risk program, not equivalent to a prior program; runtime evidence belongs to the separately executed unit receipt.'},requestObservation:ready.staticRequestFinding,limits:['Exact inverse proves every original program and old order is retained outside the enumerated F05e differences; it does not label four stage/profile actual JS outputs equal.','Two data owners are only comments and their complete tree/tokens/4 actual outputs are equal.','Protected snippets include complete pure owner/paid tail. Good block comparison is explicitly its full exact inverse; six current callee/full-argument preparations are separately compared to all original argument trees, not claimed current blocks byte-equal.','Reflect/apply/bind observation and argument arrays are explicit behavior/API channels prepared before the new terminal guard; default method receivers and original callable lookup order are preserved.','No production imports, business cases, typecheck or full architecture gate run inside this tool.']};
fs.writeFileSync(prefix+'proof.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({source:7,oldPrograms:6,newUnit:1,preciseEdits:edits.length,wholeInverseOutputs:12,stateOnlyActualOutputs:4,protectedPrograms:protectedPrograms.length,protectedOutputs:protectedPrograms.length*2,preparedGrantCalls:preparedGrantCalls.length,publicModuleAPIs:bindings.length,controls:controls.length,nodesBothSides:nodes,nodeArraysBothSides:arrays,leavesBothSides:leaves}));
