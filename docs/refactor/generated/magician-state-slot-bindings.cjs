/** 对照完整具名绑定与实际公开终点；仅静态检查新槽的有界值图，不声称执行冷加载。 */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{createHash}=require('node:crypto');
const ts=require('../../../backend/node_modules/typescript'),prefix='docs/refactor/generated/magician-state-slot-';
const before=JSON.parse(fs.readFileSync(prefix+'before.json','utf8')),edits=JSON.parse(fs.readFileSync(prefix+'edits.json','utf8'));
const root=process.cwd(),sha=s=>createHash('sha256').update(s).digest('hex'),read=p=>fs.readFileSync(p,'utf8');
const options=ts.parseJsonConfigFileContent(ts.readConfigFile('backend/tsconfig.tests.json',ts.sys.readFile).config,ts.sys,path.resolve('backend')).options;
function parse(p,s=read(p)){const f=ts.createSourceFile(p,s,ts.ScriptTarget.Latest,true);assert.equal(f.parseDiagnostics.length,0);return f;}
const rel=p=>path.relative(root,p).split(path.sep).join('/');
function resolve(p,m){return ts.resolveModuleName(m,path.resolve(p),options,ts.sys).resolvedModule?.resolvedFileName;}
function records(p,s){const f=parse(p,s),rows=[];for(const n of f.statements){
 if(!ts.isImportDeclaration(n)&&!ts.isExportDeclaration(n))continue;
 if(!n.moduleSpecifier||!ts.isStringLiteralLike(n.moduleSpecifier))continue;
 const route=n.moduleSpecifier.text;
 if(ts.isImportDeclaration(n)){const c=n.importClause;if(!c){rows.push({form:'side-effect',route});continue;}
  if(c.name)rows.push({form:'default',route,name:'default',local:c.name.text,typeOnly:c.isTypeOnly});
  if(c.namedBindings){if(ts.isNamespaceImport(c.namedBindings))rows.push({form:'namespace',route,name:'*',local:c.namedBindings.name.text,typeOnly:c.isTypeOnly});else for(const b of c.namedBindings.elements)rows.push({form:'import',route,name:(b.propertyName??b.name).text,local:b.name.text,typeOnly:c.isTypeOnly||b.isTypeOnly});}
 }else{if(!n.exportClause)rows.push({form:'star-export',route,name:'*',typeOnly:n.isTypeOnly});else if(ts.isNamespaceExport(n.exportClause))rows.push({form:'namespace-export',route,name:'*',local:n.exportClause.name.text,typeOnly:n.isTypeOnly});else for(const b of n.exportClause.elements)rows.push({form:'export',route,name:(b.propertyName??b.name).text,local:b.name.text,typeOnly:n.isTypeOnly||b.isTypeOnly});}
 }return rows;}
const consumerBindings=[];let unchanged=0,rerouted=0,removed=0,added=0;
for(const original of before.source.filter(x=>x.path!==edits.old)){
 const prior=records(original.path,original.text),expected=prior.map(x=>({...x}));
 for(const r of expected){const oldTarget=resolve(original.path,r.route);const isOld=oldTarget&&rel(oldTarget)===edits.old||/magician\/state$/.test(r.route)||(original.path.includes('/magician/')&&r.route==='./state');
  if(!isOld){unchanged++;continue;}rerouted++;
  if(original.path.endsWith('/player-observation-projector.ts'))r.route='../mechanisms/roles/magician/ports';
  else r.route=r.route.replace(/\/state$/,'/state-slot');
  if(original.path.endsWith('/magician/profile.ts')&&r.name==='createMagicianState'){r.name='MAGICIAN_STATE_SLOT';r.local='MAGICIAN_STATE_SLOT';removed++;added++;}
 }
 if(original.path.endsWith('/magician/night_frame.ts')){const i=expected.findIndex(r=>r.route==='./state-slot'&&r.name==='MAGICIAN_ROLE');expected.splice(i+1,0,{form:'import',route:'./state-slot',name:'MAGICIAN_STATE_SLOT',local:'MAGICIAN_STATE_SLOT',typeOnly:false});added++;}
 if(original.path.endsWith('/magician/ports.ts')){const i=expected.findIndex(r=>r.route==='./state-slot'&&r.name==='getMagicianState');expected.splice(i+1,0,{form:'export',route:'./state-slot',name:'projectMagicianState',local:'projectMagicianState',typeOnly:false});added++;}
 const actual=records(original.path,read(original.path));assert.deepEqual(actual,expected,original.path+' every import/export mode/name/route');consumerBindings.push({path:original.path,before:prior.length,after:actual.length,allBindingFormsNamesAliasesAndRoutesMatched:true});
}
function declaration(p,name){const f=parse(p);const n=f.statements.find(n=>(ts.isFunctionDeclaration(n)&&n.name?.text===name)||(ts.isVariableStatement(n)&&n.declarationList.declarations.some(d=>ts.isIdentifier(d.name)&&d.name.text===name)));assert.ok(n,p+' owns '+name);return{path:p,name,sourceSHA256:sha(read(p)),kind:ts.SyntaxKind[n.kind]};}
const endpoints=['MAGICIAN_POLICY','MAGICIAN_ROLE','getMagicianState','createMagicianState','projectMagicianState','MAGICIAN_STATE_SLOT'].map(n=>declaration(edits.owner,n));
const publicExports=records('backend/src/game/mechanisms/roles/magician/ports.ts',read('backend/src/game/mechanisms/roles/magician/ports.ts')).filter(r=>r.route==='./state-slot');assert.deepEqual(publicExports.map(x=>x.name),['getMagicianState','projectMagicianState']);assert.equal(rel(resolve('backend/src/game/mechanisms/roles/magician/ports.ts','./state-slot')),edits.owner);
// 新槽运行依赖沿用原状态的 core 与 Node 入口。对当前源码采样有界值图，纯 type 边不算初始化。
const oldImports=records(edits.old,before.source.find(x=>x.path===edits.old).text),newImports=records(edits.owner,read(edits.owner));assert.deepEqual(newImports,oldImports);
const seen=new Map(),external=new Set(),edges=[];function visit(p){if(seen.has(p))return;seen.set(p,sha(read(p)));for(const r of records(p,read(p))){if(r.typeOnly)continue;const absolute=resolve(p,r.route);if(!absolute||absolute.includes('/node_modules/')){external.add(r.route);continue;}const target=rel(absolute);if(!target.startsWith('backend/src/')&&!target.startsWith('packages/')){external.add(r.route);continue;}edges.push([p,target]);visit(target);}}
visit(edits.owner);
const forbidden=['backend/src/game/mechanisms/roles/magician/night_frame.ts','backend/src/game/mechanisms/roles/magician/profile.ts','backend/src/game/observation/player-observation-projector.ts'];for(const p of forbidden)assert.equal(seen.has(p),false,'new owner value graph must not reach consumer '+p);
const result={approved:true,baseCommit:before.baseCommit,consumerBindings,summary:{consumerPrograms:consumerBindings.length,beforeBindings:consumerBindings.reduce((n,x)=>n+x.before,0),afterBindings:consumerBindings.reduce((n,x)=>n+x.after,0),unchangedBindings:unchanged,reroutedBindings:rerouted,retiredFactoryImport:removed,newTableAndProjectBindings:added},physicalOwnerEndpoints:endpoints,publicProjection:{path:'backend/src/game/mechanisms/roles/magician/ports.ts',route:'./state-slot',names:publicExports.map(x=>x.name),sameDeclarationBindings:true},boundedRuntimeGraph:{root:edits.owner,sameOriginalDirectImportModesNamesAndRoutes:true,modules:[...seen].map(([path,sha256])=>({path,sha256})),edges:edges.length,externalModules:[...external].sort(),forbiddenConsumerBackEdges:[],limits:'仅当前静态值图；不执行冷加载，不称并行 WIP 全图与旧 Git 相同，推断性旧 import 擦除按原源码模式保持。'},limits:['全部原消费者 import/export 模式、名称、别名和具体路由均逐项核对；未将仅模式对照称为所有外部包物理声明证明。','实际本族公开 get/project 及新表的声明终点明确；未修改共享类型 owner、旧验证器、录制或生命许可。']};
fs.writeFileSync(prefix+'bindings.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({approved:true,...result.summary,physicalEndpoints:endpoints.length,valueModules:seen.size,edges:edges.length}));
