/** 核诡术师最终放逐完整两块／摘要与两个原消费者；输入真实Git before和当前源，输出精确正逆与运行对照，不跑玩法或门禁。 */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{createHash}=require('node:crypto'),{execFileSync}=require('node:child_process'),ts=require('../../../backend/node_modules/typescript');
const prefix='docs/refactor/generated/mapped-exile-resolution-',before=JSON.parse(fs.readFileSync(prefix+'before.json','utf8')),edits=JSON.parse(fs.readFileSync(prefix+'edits.json','utf8')),paths=JSON.parse(fs.readFileSync(prefix+'paths.json','utf8')).source,sha=x=>createHash('sha256').update(x).digest('hex');
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
const ownerPath=paths[2],ownerText=fs.readFileSync(ownerPath,'utf8'),f=parse(ownerText,ownerPath);
const find=(f,name)=>{const n=f.statements.find(n=>n.name?.text===name);assert(n,name);return n;};
function map(text,mappings){for(const[a,b,count]of mappings){assert.equal(text.split(a).length-1,count,a);text=text.split(a).join(b);}return text;}
const wrap=s=>'function originalBody() {\n'+s+'\n}';
const prepare=find(f,'prepareMappedExile');assert.equal(prepare.body.statements.length,4);assert.equal(prepare.body.statements[3].getText(f),'return { mapped, effectiveTarget };');
let prepInverse=prepare.body.statements.slice(0,3).map(n=>n.getText(f)).join('\n');
prepInverse=map(prepInverse,[['runtime.enabled','config.trickster',1],['runtime.world','this.world',1],['runtime.day','options.day',1],['runtime.events','this.events',1]]);
const oldPrep=edits.find(e=>e.kind==='complete-target-preparation').before;assert(oldPrep.endsWith('\n    const thisPipeline = this;'));
const completePreparation={allStatements:4,returnedFields:['mapped','effectiveTarget'],purePipelineAliasMoved:true,...pair(wrap(prepInverse),wrap(oldPrep.slice(0,-'\n    const thisPipeline = this;'.length)),ownerPath)};
const resolution=find(f,'resolveMappedExile');assert.equal(resolution.body.statements.length,4);assert.equal(resolution.body.statements[3].getText(f),'return removed;');
let resolutionInverse=resolution.body.statements.slice(0,3).map(n=>n.getText(f)).join('\n');
resolutionInverse=map(resolutionInverse,[['runtime.eventRegistry','this.eventRegistry',1],['runtime.world','this.world',1],['runtime.events','this.events',2],['runtime.animalUnit','animalUnit',1]]);
const completeResolution={allStatements:4,returnsOriginalCopiedArray:true,preservesMethodReceiver:true,...pair(wrap(resolutionInverse),wrap(edits.find(e=>e.kind==='complete-outcome-resolution').before),ownerPath)};
const summary=find(f,'mappedExileSummary');assert.equal(summary.body.statements.length,1);const actualSummary=summary.body.statements[0].getText(f);
const oldSummary=edits.find(e=>e.kind==='late-summary-field-projection').before.trim();assert(oldSummary.startsWith('...(')&&oldSummary.endsWith('),'));
const completeSummary=pair(wrap(actualSummary),wrap('return '+oldSummary.slice(4,-2)+';'),ownerPath);
const p=parse(fs.readFileSync(paths[1],'utf8'),paths[1]);const publicResolve=p.statements.filter(ts.isExportDeclaration).find(e=>e.moduleSpecifier?.text==='./night_frame'&&e.exportClause&&ts.isNamedExports(e.exportClause)&&e.exportClause.elements.some(x=>x.name.text==='resolveTricksterExile'&&!x.propertyName));assert(publicResolve);
const endpoint='backend/src/game/mechanisms/roles/trickster/night_frame.ts';find(parse(fs.readFileSync(endpoint,'utf8'),endpoint),'resolveTricksterExile');
const imports=f.statements.filter(ts.isImportDeclaration).map(n=>({module:n.moduleSpecifier.text,typeOnly:!!n.importClause?.isTypeOnly,names:n.importClause?.namedBindings?.elements.map(e=>e.name.text)??[]}));
assert.deepEqual(imports,[{module:'@ai-werewolf-arena/game-contract',typeOnly:true,names:['ReadonlyBoardConfig','EntityId','VotingSummary']},{module:'../core/domain/world',typeOnly:true,names:['World']},{module:'../core/domain/events',typeOnly:true,names:['GameEvent']},{module:'../game/mechanisms/hooks/hook_registry',typeOnly:true,names:['VotedOutResult']},{module:'../game/mechanisms/roles/trickster/ports',typeOnly:false,names:['resolveTricksterExile']}]);
// 原 Noble 整个交接及提前 return 是真实控制片段；不以复制整旧 body 掩 owner，也不移 await/finally。
const oldPipe=before.source[0].text,currentPipe=fs.readFileSync(paths[0],'utf8');
const boundary=text=>{const a=text.index('    const reveal = revealSecretBodyExile('),b=text.index('\n    }',text.index('      return attachExileUnit({ summary: { tally, target, removed: [] }',a))+6;assert(a>=0&&b>a);return text.slice(a,b);};
assert.equal(boundary(currentPipe),boundary(oldPipe));
const fix=JSON.parse(fs.readFileSync(prefix+'test-typefix-before.json','utf8'));assert.equal(sha(fix.text),fix.sha256);let fixed=fix.text;
for(const e of fix.edits){assert.equal(fixed.split(e.before).length-1,e.count);fixed=fixed.split(e.before).join(e.after);}assert.equal(fixed,fs.readFileSync(fix.path,'utf8'));
const typeOutputs=[ts.ModuleKind.ESNext,ts.ModuleKind.CommonJS].map(module=>{const emit=s=>ts.transpileModule(s,{fileName:fix.path,compilerOptions:{target:ts.ScriptTarget.ES2022,module,removeComments:true}}).outputText;assert.equal(emit(fix.text),emit(fixed));return{module:ts.ModuleKind[module],wholeRawSame:true,sha256:sha(emit(fixed))};});
const controls=before.controls.map(x=>{assert.equal(sha(x.text),x.sha256);assert.equal(execFileSync('git',['show',before.baseCommit+':'+x.path],{encoding:'utf8'}),x.text);assert.equal(fs.readFileSync(x.path,'utf8'),x.text);return{path:x.path,sha256:x.sha256,wholeGitBytesSame:true};});
function resolve(from,spec){if(!spec.startsWith('.'))return null;const base=path.posix.normalize(path.posix.join(path.posix.dirname(from),spec));return[base,base+'.ts',base+'.mts',base+'.cts',base+'/index.ts'].find(p=>fs.existsSync(p)&&fs.statSync(p).isFile())??null;}
function edges(p){const f=parse(fs.readFileSync(p,'utf8'),p),found=new Set();function visit(n){
 if(ts.isImportDeclaration(n)&&!n.importClause?.isTypeOnly&&(!n.importClause?.namedBindings||!ts.isNamedImports(n.importClause.namedBindings)||n.importClause.namedBindings.elements.some(e=>!e.isTypeOnly))){const q=resolve(p,n.moduleSpecifier.text);if(q)found.add(q);}
 if(ts.isExportDeclaration(n)&&n.moduleSpecifier&&!n.isTypeOnly&&(!n.exportClause||!ts.isNamedExports(n.exportClause)||n.exportClause.elements.some(e=>!e.isTypeOnly))){const q=resolve(p,n.moduleSpecifier.text);if(q)found.add(q);}
 if(ts.isCallExpression(n)&&(n.expression.kind===ts.SyntaxKind.ImportKeyword||ts.isIdentifier(n.expression)&&n.expression.text==='require')&&n.arguments.length===1&&ts.isStringLiteralLike(n.arguments[0])){const q=resolve(p,n.arguments[0].text);if(q)found.add(q);}
 ts.forEachChild(n,c=>{visit(c);});}visit(f);return[...found];}
const graph=new Map(),queue=[ownerPath];while(queue.length){const p=queue.shift();if(graph.has(p))continue;const e=edges(p);graph.set(p,e);queue.push(...e.filter(p=>!graph.has(p)));}
const backEdges=[...graph].flatMap(([from,targets])=>targets.filter(p=>p===ownerPath).map(to=>({from,to})));assert.deepEqual(backEdges,[]);
const pairs=[...whole,completePreparation,completeResolution,completeSummary];const report={approved:true,baseCommit:before.baseCommit,source:paths.map(path=>({path,sha256:sha(fs.readFileSync(path))})),wholeOriginalPrograms:whole,completePreparation,completeResolution,completeSummary,publicEndpoint:{path:paths[1],exportName:'resolveTricksterExile',directSpecifier:'./night_frame',physicalDeclaration:endpoint,sameBinding:true},ownerImports:imports,nobleBoundary:{wholeBytesSame:true,sha256:sha(boundary(oldPipe))},controls,testTypeOnlyDelta:{path:fix.path,beforeSHA256:fix.sha256,finalSHA256:sha(fixed),exactEdits:fix.edits.length,outputs:typeOutputs},graph:{root:ownerPath,backendModules:graph.size,relativeDeclaredValueEdges:[...graph.values()].reduce((n,e)=>n+e.length,0),backEdges,limits:'保守相对字面声明值边，不计外部包/importEquals/非字面入口/完整cold，也不排除未标type但实际擦除的导入。'},summary:{wholeOriginalPrograms:2,completeOwnerPrograms:3,typedNodes:pairs.reduce((n,p)=>n+p.typedNodes,0),noncommentLeaves:pairs.reduce((n,p)=>n+p.noncommentLeaves,0),wholeMappedOutputs:10,rawSame:pairs.flatMap(x=>x.outputs).filter(x=>x.wholeRawSame).length,testTypeOnlyOutputs:2},limits:['完整两旧程序精准正逆；新prepare四语句／resolve四语句／summary单语句逐体核，不恢复整个旧Voting body掩owner。','新结构运行接口、模块及同绑定公开出口有明确API／初始化／来源指纹变化；不承诺任意namespace反射或全冷执行同等。','Frame唯一消费exileResolved，事件payload原引用、effectiveId/missed原点晚读；readonly字段不冻World／事件或授许可。','Noble await/Provider/finally/earlyreturn、attach单位、全部票/PK/Animal封票与河豚await未迁；本批不宣称Order边界退出。','其他并行代码只在当前图采样，不列whole-byte control或全图基线相等。']};
fs.writeFileSync(prefix+'proof.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({summary:report.summary,graph:report.graph}));
