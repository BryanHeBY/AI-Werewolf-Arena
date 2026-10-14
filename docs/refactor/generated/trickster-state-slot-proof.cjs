/** 核诡术师真实搬移程序、完整消费者与字面路由；不执行对局、模型、类型或全门禁。 */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),cp=require('node:child_process'),{createHash}=require('node:crypto');
const ts=require('../../../backend/node_modules/typescript'),prefix='docs/refactor/generated/trickster-state-slot-';
const before=JSON.parse(fs.readFileSync(prefix+'before.json','utf8')),edits=JSON.parse(fs.readFileSync(prefix+'edits.json','utf8'));
const sha=s=>createHash('sha256').update(s).digest('hex'),read=p=>fs.readFileSync(p,'utf8');
const oldPath='backend/src/game/mechanisms/roles/trickster/state.ts',ownerPath=oldPath.replace('/state.ts','/state-slot.ts');
function parse(text,p){const f=ts.createSourceFile(p,text,ts.ScriptTarget.Latest,true);assert.deepEqual(f.parseDiagnostics,[]);return f;}
function program(text,p){const f=parse(text,p);let nodes=0;function visit(n){nodes++;const children=[];ts.forEachChild(n,c=>{children.push(visit(c));},a=>{children.push(['array',a.length,!!a.hasTrailingComma,...a.map(visit)]);});return[n.kind,children];}
 const typed=visit(f),leaves=[];function tokens(n){if(n.kind>=ts.SyntaxKind.FirstJSDocNode&&n.kind<=ts.SyntaxKind.LastJSDocNode)return null;const c=n.getChildren(f).filter(x=>x.kind<ts.SyntaxKind.FirstJSDocNode||x.kind>ts.SyntaxKind.LastJSDocNode);if(!c.length){const v=[n.kind,n.getText(f)];leaves.push(v);return v;}return[n.kind,c.map(tokens)];}return{typed,tokenTree:tokens(f),nodes,leaves};}
function compare(old,current,p){const A=program(old,p),B=program(current,p);assert.deepEqual(B,A,p+' full program');const outputs=[ts.ModuleKind.ESNext,ts.ModuleKind.CommonJS].map(module=>{const emit=s=>ts.transpileModule(s,{fileName:p,compilerOptions:{target:ts.ScriptTarget.ES2022,module,removeComments:true}}).outputText;const a=emit(old),b=emit(current);assert.equal(b,a,p+' whole emit');return{module:ts.ModuleKind[module],wholeRawSame:true,sha256:sha(b)};});return{path:p,typedNodes:A.nodes,noncommentLeaves:A.leaves.length,fullTypedAndTokenTreeSame:true,outputs};}
const owner=read(ownerPath),ast=parse(owner,ownerPath),oldState=before.source.find(x=>x.path===oldPath);
const fn=name=>{const n=ast.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text===name);assert.ok(n);return n;};
const identity=fn('encodeTricksterStateIdentity').getText(ast).replace('encodeTricksterStateIdentity','stateIdentity');
const append=fn('appendTricksterHistory').body.statements[0].getText(ast).replaceAll('state()','b.state');
const install=fn('installTricksterState').body.statements[0].getText(ast).replace('privateState()','role.privateState');
const indent=(s,n)=>s.split('\n').map((line,i)=>(i?' '.repeat(n-2):' '.repeat(n))+line).join('\n');
const initEdit=edits.find(e=>e.before==='      role.privateState.trickster = createTricksterState();');
const historyEdit=edits.find(e=>e.before.startsWith('  Object.defineProperty(b.state.history'));
const identityEdit=edits.find(e=>e.before.startsWith('function stateIdentity('));
const core=owner.slice(0,owner.indexOf('/** 初始化仍先取原左值容器'));
const producerPrograms=[compare(oldState.text,core,ownerPath),compare(identityEdit.before.trimEnd(),identity,'actual-identity.ts'),compare(historyEdit.before,indent(append,2),'actual-history-write.ts'),compare(initEdit.before,indent(install,6),'actual-state-install.ts')];
const consumerPrograms=[];
for(const original of before.source){assert.equal(sha(original.text),original.sha256);assert.equal(cp.execFileSync('git',['show',before.baseCommit+':'+original.path],{encoding:'utf8'}),original.text);
 if(original.path===oldPath){assert.equal(fs.existsSync(oldPath),false);continue;}
 let inverse=read(original.path);
 for(const e of [...edits].reverse().filter(e=>e.path===original.path)){
  if(e===identityEdit){assert.equal(inverse.split('function ownData(').length,2);inverse=inverse.replace('function ownData(',identity+'\nfunction ownData(');continue;}
  assert.equal(inverse.split(e.after).length,2,original.path+' exact new delta');
  const replacement=e===initEdit?indent(install,6):e===historyEdit?indent(append,2):e.before;
  inverse=inverse.replace(e.after,replacement);
 }
 assert.equal(inverse,original.text,original.path+' full actual source inverse');consumerPrograms.push(compare(original.text,inverse,original.path));
}
const controls=before.controls.map(c=>{assert.equal(sha(read(c.path)),c.sha256);assert.equal(sha(cp.execFileSync('git',['show',before.baseCommit+':'+c.path])),c.sha256);return{...c,actualGitAndCurrentWholeSame:true};});
// 穷尽当前仓内字面语法，不把计算加载或仓外消费者混入静态范围。
const paths=cp.execFileSync('rg',['--files','backend/src','backend/tests','frontend/src','packages','tooling','-g','*.ts','-g','*.tsx','-g','*.js','-g','*.mjs','-g','*.cjs'],{encoding:'utf8'}).trim().split('\n');
const cfg=ts.parseJsonConfigFileContent(ts.readConfigFile('backend/tsconfig.tests.json',ts.sys.readFile).config,ts.sys,path.resolve('backend')).options;
const sites=[],retired=[];for(const p of paths){const f=parse(read(p),p);function routeAt(n,s,form){if(!s||!ts.isStringLiteralLike(s))return;const route=s.text;
 const resolved=ts.resolveModuleName(route,path.resolve(p),cfg,ts.sys).resolvedModule?.resolvedFileName;const target=resolved&&path.relative(process.cwd(),resolved).split(path.sep).join('/');
 if(target===ownerPath||target==='backend/src/game/mechanisms/roles/trickster/ports.ts')sites.push({path:p,route,form,target});
 if(/trickster\/state(?:\.ts)?$/.test(route)||(p.includes('/trickster/')&&route==='./state'))retired.push({path:p,route,form});}
 function walk(n){if(ts.isImportDeclaration(n)||ts.isExportDeclaration(n))routeAt(n,n.moduleSpecifier,'import/export');else if(ts.isImportTypeNode(n)&&ts.isLiteralTypeNode(n.argument))routeAt(n,n.argument.literal,'importType');else if(ts.isCallExpression(n)&&(n.expression.kind===ts.SyntaxKind.ImportKeyword||(ts.isIdentifier(n.expression)&&n.expression.text==='require')))routeAt(n,n.arguments[0],'dynamic/require');else if(ts.isImportEqualsDeclaration(n)&&ts.isExternalModuleReference(n.moduleReference))routeAt(n,n.moduleReference.expression,'importEquals');ts.forEachChild(n,c=>{walk(c);});}walk(f);}
assert.deepEqual(retired,[]);
const result={approved:true,baseCommit:before.baseCommit,source:before.source.filter(x=>x.path!==oldPath).map(x=>({path:x.path,sha256:sha(read(x.path))})).concat([{path:ownerPath,sha256:sha(owner)}]),deleted:{path:oldPath,beforeSHA256:oldState.sha256,expectedAbsent:true},actualProducerPrograms:producerPrograms,wholeConsumerPrograms:consumerPrograms,controls,inventory:{scannedFiles:paths.length,canonicalSites:sites,retiredSites:retired},summary:{producerPrograms:producerPrograms.length,consumerPrograms:consumerPrograms.length,typedNodes:[...producerPrograms,...consumerPrograms].reduce((n,x)=>n+x.typedNodes,0),wholeMappedOutputs:2*(producerPrograms.length+consumerPrograms.length)},limits:['真实新owner程序展开与全消费者逆；只形状／物理入口、方法表与额外调用栈为明确API变化，不保证私有反射或CJS namespace重赋。','slot schema沿用原live reader；expectedState仍frame运行检查点，不提供档案decoder或授权。','不执行coldload、对局、类型或全门禁；字面盘点不覆盖计算表达式和仓外调用。']};
fs.writeFileSync(prefix+'proof.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result.summary));
