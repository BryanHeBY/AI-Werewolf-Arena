/** 只核五源精确路由／说明、原可信查询程序与现公开绑定；不执行行动、类型或门禁。 */
const fs=require('node:fs'),assert=require('node:assert/strict'),crypto=require('node:crypto'),cp=require('node:child_process');const ts=require('../../../backend/node_modules/typescript');
const p='docs/refactor/generated/demon-native-marks-port-',h=x=>crypto.createHash('sha256').update(x).digest('hex');
const before=JSON.parse(fs.readFileSync(p+'before.json','utf8')),changes=JSON.parse(fs.readFileSync(p+'edits.json','utf8'));
const source=[];
for(const row of before.source){
 assert.equal(cp.execFileSync('git',['show',before.baseCommit+':'+row.path],{encoding:'utf8'}),row.text);
 let forward=row.text,inverse=fs.readFileSync(row.path,'utf8'),mapped=inverse;
 const edits=changes.edits.filter(x=>x.path===row.path);
 for(const e of edits){assert.equal(forward.split(e.before).length-1,1);forward=forward.replace(e.before,e.after);}
 assert.equal(forward,inverse);
 for(const e of [...edits].reverse()){assert.equal(inverse.split(e.after).length-1,1);inverse=inverse.replace(e.after,e.before);if(e.before.startsWith('import ')||e.before.startsWith('export '))mapped=mapped.replace(e.after,e.before);}
 assert.equal(inverse,row.text);
 const outputs=[];for(const module of [ts.ModuleKind.ESNext,ts.ModuleKind.CommonJS]){const emit=text=>ts.transpileModule(text,{fileName:row.path,compilerOptions:{target:ts.ScriptTarget.ES2022,module,removeComments:true}}).outputText;const a=emit(row.text),b=emit(mapped);assert.equal(a,b);outputs.push({module:ts.ModuleKind[module],mappedWholeRawSame:true,sha256:h(a)});}
 source.push({path:row.path,sha256:h(forward),actualGitBefore:true,wholeExactForwardAndInverse:true,outputs});
}
const req=changes.queryOwner,old=before.source.find(r=>r.path===req).text,current=fs.readFileSync(req,'utf8');
const tokens=text=>{const scanner=ts.createScanner(ts.ScriptTarget.Latest,true,ts.LanguageVariant.Standard,text),xs=[];for(let k=scanner.scan();k!==ts.SyntaxKind.EndOfFileToken;k=scanner.scan())xs.push([k,scanner.getTokenText()]);return xs;};
assert(!old.includes('`')&&!current.includes('`'));const oldTokens=tokens(old);assert.deepEqual(tokens(current),oldTokens);
const sf=ts.createSourceFile(req,current,ts.ScriptTarget.Latest,true);const captures=sf.statements.filter(n=>ts.isVariableStatement(n)&&n.declarationList.declarations.some(d=>ts.isIdentifier(d.name)&&d.name.text==='trustedMarkMethods'));assert.equal(captures.length,1);
const trusted=old.slice(old.indexOf('const trustedMarkMethods ='),old.indexOf('export function demonWitchRequestTargetCurrent('));let actual=current.slice(current.indexOf('const trustedMarkMethods ='),current.indexOf('export function demonWitchRequestTargetCurrent('));for(const e of [...changes.edits].reverse().filter(x=>x.path===req)){if(actual.includes(e.after))actual=actual.replace(e.after,e.before);}assert.equal(actual,trusted);
const controls=before.controls.map(row=>{assert.equal(h(fs.readFileSync(row.path)),row.sha256);assert.equal(h(cp.execFileSync('git',['show',before.baseCommit+':'+row.path])),row.sha256);return{...row,sameGitAndCurrent:true};});
(async()=>{const reqModule=await import('../../../backend/src/game/mechanisms/roles/demon_hunter/native_potion_requests.ts'),ports=await import('../../../backend/src/game/mechanisms/roles/demon_hunter/ports.ts');assert.equal(reqModule.demonWitchMarksSafe,ports.demonWitchMarksSafe);
 const report={baseCommit:before.baseCommit,source,deleted:[],controls,query:{owner:req,originalCapturePointRetained:true,wholeRequestsNonCommentTokenCount:oldTokens.length,wholeRequestsTokensSame:true,trustedRegionLines:trusted.trimEnd().split('\n').length,trustedRegionSameAfterExactCommentsInverse:true,trustedRegionSha256:h(trusted),methodOrder:['has','add','remove','clear','values'],singleCaptureDeclaration:true,samePublicFunctionReference:true},summary:{sources:source.length,exactEdits:changes.edits.length,wholeMappedOutputs:source.length*2},limits:['Requests仍是真正实现所有者；本批不移动可信捕获、不增初始化API或表镜像，也不退休原Requests查询出口。','新public值重导已有Requests依赖；模块入口／API路由发生变化，不冒所有任意module反射或初始化图机械等价。','原查询单次模块捕获位置、调用顺序、异常／旧accepted边界不因头说明加强，查询不是付款或行动许可。']};fs.writeFileSync(p+'proof.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({sources:source.length,edits:changes.edits.length,wholeOutputs:10,requestTokens:oldTokens.length,originalCapture:true,publicSameRef:true}));})().catch(error=>{console.error(error);process.exitCode=1;});
