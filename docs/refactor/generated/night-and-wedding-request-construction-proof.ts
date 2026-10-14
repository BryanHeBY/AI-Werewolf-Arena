/**
 * 负责本批完整源码的精确迁移核对；输入真实 Git 原文、登记编辑与当前源，输出全文及有限编译对照。
 * 四个控制器正文仅逆原 new 点的构造依赖，保其余全部 token；编译比较是精确逆后输出，不声称当前新 API 字节相同。
 * 不启动对局、类型检查、职责门禁或模型；实际许可和关闭前缀由源码审读及有界风险用例核对。
 */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { compiler } from "../../../tooling/refactor/architecture/contracts";
const ts=compiler(process.cwd());
const prefix="docs/refactor/generated/night-and-wedding-request-construction-";
const before=JSON.parse(fs.readFileSync(prefix+"before.json","utf8"));
const edits=JSON.parse(fs.readFileSync(prefix+"edits.json","utf8"));
const sha=(s:string)=>createHash("sha256").update(s).digest("hex");
function ensure(ok:boolean, detail:string){if(!ok)throw new Error(detail);}
function source(text:string,p:string){return ts.createSourceFile(p,text,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS);}
function tokens(node:import("typescript").Node,sf:import("typescript").SourceFile):Array<[number,string]>{
 const out:Array<[number,string]>=[];
 function visit(n:import("typescript").Node):void{
  if(n.kind>=ts.SyntaxKind.FirstJSDocNode&&n.kind<=ts.SyntaxKind.LastJSDocNode)return;
  const children=n.getChildren(sf);if(children.length)children.forEach(visit);else out.push([n.kind,n.getText(sf)]);
 }
 visit(node);return out;
}
function emit(text:string,p:string,module:import("typescript").ModuleKind){return ts.transpileModule(text,{fileName:p,compilerOptions:{target:ts.ScriptTarget.ES2022,module,removeComments:true,sourceMap:false,inlineSourceMap:false}}).outputText;}
const rows=before.source.map((item:{path:string,text:string,sha256:string})=>{
 const git=execFileSync("git",["show",before.baseCommit+":"+item.path],{encoding:"utf8"});
 ensure(git===item.text&&sha(git)===item.sha256,"actual-Git:"+item.path);
 const current=fs.readFileSync(item.path,"utf8");let forward=git;
 for(const change of edits[item.path]){
  if(change.operation==="prepend")forward=change.new+forward;
  else{ensure(forward.split(change.old).length===(change.count??1)+1,"unique-forward:"+item.path+":"+change.old);forward=forward.replaceAll(change.old,change.new);}
 }
 ensure(forward===current,"whole-forward:"+item.path);let inverse=current;
 for(const change of [...edits[item.path]].reverse()){
  if(change.operation==="prepend"){ensure(inverse.startsWith(change.new),"prepend-inverse:"+item.path);inverse=inverse.slice(change.new.length);}
  else{ensure(inverse.split(change.new).length===(change.count??1)+1,"unique-inverse:"+item.path+":"+change.new);inverse=inverse.replaceAll(change.new,change.old);}
 }
 ensure(inverse===git,"whole-inverse:"+item.path);
 const sf=source(git,item.path), mapped=source(inverse,item.path);const leaves=tokens(sf,sf);
 ensure(JSON.stringify(leaves)===JSON.stringify(tokens(mapped,mapped)),"whole-tokens:"+item.path);
 const outputs=[ts.ModuleKind.ESNext,ts.ModuleKind.CommonJS].map(module=>{const old=emit(git,item.path,module),restored=emit(inverse,item.path,module);ensure(old===restored,"whole-mapped-emit:"+item.path);return {module:ts.ModuleKind[module],sha256:sha(old),mappedSame:true};});
 return {path:item.path,beforeSHA256:item.sha256,sha256:sha(current),preciseEdits:edits[item.path].length,wholeForwardAndInverseSame:true,inverseTokenCount:leaves.length,outputs};
});
const executeBodies=[...before.source.slice(0,3),before.source[4]].map((item:{path:string,text:string})=>{
 const current=fs.readFileSync(item.path,"utf8");
 function body(text:string){const sf=source(text,item.path);let selected:import("typescript").Block|undefined;function visit(n:import("typescript").Node):void{if(ts.isFunctionDeclaration(n)&&n.name?.text===({"controller.ts":"executeDemonHunterTurn","native_night_controller.ts":"executeDemonNativeNight","native_potion_controller.ts":"executeDemonWitchTurn","setup.ts":"executeWeddingTurn"}[path.basename(item.path)]))selected=n.body;ts.forEachChild(n,visit);}visit(sf);ensure(!!selected,"function-body:"+item.path);return selected!.getText(sf);}
 const actual=body(current),old=body(item.text);const marker=item.path.includes("native_night")?"new ctx.requestFactory(":"new input.construction.requestFactory(";ensure(actual.split(marker).length===2,"sole-callee:"+item.path);
 const mapped=source(actual.replace(marker,"new GameActionRequestFactory("),item.path),original=source(old,item.path);ensure(JSON.stringify(tokens(original,original))===JSON.stringify(tokens(mapped,mapped)),"entire-controller:"+item.path);
 return {path:item.path,wholeBodyTokensSameAfterSoleCalleeInverse:true,tokenCount:tokens(original,original).length,originalTryBoundaryKept:true};
});
const controls=before.controls.map((c:{path:string,text:string,sha256:string})=>{const current=fs.readFileSync(c.path,"utf8"),git=execFileSync("git",["show",before.baseCommit+":"+c.path],{encoding:"utf8"});ensure(current===git&&current===c.text&&sha(current)===c.sha256,"control:"+c.path);return {path:c.path,sha256:c.sha256,actualGitAndCurrentSame:true};});
// 精确检查值绑定仅归真实组合端；相关本族叶只导入原中立构造类型，外部真实 caller 使用实际类。
const bindings=before.source.map((item:{path:string})=>{const sf=source(fs.readFileSync(item.path,"utf8"),item.path);const selected:Array<{name:string,local:string,module:string,typeOnly:boolean}>=[];
 for(const stmt of sf.statements){if(!ts.isImportDeclaration(stmt)||!stmt.importClause||!ts.isStringLiteral(stmt.moduleSpecifier))continue;const named=stmt.importClause.namedBindings;if(!named||!ts.isNamedImports(named))continue;for(const el of named.elements){const name=(el.propertyName??el.name).text;if(name!=="GameActionRequestFactory"&&name!=="ActionRequestFactoryConstructorPort")continue;const route=stmt.moduleSpecifier.text;const endpoint=path.posix.normalize(path.posix.join(path.posix.dirname(item.path),route))+".ts";ensure(endpoint===(name==="GameActionRequestFactory"?"backend/src/game/engine/action_request_factory.ts":"backend/src/core/domain/actions.ts"),"physical-binding:"+item.path);const owner=source(fs.readFileSync(endpoint,"utf8"),endpoint);ensure(owner.statements.some(n=>(ts.isClassDeclaration(n)||ts.isInterfaceDeclaration(n))&&n.name?.text===name),"actual-owner-decl:"+name);selected.push({name,local:el.name.text,module:route,typeOnly:!!stmt.importClause.isTypeOnly||el.isTypeOnly});}}
 return {path:item.path,selected};
});
const report={approved:true,baseCommit:before.baseCommit,source:rows,executeBodies,controls,bindings,newUnit:{path:before.new[0],sha256:sha(fs.readFileSync(before.new[0],"utf8"))},summary:{sources:rows.length,preciseEdits:rows.reduce((n:any,r:any)=>n+r.preciseEdits,0),wholeMappedOutputs:rows.length*2,wholeInverseTokens:rows.reduce((n:any,r:any)=>n+r.inverseTokenCount,0),executeBodies:4,controls:4},limits:["编译输出是明确逆构造参数、字段与新测试后的完整映射对照；不承诺当前新必填 API 及构造字段具有旧运行反射形状。","默认装配 getter 在原 new 点读实际类；外部显式传入构造依赖的接受面、module load/sourceHash 有意改变。","只核本批及原控制，未证明并行 World/PM/DR/NP 或传递图全部字节恒定。"]};
fs.writeFileSync(prefix+"proof.json",JSON.stringify(report,null,2)+"\n");console.log(JSON.stringify(report.summary));
