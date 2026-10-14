/** 只读追踪完整擦除后的静态加载边；动态导入和 require 单列，不冒完整执行顺序。 */
const ts=require('../../../backend/node_modules/typescript'),fs=require('fs'),path=require('path'),crypto=require('crypto');
const root=process.cwd(),file=p=>path.resolve(root,p),rel=p=>path.relative(root,p),sha=s=>crypto.createHash('sha256').update(s).digest('hex');
const cfg=ts.readConfigFile(file('backend/tsconfig.tests.json'),ts.sys.readFile),options=ts.parseJsonConfigFileContent(cfg.config,ts.sys,file('backend')).options;
function walk(n,fn){fn(n);ts.forEachChild(n,c=>{walk(c,fn);});}
const entries=process.argv.slice(2),seen=new Map();
function visit(p){p=fs.realpathSync(p);if(seen.has(p))return;const s=fs.readFileSync(p,'utf8'),out=ts.transpileModule(s,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
 const ast=ts.createSourceFile(p,out,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS),edges=[],deferred=[];seen.set(p,{path:rel(p),sha:sha(s),edges,deferred});
 walk(ast,n=>{if((ts.isImportDeclaration(n)||ts.isExportDeclaration(n))&&n.moduleSpecifier&&ts.isStringLiteral(n.moduleSpecifier))edges.push(n.moduleSpecifier.text);if(ts.isCallExpression(n)&&(n.expression.kind===ts.SyntaxKind.ImportKeyword||(ts.isIdentifier(n.expression)&&n.expression.text==='require')))deferred.push(n.getText(ast));});
 for(let i=0;i<edges.length;i++){const specifier=edges[i],target=ts.resolveModuleName(specifier,p,options,ts.sys).resolvedModule?.resolvedFileName;
 edges[i]={specifier,target:target?rel(fs.realpathSync(target)):null};if(target&&!target.includes('node_modules')&&!target.endsWith('.d.ts'))visit(target);}
}
for(const e of entries)visit(file(e));
function route(from,to){const q=[[file(from),[]]],visited=new Set();while(q.length){const [p,chain]=q.shift();if(visited.has(p))continue;visited.add(p);if(rel(p)===to)return [...chain,to];for(const e of seen.get(p)?.edges??[])if(e.target)q.push([file(e.target),[...chain,rel(p)]]);}return null;}
const checks=[];for(const e of entries)checks.push({from:e,to:'backend/src/game/engine/death_resolution.ts',route:route(e,'backend/src/game/engine/death_resolution.ts')});
const result={entries,moduleCount:seen.size,checks,modules:[...seen.values()],limit:'仅完整擦除输出的静态字面 import/export；require 与动态 import 保留为 deferred，未执行所有初始化。'};
const name=entries.some(e=>e.includes('death-shot-selection.ts'))?'death-shot-selection-module-graph.json':'death-shot-selection-factory-graph-before.json';fs.writeFileSync(file('docs/refactor/generated/'+name),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({moduleCount:seen.size,checks,deferred:[...seen.values()].flatMap(x=>x.deferred.map(d=>({path:x.path,expression:d})))},null,2));
