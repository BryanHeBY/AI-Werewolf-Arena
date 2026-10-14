import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
import ts from '/home/hby/dev/AI-Werewolf-Arena/backend/node_modules/typescript';
import {checkComments} from '/home/hby/dev/AI-Werewolf-Arena/tooling/refactor/architecture/comment-check';
const root=process.cwd(),read=(p:string)=>fs.readFileSync(path.join(root,p),'utf8'),sha=(s:string)=>crypto.createHash('sha256').update(s).digest('hex');
const before=JSON.parse(read('docs/refactor/generated/wolf-ability-assembly-before.json'));
const originals=new Map<string,string>(before.before.map((r:{path:string,text:string})=>[r.path,r.text]));
const parse=(s:string,p:string)=>ts.createSourceFile(p,s,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS);
const resolve=(p:string,s:string):string|null=>{
 if(!s.startsWith('.')){
  if(!s.startsWith('@ai-werewolf-arena/'))return null;
  const [,pkg,...tail]=s.split('/'),base='packages/'+pkg,j=JSON.parse(read(base+'/package.json'));let target=j.exports?.[tail.length?'./'+tail.join('/') :'.'];if(typeof target==='object')target=target.import??target.default??target.types;
  return target?path.posix.normalize(base+'/'+target):null;
 }
 const stem=path.posix.normalize(path.posix.join(path.posix.dirname(p),s));for(const c of[stem,stem+'.ts',stem+'/index.ts',stem+'.tsx',stem+'.js'])if(fs.existsSync(path.join(root,c))&&fs.statSync(path.join(root,c)).isFile())return c;return null;
};
const oldProfile='backend/src/game/mechanisms/roles/wolf/profile.ts',owner='backend/src/game/mechanisms/roles/wolf/ability-assembly.ts',port='backend/src/game/mechanisms/roles/wolf/ability-ports.ts';
function graph(previous:boolean){const edges=new Map<string,string[]>();function visit(p:string){if(edges.has(p))return;const source=previous&&originals.has(p)?originals.get(p)!:read(p);const emitted=ts.transpileModule(source,{fileName:p,compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,removeComments:true}}).outputText;const f=parse(emitted,p),targets:string[]=[];edges.set(p,targets);for(const n of f.statements){let spec:string|undefined;if(ts.isImportDeclaration(n)||ts.isExportDeclaration(n))if(n.moduleSpecifier&&ts.isStringLiteral(n.moduleSpecifier))spec=n.moduleSpecifier.text;if(!spec)continue;const q=resolve(p,spec);if(q){targets.push(q);visit(q);}}}
 for(const p of [oldProfile,...before.before.slice(1).map((r:{path:string})=>r.path)])visit(p);
 return edges;
}
const previous=graph(true),current=graph(false);
function normalized(edges:Map<string,string[]>,candidate:boolean){const r=new Map<string,Set<string>>(),name=(p:string)=>candidate&&p===owner?oldProfile:p;for(const [p,list]of edges){if(candidate&&(p===oldProfile||p===port))continue;const row=r.get(name(p))??new Set<string>();r.set(name(p),row);for(const q of list){if(candidate&&(q===port||q===oldProfile)){
  // 公共facet只添加原assembly已有依赖；消去实际alias／转发节点后核对真实运行依赖，不删任何业务owner。
  row.add(oldProfile);
  if(q===port)for(const dep of edges.get(port)??[])if(dep!==owner)row.add(name(dep));
 }else row.add(name(q));}}
 // port附加的原leaf已属于oldProfile的真实依赖，可影响直接consumer图形，不能假称每个consumer原imports物理图相同。
 return r;
}
const a=normalized(previous,false),b=normalized(current,true);
function reach(edges:Map<string,Set<string>>,p:string){const reached=new Set<string>();function visit(q:string){if(reached.has(q))return;reached.add(q);for(const x of edges.get(q)??[])visit(x);}visit(p);return reached;}
const checks=[...a.keys()].map(p=>({path:p,sameReachableBusinessOwners:JSON.stringify([...reach(a,p)].sort())===JSON.stringify([...reach(b,p)].sort())}));
const added=[...b.keys()].filter(p=>!a.has(p));const lost=[...a.keys()].filter(p=>!b.has(p));
const docs=execFileSync('git',['ls-files','docs/**/*.md','README.md'],{encoding:'utf8'}).trim().split('\n').filter(Boolean);
const files=before.sourceScope.map((p:string)=>({path:p,text:read(p),sha256:sha(read(p))}));const diagnostics=checkComments(ts,{files,documentationPaths:docs});
const missingCN=files.filter((f:{text:string})=>!/[\u4e00-\u9fff]/.test(f.text.slice(0,f.text.indexOf('*/')+2))).map((f:{path:string})=>f.path);
const report={roots:21,oldRuntimeModules:previous.size,newRuntimeModules:current.size,newPublicNodes:[owner,port],normalizedBusinessNodesBefore:a.size,normalizedBusinessNodesAfter:b.size,addedBusinessOwners:added,lostBusinessOwners:lost,reachabilityChecks:checks.length,reachabilityMismatches:checks.filter(x=>!x.sameReachableBusinessOwners),limits:['按每个完整程序ESNext emitted import/export核真正值依赖；忽略外部npm执行和动态import，未执行20种首次入口。','新增same-binding publicport/alias实际节点不等同于旧图；既有可达循环没有声称清零。对原全部业务owner保完整可达集合，不仅比较新owner自身。']};
fs.writeFileSync('docs/refactor/generated/wolf-ability-assembly-module-graph.json',JSON.stringify(report,null,2)+'\n');fs.writeFileSync('docs/refactor/generated/wolf-ability-assembly-heads.json',JSON.stringify({inputs:files.map(({path,sha256})=>({path,sha256})),documentationPaths:docs.length,diagnostics,missingCN},null,2)+'\n');
console.log(JSON.stringify({old:previous.size,current:current.size,checks:checks.length,mismatch:report.reachabilityMismatches.length,added,lost,heads:diagnostics.length,missingCN:missingCN.length,docs:docs.length}));if(report.reachabilityMismatches.length||added.length||lost.length||diagnostics.length||missingCN.length)process.exitCode=1;
