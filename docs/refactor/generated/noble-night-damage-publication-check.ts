/**
 * 负责对秘密之身完整来源发布提取做有界机械核对。输入为实际 Git before 与三份当前源码，
 * 输出完整迁移主体、阶段经理保留程序、旧公共端口、两种运行输出及依赖／职责检查结果。
 * 仅精确逆运行引用和公开 import 路线，不把旧主体填回新 owner；不执行对局、付款或判胜。
 */
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { compiler } from "../../../tooling/refactor/architecture/contracts";
import { checkComments } from "../../../tooling/refactor/architecture/comment-check";
const ts=compiler(process.cwd()), read=(p:string)=>fs.readFileSync(p,"utf8"),sha=(s:string)=>createHash("sha256").update(s).digest("hex");
const prefix="docs/refactor/generated/noble-night-damage-publication",before=JSON.parse(read(prefix+"-before.json"));
const pm=before.source[0].path,port=before.source[1].path,owner="backend/src/game/mechanisms/roles/noble_secret_body/night-damage-publication.ts";
const old=before.source[0].text,current=read(pm),ownerSource=read(owner),portSource=read(port);
for(const f of before.source)assert.equal(sha(f.text),f.sha256);
const parse=(s:string,p="source.ts")=>ts.createSourceFile(p,s,ts.ScriptTarget.Latest,true);
let nodes=0;
function tree(n:import("typescript").Node,f:import("typescript").SourceFile):unknown{
  nodes++; const c=n.getChildren(f).filter(x=>x.kind<ts.SyntaxKind.FirstJSDocNode||x.kind>ts.SyntaxKind.LastJSDocNode);
  return [n.kind,c.length?c.map(x=>tree(x,f)):n.getText(f)];
}
function compare(a:string,b:string){const af=parse(a),bf=parse(b);nodes=0;const at=tree(af,af),count=nodes;nodes=0;assert.deepEqual(tree(bf,bf),at);return count;}
const start=old.indexOf("        if (this.config.nobleSecretBody) {\n          const final = resolveSecretBodyDamage");assert(start>=0);
const end=old.indexOf("\n        if (demon) {",start),oldBlock=old.slice(start,end);
const ownerAST=parse(ownerSource,owner),fn=ownerAST.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text==="publishNobleNightDamage");assert(fn&&ts.isFunctionDeclaration(fn)&&fn.body);
const oldBody=oldBlock.slice(oldBlock.indexOf("{")+1,oldBlock.lastIndexOf("}"));
const newBody=fn.body.getText(ownerAST).slice(1,-1).replaceAll("runtime.world","this.world").replaceAll("runtime.events","this.events");
const bodyNodes=compare("function proof(){"+oldBody+"}","function proof(){"+newBody+"}");
const newBlock=`        if (this.config.nobleSecretBody) {
          const manager = this;
          publishNobleNightDamage({
            get world() { return manager.world; },
            get events() { return manager.events; },
          }, nightDay, sources, deaths);
        }`;
assert.equal(current.split(newBlock).length,2);
const oldRest=old.replace(oldBlock,"if (this.config.nobleSecretBody) {}").replace("  resolveSecretBodyDamage,\n","").replace('import type { SecretBodySources } from "../mechanisms/roles/noble_secret_body/damage";\n',"");
const newRest=current.replace(newBlock,"if (this.config.nobleSecretBody) {}").replace("  publishNobleNightDamage,\n","");
const retainedNodes=compare(oldRest,newRest);
const extraExport='export { publishNobleNightDamage } from "./night-damage-publication";';assert.equal(portSource.split(extraExport).length,2);
const portRest=portSource.replace(extraExport,"");const portNodes=compare(before.source[1].text,portRest);
const emitted=[ts.ModuleKind.ESNext,ts.ModuleKind.CommonJS].flatMap(module=>{
  const emit=(s:string)=>ts.transpileModule(s,{compilerOptions:{module,target:ts.ScriptTarget.ES2022,removeComments:true}}).outputText;
  return [["full migrated body",'function proof(){'+oldBody+'}','function proof(){'+newBody+'}'],["complete retained PM",oldRest,newRest],["complete retained ports",before.source[1].text,portRest]].map(([name,a,b])=>{assert.equal(emit(a),emit(b));return {region:name,module:ts.ModuleKind[module],wholeRawEqual:true};});
});
const files=[pm,port,owner].map(p=>({path:p,text:read(p),sha256:sha(read(p))}));
const comments=checkComments(ts,{files,documentationPaths:[]});assert.deepEqual(comments,[]);
const resolve=(p:string,s:string):string|undefined=>{
  let stem:string;
  if(s.startsWith('.'))stem=path.posix.normalize(path.posix.join(path.posix.dirname(p),s));
  else if(s.startsWith('@ai-werewolf-arena/')){const [,pkg,...tail]=s.split('/'),base='packages/'+pkg,j=JSON.parse(read(base+'/package.json'));let e=j.exports?.[tail.length?'./'+tail.join('/') :'.'];if(typeof e==='object')e=e.import??e.default??e.types;if(!e)return;stem=path.posix.normalize(base+'/'+e);}
  else return;
  return [stem,stem+'.ts',stem+'/index.ts',stem+'.tsx',stem+'.js'].find(c=>fs.existsSync(c)&&fs.statSync(c).isFile());
};
const graph=new Map<string,string[]>();
function visit(p:string){if(graph.has(p))return;const e=ts.transpileModule(read(p),{fileName:p,compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,removeComments:true}}).outputText,f=parse(e,p),deps:string[]=[];graph.set(p,deps);for(const n of f.statements){if(!(ts.isImportDeclaration(n)||ts.isExportDeclaration(n))||!n.moduleSpecifier||!ts.isStringLiteral(n.moduleSpecifier))continue;const q=resolve(p,n.moduleSpecifier.text);if(q){deps.push(q);visit(q);}}}
visit(owner);assert(!graph.has(pm),"new publication owner must not load PhaseManager");assert(![...graph.keys()].some(p=>p.startsWith("backend/src/ai/")),"new owner must not load agent transport");
const result={baseCommit:before.baseCommit,source:files.map(({path,sha256})=>({path,sha256})),fullBodyTokenNodes:bodyNodes,completeRetainedPMTokenNodes:retainedNodes,completeRetainedPortsTokenNodes:portNodes,regionsEqual:true,outputs:emitted,headDiagnostics:comments,graph:{relativeAndWorkspaceValueModules:graph.size,containsPM:false,containsAI:false},limits:["新增公开函数、getter载体及模块加载路线改变；不承诺模块反射与调用栈相同。","静态声明值依赖不执行动态或npm加载；完整付款、authority、死亡和判胜算法未搬入该模块。"]};
fs.writeFileSync(prefix+"-proof.json",JSON.stringify(result,null,2)+"\n");process.stdout.write(JSON.stringify({body:bodyNodes,retainedPM:retainedNodes,ports:portNodes,outputs:emitted.length,heads:comments.length,graph:graph.size})+"\n");
