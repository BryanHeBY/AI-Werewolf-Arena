/** 核黎明知识完整两业务点与三个原消费者；输入真实 Git before/当前源，输出精准正逆与完整运行对照，不跑玩法/门禁。 */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{createHash}=require('node:crypto'),{execFileSync}=require('node:child_process'),ts=require('../../../backend/node_modules/typescript');
const prefix='docs/refactor/generated/dawn-knowledge-publication-',before=JSON.parse(fs.readFileSync(prefix+'before.json','utf8')),edits=JSON.parse(fs.readFileSync(prefix+'edits.json','utf8')),paths=JSON.parse(fs.readFileSync(prefix+'paths.json','utf8')).source,sha=x=>createHash('sha256').update(x).digest('hex');
function parse(text, p) {
  const f = ts.createSourceFile(p, text, ts.ScriptTarget.Latest, true);
  assert.deepEqual(f.parseDiagnostics, []); return f;
}
function signature(text, p) {
  const f = parse(text, p); let nodes = 0;
  function walk(n) {
    nodes++; const children = [];
    ts.forEachChild(n, c => { children.push(walk(c)); }, a => { children.push(['array', a.length, !!a.hasTrailingComma, ...a.map(walk)]); });
    return [n.kind, children];
  }
  const typed = walk(f), leaves = [];
  function tokens(n) {
    const children = n.getChildren(f).filter(c => c.kind < ts.SyntaxKind.FirstJSDocNode || c.kind > ts.SyntaxKind.LastJSDocNode);
    if (!children.length) { const leaf = [n.kind, n.getText(f)]; leaves.push(leaf); return leaf; }
    return [n.kind, children.map(tokens)];
  }
  return { typed, tokens: tokens(f), leaves, nodes };
}
function pair(a, b, p) {
  const x = signature(a, p), y = signature(b, p); assert.deepEqual(x, y);
  const outputs = [ts.ModuleKind.ESNext, ts.ModuleKind.CommonJS].map(module => {
    const emit = s => ts.transpileModule(s, { fileName: p, compilerOptions: { target: ts.ScriptTarget.ES2022, module, removeComments: true } }).outputText;
    const left = emit(a), right = emit(b);
    return { module: ts.ModuleKind[module], wholeRawSame: left === right, beforeSHA256: sha(left), afterSHA256: sha(right) };
  });
  return { typedNodes: x.nodes, noncommentLeaves: x.leaves.length, outputs };
}
const whole=before.source.map(x=>{
 assert.equal(sha(x.text),x.sha256);assert.equal(execFileSync('git',['show',before.baseCommit+':'+x.path],{encoding:'utf8'}),x.text);
 let forward=x.text;const steps=edits.filter(e=>e.path===x.path);
 for(const e of steps){assert.equal(forward.indexOf(e.before),e.beforeOffset);assert.equal(forward.split(e.before).length,2);forward=forward.replace(e.before,e.after);}
 const current=fs.readFileSync(x.path,'utf8');assert.equal(forward,current);let inverse=current;
 for(const e of [...steps].reverse()){assert.equal(inverse.slice(e.beforeOffset,e.beforeOffset+e.after.length),e.after);inverse=inverse.slice(0,e.beforeOffset)+e.before+inverse.slice(e.beforeOffset+e.after.length);}
 assert.equal(inverse,x.text);return{path:x.path,sourceSHA256:sha(current),exactEdits:steps.length,exactForwardInverse:true,...pair(inverse,x.text,x.path)};
});
const ownerPath=paths[3],ownerText=fs.readFileSync(ownerPath,'utf8'),f=parse(ownerText,ownerPath);
const find=(f,name)=>{const n=f.statements.find(n=>n.name?.text===name);assert(n,name);return n;};
const capture=find(f,'captureDawnKnowledge');assert.equal(capture.body.statements.length,1);assert(ts.isReturnStatement(capture.body.statements[0]));
let captureInverse=capture.body.statements[0].getText(f);
for(const [a,b] of [['runtime.world()','this.world'],['runtime.signalPolicy()','this.config.bear?.signalPolicy']]){assert.equal(captureInverse.split(a).length,2);captureInverse=captureInverse.replace(a,b);}
assert.equal(captureInverse.match(/\bday\b/g).length,1);captureInverse=captureInverse.replace(/\bday\b/,'nightDay');
const oldCapture=edits.find(e=>e.kind==='complete-pre-night-capture').before;
const oldCaptureAst=parse(oldCapture,ownerPath),oldCaptureExpr=oldCaptureAst.statements[0].declarationList.declarations[0].initializer.getText(oldCaptureAst);
const wrapped=s=>'function originalCapture() {\n'+s+'\n}';
const completeCapture={statements:1,returnsOriginalFrame:true,...pair(wrapped(captureInverse),wrapped('return '+oldCaptureExpr+';'),ownerPath)};
const publication=find(f,'publishDawnKnowledge');assert.equal(publication.body.statements.length,3);
let pubInverse=publication.body.getText(f).slice(1,-1);
const mappings=[['runtime.events()','this.events',4],['runtime.world()','this.world',3],['runtime.animalDream()','this.config.animalDream',1],['isCurrent','dayIsCurrent',1]];
for(const [a,b,count] of mappings){assert.equal(pubInverse.split(a).length-1,count,a);pubInverse=pubInverse.split(a).join(b);}
assert.equal(pubInverse.match(/\bday\b/g).length,1);pubInverse=pubInverse.replace(/\bday\b/,'cycleDay');
const oldPublication=edits.find(e=>e.kind==='complete-dawn-publication').before;
const pubwrap=s=>'function originalPublication() {\n'+s+'\n}';
const completePublication={topLevelStatements:3,conditionalFacts:2,nullablePublishRetainsReceiver:true,...pair(pubwrap(pubInverse),pubwrap(oldPublication),ownerPath)};
// 真实公开端点只具名导出同一 class／函数，不包裹或提前执行采样／日志。
const routes=[{path:paths[1],name:'BearNightFrame',specifier:'./night_frame',endpoint:'backend/src/game/mechanisms/roles/bear/night_frame.ts'},
 {path:paths[2],name:'noteAnimalBearPublication',specifier:'./facts',endpoint:'backend/src/game/mechanisms/roles/animal_dream/facts.ts'},
 {path:paths[2],name:'appendAnimalBeautyNotice',specifier:'./facts',endpoint:'backend/src/game/mechanisms/roles/animal_dream/facts.ts'}];
for(const r of routes){const p=parse(fs.readFileSync(r.path,'utf8'),r.path);const e=p.statements.filter(ts.isExportDeclaration).find(e=>e.moduleSpecifier?.text===r.specifier&&e.exportClause&&ts.isNamedExports(e.exportClause)&&e.exportClause.elements.some(x=>x.name.text===r.name&&!x.propertyName));assert(e,r.name);find(parse(fs.readFileSync(r.endpoint,'utf8'),r.endpoint),r.name);}
const imports=f.statements.filter(ts.isImportDeclaration).map(n=>({module:n.moduleSpecifier.text,typeOnly:!!n.importClause?.isTypeOnly,names:n.importClause?.namedBindings?.elements.map(e=>e.name.text)??[]}));
assert.deepEqual(imports,[{module:'@ai-werewolf-arena/game-contract',typeOnly:true,names:['BearSignalPolicy','ReadonlyBoardConfig']},{module:'../core/domain/events',typeOnly:true,names:['GameEvent']},{module:'../core/domain/world',typeOnly:true,names:['World']},{module:'../game/mechanisms/roles/bear/ports',typeOnly:false,names:['BearNightFrame']},{module:'../game/mechanisms/roles/animal_dream/ports',typeOnly:false,names:['noteAnimalBearPublication','appendAnimalBeautyNotice']}]);
// 当前相对字面声明值图保守计未显式 import type 的边；不声称完整实际初始化执行图。
function resolve(from,spec){if(!spec.startsWith('.'))return null;const base=path.posix.normalize(path.posix.join(path.posix.dirname(from),spec));return[base,base+'.ts',base+'.mts',base+'.cts',base+'/index.ts'].find(p=>fs.existsSync(p)&&fs.statSync(p).isFile())??null;}
function edges(p){const f=parse(fs.readFileSync(p,'utf8'),p),found=new Set();function visit(n){
 if(ts.isImportDeclaration(n)&&!n.importClause?.isTypeOnly&&(!n.importClause?.namedBindings||!ts.isNamedImports(n.importClause.namedBindings)||n.importClause.namedBindings.elements.some(e=>!e.isTypeOnly))){const q=resolve(p,n.moduleSpecifier.text);if(q)found.add(q);}
 if(ts.isExportDeclaration(n)&&n.moduleSpecifier&&!n.isTypeOnly&&(!n.exportClause||!ts.isNamedExports(n.exportClause)||n.exportClause.elements.some(e=>!e.isTypeOnly))){const q=resolve(p,n.moduleSpecifier.text);if(q)found.add(q);}
 if(ts.isCallExpression(n)&&(n.expression.kind===ts.SyntaxKind.ImportKeyword||ts.isIdentifier(n.expression)&&n.expression.text==='require')&&n.arguments.length===1&&ts.isStringLiteralLike(n.arguments[0])){const q=resolve(p,n.arguments[0].text);if(q)found.add(q);}
 ts.forEachChild(n,c=>{visit(c);});}visit(f);return[...found];}
const graph=new Map(),queue=[ownerPath];while(queue.length){const p=queue.shift();if(graph.has(p))continue;const e=edges(p);graph.set(p,e);queue.push(...e.filter(p=>!graph.has(p)));}
const backEdges=[...graph].flatMap(([from,targets])=>targets.filter(p=>p===ownerPath).map(to=>({from,to})));assert.deepEqual(backEdges,[]);
const fix=JSON.parse(fs.readFileSync(prefix+'test-typefix-before.json','utf8'));assert.equal(sha(fix.text),fix.sha256);assert.equal(fix.text.split(fix.before).length,2);
const finalTest=fs.readFileSync(fix.path,'utf8');assert.equal(fix.text.replace(fix.before,fix.after),finalTest);
const typeOutputs=[ts.ModuleKind.ESNext,ts.ModuleKind.CommonJS].map(module=>{const emit=s=>ts.transpileModule(s,{fileName:fix.path,compilerOptions:{target:ts.ScriptTarget.ES2022,module,removeComments:true}}).outputText;assert.equal(emit(fix.text),emit(finalTest));return{module:ts.ModuleKind[module],wholeRawSame:true,sha256:sha(emit(finalTest))};});
const controls=before.controls.map(x=>{assert.equal(sha(x.text),x.sha256);assert.equal(execFileSync('git',['show',before.baseCommit+':'+x.path],{encoding:'utf8'}),x.text);assert.equal(fs.readFileSync(x.path,'utf8'),x.text);return{path:x.path,sha256:x.sha256,wholeGitBytesSame:true};});
const pairs=[...whole,completeCapture,completePublication];const report={approved:true,baseCommit:before.baseCommit,source:paths.map(path=>({path,sha256:sha(fs.readFileSync(path))})),wholeOriginalPrograms:whole,completeCapture,completePublication,routes,ownerImports:imports,controls,excludedControls:before.excludedControls,testTypeOnlyDelta:{path:fix.path,beforeSHA256:fix.sha256,finalSHA256:sha(finalTest),outputs:typeOutputs},graph:{root:ownerPath,backendModules:graph.size,relativeDeclaredValueEdges:[...graph.values()].reduce((n,e)=>n+e.length,0),backEdges,limits:'保守相对字面声明值边；外部包、importEquals、非字面入口及完整 cold 执行不计；不排除未标 type 的实际擦除 import。'},summary:{wholeOriginalPrograms:3,completeOwnerPrograms:2,typedNodes:pairs.reduce((n,p)=>n+p.typedNodes,0),noncommentLeaves:pairs.reduce((n,p)=>n+p.noncommentLeaves,0),wholeMappedOutputs:10,rawSame:pairs.flatMap(x=>x.outputs).filter(x=>x.wholeRawSame).length,testTypeOnlyOutputs:2},limits:['完整 PM/两 ports 精准正逆，新 capture 唯一 return／publish 全三语句分别核；不恢复整个旧 PM body 掩新组合。','新函数、公开 class/查询绑定与输入 API 改变模块路线及来源指纹，未承诺任意 namespace 反射或全 cold 相同。','原 frame 仍唯一原体／历史／发布租约 owner，Animal facts 唯一知识日志；原 runtime 对象不是 JSON 或权限。','Root Bear profile/state 并行中文变化明确排除 whole-byte controls；其他并行源与传递图不声称原字节相同。']};
fs.writeFileSync(prefix+'proof.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({summary:report.summary,graph:report.graph}));
