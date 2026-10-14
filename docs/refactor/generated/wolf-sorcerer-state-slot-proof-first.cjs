/** 核本族实际搬移程序、完整消费者与精确绑定；不运行对局、模型、类型编译或全门禁。 */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),cp=require('node:child_process'),{createHash}=require('node:crypto');
const ts=require('../../../backend/node_modules/typescript'),prefix='docs/refactor/generated/wolf-sorcerer-state-slot-';
const before=JSON.parse(fs.readFileSync(prefix+'before.json','utf8')),edits=JSON.parse(fs.readFileSync(prefix+'edits.json','utf8'));
const sha=x=>createHash('sha256').update(x).digest('hex'),read=p=>fs.readFileSync(p,'utf8');
function parse(text,p){const f=ts.createSourceFile(p,text,ts.ScriptTarget.Latest,true);assert.deepEqual(f.parseDiagnostics,[]);return f;}
function program(text,p){const f=parse(text,p);let nodes=0;function visit(n){nodes++;const children=[];ts.forEachChild(n,c=>{children.push(visit(c));},a=>{children.push(['array',a.length,!!a.hasTrailingComma,...a.map(visit)]);});return[n.kind,children];}
 const typed=visit(f),leaves=[];function tokens(n){if(n.kind>=ts.SyntaxKind.FirstJSDocNode&&n.kind<=ts.SyntaxKind.LastJSDocNode)return null;const c=n.getChildren(f).filter(x=>x.kind<ts.SyntaxKind.FirstJSDocNode||x.kind>ts.SyntaxKind.LastJSDocNode);if(!c.length){const v=[n.kind,n.getText(f)];leaves.push(v);return v;}return[n.kind,c.map(tokens)];}return{typed,tokenTree:tokens(f),nodes,leaves};}
function compare(old,current,p){const A=program(old,p),B=program(current,p);assert.deepEqual(B,A,p+' full program');const outputs=[ts.ModuleKind.ESNext,ts.ModuleKind.CommonJS].map(module=>{const emit=s=>ts.transpileModule(s,{fileName:p,compilerOptions:{target:ts.ScriptTarget.ES2022,module,removeComments:true}}).outputText;const a=emit(old),b=emit(current);assert.equal(b,a,p+' whole emit');return{module:ts.ModuleKind[module],wholeRawSame:true,sha256:sha(b)};});return{path:p,typedNodes:A.nodes,noncommentLeaves:A.leaves.length,fullTypedAndTokenTreeSame:true,outputs};}
const owner=read(edits.owner),ownerAST=parse(owner,edits.owner);
const fn=name=>{const f=ownerAST.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name.text===name);assert.ok(f);return f;};
const identity=fn('encodeWolfSorcererStateIdentity').getText(ownerAST).replace('encodeWolfSorcererStateIdentity','stateIdentity');
const append=fn('appendWolfSorcererHistory').body.statements[0].getText(ownerAST).replaceAll('state()','b.state');
const install=fn('installWolfSorcererState').body.statements[0].getText(ownerAST).replace('privateState()','role.privateState');
// getText 只去首行缩进；后续行保源缩进。精确重设原调用方层级，不恢复旧算法。
const indent=(s,n)=>s.split('\n').map((line,i)=>(i?' '.repeat(n-2):' '.repeat(n))+line).join('\n');
let slotCore=owner;assert.equal(slotCore.split(edits.addedOwnerProgram).length,2);slotCore=slotCore.replace(edits.addedOwnerProgram,'');
for(const e of [...edits.edits].reverse().filter(e=>e.path===edits.owner)){assert.equal(slotCore.split(e.after).length,e.occurrences+1);slotCore=slotCore.replaceAll(e.after,e.before);}
const oldState=before.source.find(f=>f.path===edits.old),oldFrame=before.source.find(f=>f.path.endsWith('/wolf_sorcerer/night_frame.ts'));
const actualPrograms=[compare(oldState.text,slotCore,edits.owner),compare(edits.movedIdentity,identity,'actual-state-identity.ts'),compare(edits.movedHistory,indent(append,2),'actual-history-write.ts')];
const profileInit=edits.edits.find(e=>e.path.endsWith('/wolf_sorcerer/profile.ts')&&e.before.includes('role.privateState.wolfSorcerer ='));
actualPrograms.push(compare(profileInit.before,indent(install,6),'actual-state-install.ts'));
const consumerPrograms=[];
for(const old of before.source.filter(f=>f.path!==edits.old)){
 assert.equal(sha(old.text),old.sha256);assert.equal(cp.execFileSync('git',['show',before.baseCommit+':'+old.path],{encoding:'utf8'}),old.text);
 let inverse=read(old.path);
 for(const e of [...edits.edits].reverse().filter(e=>e.path===old.path)){
  if(e.kind==='moved-declaration'){assert.equal(inverse.split('function ownData(').length,2);inverse=inverse.replace('function ownData(',identity+'\nfunction ownData(');continue;}
  assert.equal(inverse.split(e.after).length,e.occurrences+1,old.path+' exact owned delta');
  const replacement=e===profileInit?indent(install,6):e.before===edits.movedHistory?indent(append,2):e.before;
  inverse=inverse.replaceAll(e.after,replacement);
 }
 assert.equal(inverse,old.text,old.path+' actual source full inverse');consumerPrograms.push(compare(old.text,inverse,old.path));
}
assert.equal(sha(oldState.text),oldState.sha256);assert.equal(cp.execFileSync('git',['show',before.baseCommit+':'+edits.old],{encoding:'utf8'}),oldState.text);assert.equal(fs.existsSync(edits.old),false);
const control=before.controls.map(c=>{assert.equal(sha(read(c.path)),c.sha256);assert.equal(sha(cp.execFileSync('git',['show',before.baseCommit+':'+c.path])),c.sha256);return{...c,actualGitAndCurrentWholeSame:true};});
// 路由盘点覆盖所有字面语法形态；不把计算表达式、历史 docs 或仓外消费者算作穷尽。
const sourcePaths=cp.execFileSync('rg',['--files','backend/src','backend/tests','frontend/src','packages','tooling','-g','*.ts','-g','*.tsx','-g','*.js','-g','*.mjs','-g','*.cjs'],{encoding:'utf8'}).trim().split('\n');
const cfg=ts.parseJsonConfigFileContent(ts.readConfigFile('backend/tsconfig.tests.json',ts.sys.readFile).config,ts.sys,path.resolve('backend')).options;
const sites=[],retired=[];for(const p of sourcePaths){const f=parse(read(p),p);function moduleAt(n,s,form){if(!s||!ts.isStringLiteralLike(s))return;const route=s.text;const resolved=ts.resolveModuleName(route,path.resolve(p),cfg,ts.sys).resolvedModule?.resolvedFileName;const target=resolved&&path.relative(process.cwd(),resolved).split(path.sep).join('/');if(target===edits.owner||target?.endsWith('/wolf_sorcerer/ports.ts'))sites.push({path:p,module:route,form,target});if(/wolf_sorcerer\/state(?:\.ts)?$/.test(route)||(p.includes('/wolf_sorcerer/')&&route==='./state'))retired.push({path:p,module:route,form});}
 function walk(n){if(ts.isImportDeclaration(n)||ts.isExportDeclaration(n))moduleAt(n,n.moduleSpecifier,'import/export');else if(ts.isImportTypeNode(n)&&ts.isLiteralTypeNode(n.argument))moduleAt(n,n.argument.literal,'importType');else if(ts.isCallExpression(n)&&(n.expression.kind===ts.SyntaxKind.ImportKeyword||(ts.isIdentifier(n.expression)&&n.expression.text==='require')))moduleAt(n,n.arguments[0],'dynamic/require');else if(ts.isImportEqualsDeclaration(n)&&ts.isExternalModuleReference(n.moduleReference))moduleAt(n,n.moduleReference.expression,'importEquals');ts.forEachChild(n,c=>{walk(c);});}walk(f);}
assert.deepEqual(retired,[]);
const result={baseCommit:before.baseCommit,source:before.source.filter(f=>f.path!==edits.old).map(f=>({path:f.path,sha256:sha(read(f.path))})).concat([{path:edits.owner,sha256:sha(owner)}]),deleted:{path:edits.old,sha256:oldState.sha256,expectedAbsent:true},actualProducerPrograms:actualPrograms,wholeConsumerPrograms:consumerPrograms,controls:control,inventory:{scannedSourceFiles:sourcePaths.length,actualCanonicalSites:sites,retiredSites:retired},limits:['schema 是原完整live reader，不新建档案schema/decoder；原GC/verifier与frame原体/窗口/expectedState归属保持。','实际新生产者展开而非恢复旧整个body；只物理路径、接口／方法表初始化与调用栈是明确API变化，不承诺旧private namespace任意重赋或全冷加载等价。','所有literal语法入口盘点，不推断 computed 仓外加载；此脚本不type/test/fullgate/model。'],approved:true};
fs.writeFileSync(prefix+'proof.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({approved:true,producerPrograms:actualPrograms.length,consumerPrograms:consumerPrograms.length,typedNodes:[...actualPrograms,...consumerPrograms].reduce((n,x)=>n+x.typedNodes,0),wholeRawOutputs:(actualPrograms.length+consumerPrograms.length)*2,controls:control.length,inventory:sourcePaths.length,canonicalSites:sites.length,retired:retired.length}));
