/** 只核末两源政策增量、原七声明和原 shared／proof 调用次序；不重复首正文、业务或头检查。 */
const fs=require('node:fs'),assert=require('node:assert/strict'),{createHash}=require('node:crypto'),ts=require('../../../backend/node_modules/typescript');
const p='docs/refactor/generated/ghost-bride-request-terminal-revocation-',b=JSON.parse(fs.readFileSync(p+'retained-consent-before.json','utf8')),e=JSON.parse(fs.readFileSync(p+'retained-consent-edits.json','utf8')),ready=JSON.parse(fs.readFileSync(p+'source-ready.json','utf8')),hash=x=>createHash('sha256').update(x).digest('hex');
const parse=(file,text)=>{const sf=ts.createSourceFile(file,text,ts.ScriptTarget.Latest,true);assert.deepEqual(sf.parseDiagnostics,[]);return sf;};
const emit=(file,text,module)=>ts.transpileModule(text,{fileName:file,compilerOptions:{target:ts.ScriptTarget.ES2022,module,removeComments:true}}).outputText;
const programs=b.source.map(row=>{
 const actual=fs.readFileSync(row.path,'utf8');assert.equal(hash(row.text),row.sha256);assert.equal(hash(actual),ready.source.find(r=>r.path===row.path).sha256);let inverse=actual,steps=e.edits.filter(x=>x.path===row.path);
 if(row.path.endsWith('/authority.ts')){for(const s of [...steps].reverse()){assert.equal(inverse.slice(s.start,s.start+s.after.length),s.after);inverse=inverse.slice(0,s.start)+s.before+inverse.slice(s.start+s.after.length);}}
 else{assert(actual.startsWith(row.text));inverse=actual.slice(0,row.text.length);steps=[{newDeclarationAppended:true}];}
 assert.equal(inverse,row.text);const old=parse(row.path,row.text),now=parse(row.path,actual);
 const declared=sf=>new Map(sf.statements.filter(ts.isFunctionDeclaration).map(n=>[n.name.text,n]));
 const preserved=[];if(row.path.endsWith('/authority.ts')){
  const a=declared(old),c=declared(now);for(const [name,node]of a){if(['validTurn','validConsent'].includes(name))continue;assert.equal(c.get(name).getText(now),node.getText(old),name);preserved.push(name);}
  const calls=(node,sf)=>{const out=[];function walk(n){if(ts.isCallExpression(n)){const name=n.expression.getText(sf);if(['b.setupCurrent','t.isCurrent','second.isCurrent','expectedTurn','validBinding','currentUnpaidRequestProof','json','second.privateJson.get','t.privateJson.get','targetCurrent'].includes(name))out.push(n.getText(sf));}ts.forEachChild(n,walk);}walk(node);return out;};
  assert.deepEqual(calls(c.get('validConsent'),now),calls(a.get('validConsent'),old));
  assert.equal(calls(c.get('validTurn'),now).filter(x=>x==='currentUnpaidRequestProof(t)').length,1);
 }else{
  const decl=sf=>sf.statements.filter(n=>ts.isExpressionStatement(n)&&ts.isCallExpression(n.expression)&&n.expression.expression.getText(sf)==='test');const oldTests=decl(old),newTests=decl(now);assert.equal(oldTests.length,7);assert.equal(newTests.length,8);for(let n=0;n<7;n++)assert.equal(newTests[n].getText(now),oldTests[n].getText(old));preserved.push('all 7 original test declarations and assertions exact text');
 }
 const outputs=[ts.ModuleKind.ESNext,ts.ModuleKind.CommonJS].map(module=>{const original=emit(row.path,row.text,module),current=emit(row.path,actual,module);assert.equal(emit(row.path,inverse,module),original);assert.notEqual(current,original);return{module:ts.ModuleKind[module],beforeSHA256:hash(original),actualSHA256:hash(current),wholeInverseRawSame:true,wholeActualRawSame:false};});
 return{path:row.path,beforeSHA256:row.sha256,sha256:hash(actual),exactDeltas:steps.length,preserved,outputs};
});
const first=JSON.parse(b.sourceReady.text),setup=first.source.find(r=>r.path.endsWith('/setup.ts'));assert.equal(hash(fs.readFileSync(setup.path)),setup.sha256);
const heads=source=>source.slice(0,source.indexOf('import '));for(const row of b.source)assert.equal(heads(fs.readFileSync(row.path,'utf8')),heads(row.text));
const report={sourceReadySHA256:hash(fs.readFileSync(p+'source-ready.json')),programs,source2ChangedSetupSame:true,originalSevenDeclarationsSame:true,originalSharedAndProofCallOrderSame:true,headBytesSame:true,summary:{changedSources:2,authorityExactDeltas:e.edits.length,newDeclarations:1,wholeInverseOutputs:4,wholeActualDifferentOutputs:4},limits:['Static reviewer interaction finding led to additional F02 policy; not an executed old/new red or repeated baseline.','New first-consent revocation applies only to shared window/consent checks; second-only proof failure does not poison valid first consent.','No author type, runtime, head, primary proof or gate run here.']};fs.writeFileSync(p+'retained-consent-bridge.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report.summary));
