/** 只证明实际原文、精确增量及未改的付款／已付当前性；不执行角色或把新 F02 当旧 JS 等价。 */
const fs=require('node:fs'),cp=require('node:child_process'),assert=require('node:assert/strict'),{createHash}=require('node:crypto');
const ts=require('../../../backend/node_modules/typescript'),p='docs/refactor/generated/ghost-bride-request-terminal-revocation-';
const before=JSON.parse(fs.readFileSync(p+'before.json','utf8')),ready=JSON.parse(fs.readFileSync(p+'source-ready.json','utf8')),edits=JSON.parse(fs.readFileSync(p+'edits.json','utf8'));
const hash=b=>createHash('sha256').update(b).digest('hex');
function parse(file,text){const sf=ts.createSourceFile(file,text,ts.ScriptTarget.Latest,true);assert.deepEqual(sf.parseDiagnostics,[]);return sf;}
function tree(node,sf){let nodes=0,arrays=0,leaves=0;function walk(n){nodes++;const out=[];ts.forEachChild(n,c=>{out.push(walk(c));},a=>{arrays++;out.push(['NodeArray',a.length,!!a.hasTrailingComma,a.map(walk)]);});if(!out.length){leaves++;return[n.kind,n.getText(sf)];}return[n.kind,out];}return {shape:walk(node),counts:()=>({nodes,arrays,leaves})};}
const emit=(text,file,module)=>ts.transpileModule(text,{fileName:file,compilerOptions:{target:ts.ScriptTarget.ES2022,module,removeComments:true}}).outputText;
const changedFunctions=new Set(['validTurn','validConsent','ghostBrideRequestScope']);
const programs=before.source.map(row=>{
 const actual=fs.readFileSync(row.path,'utf8'),steps=edits.edits.filter(e=>e.path===row.path);
 assert.equal(hash(row.text),row.sha256);assert.equal(hash(actual),ready.source.find(x=>x.path===row.path).sha256);
 assert.equal(cp.execFileSync('git',['cat-file','blob',before.baseCommit+':'+row.path],{encoding:'utf8'}),row.text);
 let forward=row.text;for(const e of steps){assert.equal(forward.slice(e.start,e.start+e.before.length),e.before);forward=forward.slice(0,e.start)+e.after+forward.slice(e.start+e.before.length);}assert.equal(forward,actual);
 let inverse=actual;for(const e of [...steps].reverse()){assert.equal(inverse.slice(e.start,e.start+e.after.length),e.after);inverse=inverse.slice(0,e.start)+e.before+inverse.slice(e.start+e.after.length);}assert.equal(inverse,row.text);
 const a=parse(row.path,row.text),b=parse(row.path,actual),i=parse(row.path,inverse),ta=tree(a,a),ti=tree(i,i);assert.deepEqual(ti.shape,ta.shape);
 const protectedDeclarations=[];
 if(row.path.endsWith('/authority.ts')){
   const now=new Map(b.statements.filter(ts.isFunctionDeclaration).map(n=>[n.name.text,n]));
   for(const n of a.statements.filter(ts.isFunctionDeclaration)){const name=n.name.text;if(changedFunctions.has(name))continue;const nn=now.get(name);assert(nn,name);assert.deepEqual(tree(nn,b).shape,tree(n,a).shape,'unchanged function tree: '+name);for(const module of [ts.ModuleKind.ESNext,ts.ModuleKind.CommonJS])assert.equal(emit(nn.getText(b),row.path,module),emit(n.getText(a),row.path,module),'unchanged function emit: '+name);protectedDeclarations.push(name);}
   const oldNames=a.statements.filter(ts.isFunctionDeclaration).map(n=>n.name.text),newNames=b.statements.filter(ts.isFunctionDeclaration).map(n=>n.name.text);
   assert.deepEqual(newNames.filter(n=>!oldNames.includes(n)),['currentUnpaidRequestProof']);
 }else{
   const oldClass=a.statements.find(n=>ts.isClassDeclaration(n)&&n.name.text==='GhostBrideSetupWindow'),newClass=b.statements.find(n=>ts.isClassDeclaration(n)&&n.name.text==='GhostBrideSetupWindow');assert.equal(newClass.getText(b),oldClass.getText(a));protectedDeclarations.push('GhostBrideSetupWindow complete class');
   const oldFn=a.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name.text==='executeWeddingTurn'),newFn=b.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name.text==='executeWeddingTurn');
   const pivot='    if (!authorizedWeddingTurn(world, actorId, Phase.Night, day, scope))';
   const oldTail=oldFn.getText(a).slice(oldFn.getText(a).indexOf(pivot));
   const newTail=newFn.getText(b).slice(newFn.getText(b).indexOf(pivot,newFn.getText(b).indexOf('const raw = await invoke')));
   assert.equal(newTail,oldTail);protectedDeclarations.push('executeWeddingTurn original after-await validation/payment/facts/finally tail');
 }
 const outputs=[ts.ModuleKind.ESNext,ts.ModuleKind.CommonJS].map(module=>{const old=emit(row.text,row.path,module),current=emit(actual,row.path,module);assert.equal(emit(inverse,row.path,module),old);assert.notEqual(current,old);return{module:ts.ModuleKind[module],beforeSHA256:hash(old),actualSHA256:hash(current),wholeInverseRawSame:true,wholeActualRawSame:false};});
 return{path:row.path,exactEdits:steps.length,wholeForwardInverse:true,inverseTyped:ta.counts(),protectedDeclarations,outputs};
});
for(const row of before.controls){assert.equal(hash(fs.readFileSync(row.path)),row.sha256);assert.equal(cp.execFileSync('git',['cat-file','blob',before.baseCommit+':'+row.path],{encoding:'utf8'}),row.text);}
const unit=ready.source.at(-1),unitText=fs.readFileSync(unit.path,'utf8');assert.equal(hash(unitText),unit.sha256);const sf=parse(unit.path,unitText);let testDeclarations=0;function visit(n){if(ts.isCallExpression(n)&&ts.isIdentifier(n.expression)&&n.expression.text==='test')testDeclarations++;ts.forEachChild(n,visit);}visit(sf);assert.equal(testDeclarations,7);
const absent=cp.spawnSync('git',['cat-file','-e',before.baseCommit+':'+unit.path],{encoding:'utf8'});assert.equal(absent.status,128);
const legacy=JSON.parse(fs.readFileSync(p+'baseline-sources.json','utf8'));for(const part of legacy.parts)assert.equal(hash(fs.readFileSync(part.path)),part.sha256);
const summary={productionPrograms:programs.length,exactEdits:edits.edits.length,wholeInverseOutputs:programs.length*2,protectedDeclarations:programs.reduce((n,r)=>n+r.protectedDeclarations.length,0),newTestDeclarations:testDeclarations,controls:before.controls.length,legacyArtifactsPreserved:legacy.parts.length};
const report={baseCommit:before.baseCommit,sourceReadySHA256:hash(fs.readFileSync(p+'source-ready.json')),summary,programs,newUnit:{path:unit.path,sha256:unit.sha256,actualGitAbsence:true,typed:tree(sf,sf).counts()},limits:['Independent F02 behavior: actual JavaScript intentionally differs; exact inverse does not establish old behavior equivalence.','Protected original paid chat/knife/group/current and payment/default acceptance functions remain exact typed trees and emitted output; validConsent intentionally calls the new unpaid proof wrapper.','No claim against arbitrary monkeypatching of WeakSet, Reflect, provider/callback stack or all nested DTO semantics. Existing descriptor/JSON admission remains unchanged.','Pure metadata/AST/emit proof only; no product import, type check, runtime test, original probe or architecture gate.']};
fs.writeFileSync(p+'proof.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(summary));
