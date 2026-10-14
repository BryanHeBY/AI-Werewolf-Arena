/**
 * 负责本批公开查询的物理绑定与新增模块返回路径盘点。输入为已保存原源码和当前值导入图；
 * 输出为实际端点及指定返回路径，不运行模块或承诺动态导入与全冷启动等价。
 */
const fs=require('fs'),path=require('path'),ts=require('../../../backend/node_modules/typescript'),cp=require('child_process');
const read=p=>fs.readFileSync(p,'utf8'),parse=(p,s=read(p))=>ts.createSourceFile(p,s,ts.ScriptTarget.Latest,true),root='backend/src/rulesets/night-readability.ts',pipeline='backend/src/game/engine/phase_pipeline/night_pipeline.ts';
const before=JSON.parse(read('docs/refactor/generated/night-readability-before.json'));
function resolve(p,spec) {
 if(spec.startsWith('@ai-werewolf-arena/')){const name=spec.split('/')[1],pkg='packages/'+name,j=JSON.parse(read(pkg+'/package.json')),key=spec.split('/').length>2?'./'+spec.split('/').slice(2).join('/') :'.';let x=j.exports?.[key];if(typeof x==='object')x=x.types??x.import??x.default;return typeof x==='string'?path.posix.normalize(pkg+'/'+x):null;}
 if(!spec.startsWith('.'))return null;const stem=path.posix.normalize(path.posix.join(path.posix.dirname(p),spec));return [stem,stem+'.ts',stem+'.tsx',stem+'.js',stem+'.cjs',stem+'.mjs',stem+'/index.ts'].find(x=>fs.existsSync(x)&&fs.statSync(x).isFile())??null;
}
function imports(p,s=read(p)){const rows=[];for(const n of parse(p,s).statements){if(ts.isImportDeclaration(n)&&n.importClause&&!n.importClause.isTypeOnly){const c=n.importClause;if(c.name)rows.push({name:c.name.text,from:n.moduleSpecifier.text});if(c.namedBindings&&ts.isNamedImports(c.namedBindings))for(const e of c.namedBindings.elements)if(!e.isTypeOnly)rows.push({name:e.name.text,imported:e.propertyName?.text??e.name.text,from:n.moduleSpecifier.text});}}return rows;}
function endpoint(p,name,seen=new Set()) {
 if(!p||seen.has(p+':'+name))return null;seen.add(p+':'+name);const sf=parse(p);
 for(const n of sf.statements){if((ts.isFunctionDeclaration(n)||ts.isClassDeclaration(n))&&n.name?.text===name)return {path:p,name};if(ts.isVariableStatement(n)&&n.declarationList.declarations.some(d=>d.name.getText(sf)===name))return {path:p,name};}
 for(const n of sf.statements){if(ts.isExportDeclaration(n)&&n.moduleSpecifier){const target=resolve(p,n.moduleSpecifier.text);if(!n.exportClause){const x=endpoint(target,name,new Set(seen));if(x)return x;}else if(ts.isNamedExports(n.exportClause)){for(const e of n.exportClause.elements)if(e.name.text===name)return endpoint(target,e.propertyName?.text??e.name.text,new Set(seen));}}}
 return null;
}
const oldImports=imports(pipeline,before.source[0].text),newImports=imports(root),bindings=newImports.map(r=>{const old=oldImports.find(x=>x.name===r.name);return {name:r.name,old:endpoint(resolve(pipeline,old?.from??''),old?.imported??r.name),current:endpoint(resolve(root,r.from),r.imported??r.name)};});
if(bindings.some(r=>JSON.stringify(r.old)!==JSON.stringify(r.current)))throw Error('moved_binding_changed');
const currentKept=imports(pipeline).filter(r=>!['assertNightSetupReady','assertNightReadable'].includes(r.name)),keptNames=new Set(currentKept.map(r=>r.name)),oldKept=oldImports.filter(r=>keptNames.has(r.name));
if(oldImports.some(r=>!keptNames.has(r.name)&&!newImports.some(n=>n.name===r.name)))throw Error('unowned_retired_binding');
const normal=r=>[r.name,r.imported??r.name,endpoint(resolve(pipeline,r.from),r.imported??r.name)];
if(JSON.stringify(oldKept.map(normal))!==JSON.stringify(currentKept.map(normal)))throw Error('kept_pipeline_binding_changed');
const graph=new Map(),external=new Set();
function collect(p){if(!p||graph.has(p))return;graph.set(p,[]);const sf=parse(p);for(const n of sf.statements){let spec=null;if(ts.isImportDeclaration(n)){const c=n.importClause;if(c?.isTypeOnly||c?.namedBindings&&ts.isNamedImports(c.namedBindings)&&!c.name&&c.namedBindings.elements.every(e=>e.isTypeOnly))continue;spec=n.moduleSpecifier.text;}else if(ts.isExportDeclaration(n)&&n.moduleSpecifier&&!n.isTypeOnly){if(n.exportClause&&ts.isNamedExports(n.exportClause)&&n.exportClause.elements.every(e=>e.isTypeOnly))continue;spec=n.moduleSpecifier.text;}if(spec){const q=resolve(p,spec);if(q){graph.get(p).push(q);collect(q);}else external.add(spec);}}}
collect(root);
function route(start,target){const queue=[[start]],seen=new Set();for(let i=0;i<queue.length;i++){const r=queue[i],p=r.at(-1);if(p===target)return r;if(seen.has(p))continue;seen.add(p);for(const q of graph.get(p)??[])queue.push([...r,q]);}return null;}
const returns=[...new Set(graph.get(root))].map(p=>({from:p,toOwner:route(p,root),toPipeline:route(p,pipeline)}));
const result={bindings,remainingPipelineBindingsSame:true,remainingPipelineBindingCount:currentKept.length,modules:graph.size,returns,reachableAI:[...graph.keys()].filter(p=>p.startsWith('backend/src/ai/')),external:[...external].sort(),limits:'当前声明式非type import/export有限图，未枚举计算型动态依赖或执行冷初始化；只核指定新增owner/pipeline返回路径。'};
fs.writeFileSync('docs/refactor/generated/night-readability-bindings-graph.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({bindings:bindings.length,modules:graph.size,returning:returns.filter(r=>r.toOwner||r.toPipeline),AI:result.reachableAI.length}));if(returns.some(r=>r.toOwner||r.toPipeline))process.exitCode=1;
