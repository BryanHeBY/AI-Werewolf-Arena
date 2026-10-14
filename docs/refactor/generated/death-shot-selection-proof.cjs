/**
 * 负责复核完整死亡枪选择主体及原结算调用点，输入为真实 Git before 与当前四源。
 * 输出为完整语法树、全部非注释叶、双模块输出和真实声明绑定；不执行游戏或全量门禁。
 * 只逆已验证的 runtime 参数／接收方及公开导入，不遮掉新主体或其它回调。
 */
const fs=require('fs'),path=require('path'),crypto=require('crypto'),ts=require('../../../backend/node_modules/typescript');
const root=process.cwd(),read=p=>fs.readFileSync(path.join(root,p),'utf8'),sha=s=>crypto.createHash('sha256').update(s).digest('hex'),sf=s=>ts.createSourceFile('program.ts',s,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS);
const before=JSON.parse(read('docs/refactor/generated/death-shot-selection-before.json')),edits=JSON.parse(read('docs/refactor/generated/death-shot-selection-edits.json')),old=new Map(before.files.map(x=>[x.path,x.before]));
const dr='backend/src/game/engine/death_resolution.ts',owner='backend/src/rulesets/death-shot-selection.ts',port='backend/src/game/mechanisms/roles/nightmare_shadow/ports.ts';
function walk(n,fn){fn(n);ts.forEachChild(n,c=>{walk(c,fn);});}
function tree(s){let count=0;function visit(n){count++;const r=[n.kind];ts.forEachChild(n,c=>{r.push(visit(c));},a=>{r.push(['array',a.length,...a.map(visit)]);});return r;}const value=visit(sf(s));return{count,hash:sha(JSON.stringify(value))};}
function leaves(s){const file=sf(s),out=[];function visit(n){if(n.kind>=ts.SyntaxKind.FirstJSDocNode&&n.kind<=ts.SyntaxKind.LastJSDocNode)return;const children=n.getChildren(file);if(!children.length){out.push([n.kind,n.getText(file)]);return;}for(const c of children)visit(c);}visit(file);return out;}
function compare(a,b){const ta=tree(a),tb=tree(b);return{beforeNodes:ta.count,afterNodes:tb.count,completeTreeSame:ta.hash===tb.hash,completeNoncommentLeavesSame:JSON.stringify(leaves(a))===JSON.stringify(leaves(b)),wholeOutputs:[ts.ModuleKind.ESNext,ts.ModuleKind.CommonJS].map(module=>{const opts={target:ts.ScriptTarget.ES2022,module,removeComments:true};const l=ts.transpileModule(a,{compilerOptions:opts}).outputText,r=ts.transpileModule(b,{compilerOptions:opts}).outputText;return{module:ts.ModuleKind[module],wholeRawSame:l===r,beforeSha:sha(l),afterSha:sha(r)};})};}
function get(s,predicate){const file=sf(s);let match;walk(file,n=>{if(predicate(n,file))match=n;});if(!match)throw Error('actual_node_missing');return{file,node:match};}
function exact(s,a,b){if(s.split(a).length!==2)throw Error('exact_site_not_unique:'+a.slice(0,80));return s.replace(a,b);}
function bindings(p,s){const rows=[];for(const n of sf(s).statements){if(!ts.isImportDeclaration(n)||!n.importClause)continue;const c=n.importClause;if(c.name)rows.push({name:c.name.text,imported:'default',typeOnly:!!c.isTypeOnly,from:n.moduleSpecifier.text});if(c.namedBindings&&ts.isNamedImports(c.namedBindings))for(const e of c.namedBindings.elements)rows.push({name:e.name.text,imported:e.propertyName?.text??e.name.text,typeOnly:!!(c.isTypeOnly||e.isTypeOnly),from:n.moduleSpecifier.text});}return rows;}
function resolve(p,spec){if(!spec.startsWith('.')){if(!spec.startsWith('@ai-werewolf-arena/'))return null;const [,name,...tail]=spec.split('/'),pkg='packages/'+name,j=JSON.parse(read(pkg+'/package.json'));let target=j.exports?.[tail.length?'./'+tail.join('/') :'.'];if(typeof target==='object')target=target.types??target.import??target.default;return target?path.posix.normalize(pkg+'/'+target):null;}const stem=path.posix.normalize(path.posix.join(path.posix.dirname(p),spec));for(const p of[stem,stem+'.ts',stem+'/index.ts',stem+'.tsx',stem+'.js'])if(fs.existsSync(root+'/'+p)&&fs.statSync(root+'/'+p).isFile())return p;return null;}
function endpoint(p,name,history=false,seen=new Set()){if(!p)return null;const key=p+'#'+name;if(seen.has(key))return null;seen.add(key);const text=history&&old.has(p)?old.get(p):read(p),file=sf(text);for(const n of file.statements){if((ts.isFunctionDeclaration(n)||ts.isClassDeclaration(n)||ts.isEnumDeclaration(n)||ts.isInterfaceDeclaration(n)||ts.isTypeAliasDeclaration(n))&&n.name?.text===name)return{path:p,name};if(ts.isVariableStatement(n)&&n.declarationList.declarations.some(d=>d.name.getText(file)===name))return{path:p,name};}
for(const n of file.statements)if(ts.isExportDeclaration(n)&&n.moduleSpecifier&&n.exportClause&&ts.isNamedExports(n.exportClause))for(const e of n.exportClause.elements)if(e.name.text===name)return endpoint(resolve(p,n.moduleSpecifier.text),e.propertyName?.text??name,history,new Set(seen));
for(const n of file.statements)if(ts.isExportDeclaration(n)&&n.moduleSpecifier&&!n.exportClause){const hit=endpoint(resolve(p,n.moduleSpecifier.text),name,history,new Set(seen));if(hit)return hit;}return null;}
const actualOwner=read(owner),capture=get(actualOwner,n=>ts.isFunctionDeclaration(n)&&n.name?.text==='collectDeathShot'),actualMethod=capture.node.getText(capture.file);
let restoredMethod=exact(actualMethod,'export async function collectDeathShot(\n  runtime: DeathShotSelectionRuntime,','private async collectDeathShot(').replaceAll('runtime.','this.');
restoredMethod=exact(restoredMethod,'const resolution = runtime;','const resolution = this;');
const methodProof=compare('class Probe {\n'+edits.method+'\n}', 'class Probe {\n'+restoredMethod+'\n}');
const actualInterface=get(actualOwner,n=>ts.isInterfaceDeclaration(n)&&n.name.text==='DeathWaveActions').node.getText(sf(actualOwner));
const restoredInterface=exact(actualInterface,'export interface','interface');
const interfaceProof=compare(edits.interface.replace('export interface','interface'),restoredInterface);
const expectedRuntime=`export interface DeathShotSelectionRuntime { readonly world: World; readonly events: GameEvent[]; readonly toolGateway: ToolGateway; readonly state: Pick<RuntimeSnapshot, "phase" | "day" | "gameOver">; readonly config?: ReadonlyBoardConfig; }`;
const actualRuntime=get(actualOwner,n=>ts.isInterfaceDeclaration(n)&&n.name.text==='DeathShotSelectionRuntime').node.getText(sf(actualOwner));
const runtimeProof=compare(expectedRuntime,actualRuntime);
// 全部 runtime 属性只能映射到原成员，不允许加入提前缓存或包装 await。
const allOwnerMembers=[];walk(capture.node,n=>{if(ts.isPropertyAccessExpression(n)&&ts.isIdentifier(n.expression)&&n.expression.text==='runtime')allOwnerMembers.push(n.name.text);});
if(allOwnerMembers.some(n=>!['world','events','toolGateway','state','config'].includes(n)))throw Error('unexpected_runtime_member');
const currentDR=read(dr),call=get(currentDR,n=>ts.isCallExpression(n)&&ts.isIdentifier(n.expression)&&n.expression.text==='collectDeathShot');
if(call.node.arguments.length!==9)throw Error('call_args_changed');
const expectedQueries=`{ get world() { return resolution.world; }, get events() { return resolution.events; }, get toolGateway() { return resolution.toolGateway; }, get state() { return resolution.state; }, get config() { return resolution.config; }, }`;
const actualQueries=call.node.arguments[0].getText(call.file),queryProof=compare('const queries='+expectedQueries,'const queries='+actualQueries);
if(!queryProof.completeNoncommentLeavesSame)throw Error('query_body_changed');
queryProof.rawLayoutOutputs=queryProof.wholeOutputs;
const queryCanonical=compare(leaves('const queries='+expectedQueries).map(x=>x[1]).join(' '),leaves('const queries='+actualQueries).map(x=>x[1]).join(' '));
queryProof.wholeOutputs=queryCanonical.wholeOutputs;
queryProof.layoutPolicy='完整 getter 对象全部叶先同；只有额外对象 literal 排版导致原 raw 两输出不同，随后按完整已同 token 序列统一空白，两完整输出同。不忽略 getter 或回调。';
let restoredDR=currentDR;
restoredDR=exact(restoredDR,call.node.getText(call.file),'this.collectDeathShot('+call.node.arguments.slice(1).map(n=>n.getText(call.file)).join(',\n')+',)');
const end=restoredDR.indexOf('  /** 授予事实');if(end<0)throw Error('old_method_position_missing');restoredDR=restoredDR.slice(0,end)+restoredMethod+'\n\n'+restoredDR.slice(end);
const cls=restoredDR.indexOf('/** 连续结算死亡波');restoredDR=restoredDR.slice(0,cls)+restoredInterface+'\n\n'+restoredDR.slice(cls);
for(const e of edits.edits.filter(e=>e.path===dr&&!['  /** 收集枪的选择','/** 一次角色死亡动作','                this.collectDeathShot('].some(prefix=>e.old.startsWith(prefix)))){
 if(e.new==='') {
   if(e.old==='  type DeathShotSelection,\n')restoredDR=exact(restoredDR,'  type DeathSources,\n','  type DeathSources,\n'+e.old);
   else if(e.old==='  captureDeathShotEligibility,\n')restoredDR=exact(restoredDR,'  firstDeathGuns,\n',e.old+'  firstDeathGuns,\n');
   else throw Error('unapproved_deleted_import');
 } else restoredDR=exact(restoredDR,e.new,e.old);
}
const wholeDRProof=compare(old.get(dr),restoredDR);
let restoredPort=read(port);for(const e of edits.edits.filter(e=>e.path===port))restoredPort=exact(restoredPort,e.new,e.old);const portProof=compare(old.get(port),restoredPort);
const originalImports=bindings(dr,old.get(dr)),nativeBindings=bindings(owner,actualOwner).map(x=>{const original=originalImports.find(y=>y.name===x.name);return{...x,target:endpoint(resolve(owner,x.from),x.imported),original:original?endpoint(resolve(dr,original.from),original.imported,true):null,samePhysicalEndpoint:!!original&&JSON.stringify(endpoint(resolve(owner,x.from),x.imported))===JSON.stringify(endpoint(resolve(dr,original.from),original.imported,true))};});
const removed=['assertMagicianRosterCurrent','isMagicianBoard','resolveMagicianNightTarget','nightmareFearBlocks','demonHunterNativeGunCurrent','captureNightLife','DeathShotSelection','captureDeathShotEligibility'];
const retainedOld=originalImports.filter(x=>!removed.includes(x.name)),retainedCurrent=bindings(dr,currentDR).filter(x=>!['collectDeathShot','DeathWaveActions'].includes(x.name));
const retainedBindingProof=retainedOld.map((x,i)=>({name:x.name,same:JSON.stringify(x)===JSON.stringify(retainedCurrent[i])}));
const fearPortTarget=endpoint(port,'nightmareFearBlocks'),fearOriginalTarget=endpoint('backend/src/game/mechanisms/roles/nightmare_shadow/night_frame.ts','nightmareFearBlocks');
const source=['backend/src/game/engine/death_resolution.ts','backend/src/game/mechanisms/roles/nightmare_shadow/ports.ts',owner,'backend/tests/unit/rulesets/death-shot-selection.test.ts'].map(p=>({path:p,sha256:sha(read(p))}));
const controls=before.files.filter(x=>x.control).map(x=>({path:x.path,originalSha:x.beforeSha,currentSha:sha(read(x.path)),wholeBytesSame:x.beforeSha===sha(read(x.path))}));
const good=x=>x.completeTreeSame&&x.completeNoncommentLeavesSame&&x.wholeOutputs.every(x=>x.wholeRawSame);
const result={baseline:before.baseline,source,completeMethod:methodProof,completeMovedInterface:interfaceProof,newRuntimeExactShape:runtimeProof,callerGettersExact:queryProof,wholeDeathResolutionInverse:wholeDRProof,wholeNightmarePortInverse:portProof,ownerBindings:nativeBindings,retainedBindings:retainedBindingProof,retainedBindingsSameCount:retainedOld.length===retainedCurrent.length,fearPortTarget,fearOriginalTarget,controls,limits:['源码仅精确逆已核 runtime 参数、this 接收方、调用点查询对象、原四字段类型及具名导入；完整主体及所有其它回调不屏蔽。','这是原算法与原顺序保持的程序结构逆证明；新模块/栈/反射私有方法退休及额外闭包对象创建不宣称任意外部环境或初始化顺序完全等价。','绑定端点读取采样时实际公开源码；1428 Git 控制与后继其它职责变化不混作全传递闭包字节等价。']};
result.approved=[methodProof,interfaceProof,runtimeProof,queryProof,wholeDRProof,portProof].every(good)&&nativeBindings.every(x=>x.samePhysicalEndpoint)&&result.retainedBindingsSameCount&&retainedBindingProof.every(x=>x.same)&&controls.every(x=>x.wholeBytesSame)&&JSON.stringify(fearPortTarget)===JSON.stringify(fearOriginalTarget);
fs.writeFileSync(root+'/docs/refactor/generated/death-shot-selection-proof.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({approved:result.approved,method:methodProof,interface:interfaceProof,DR:wholeDRProof,bindingCount:nativeBindings.length,retainedBindings:retainedBindingProof.length,controls:controls.length},null,2));if(!result.approved)process.exitCode=1;
