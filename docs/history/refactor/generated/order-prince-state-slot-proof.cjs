/** 本批实际Git、完整数据程序及全消费者精确迁移核对；不运行类型、测试或架构门禁。 */
const fs=require("node:fs"),cp=require("node:child_process"),assert=require("node:assert/strict"),crypto=require("node:crypto");
const ts=require("../../../backend/node_modules/typescript"),p="docs/refactor/generated/order-prince-state-slot-";
const before=JSON.parse(fs.readFileSync(p+"before.json","utf8")),mapping=JSON.parse(fs.readFileSync(p+"edits.json","utf8")),slot=fs.readFileSync(mapping.newPath,"utf8");
const h=s=>crypto.createHash("sha256").update(s).digest("hex"),parse=s=>ts.createSourceFile("input.ts",s,ts.ScriptTarget.Latest,true);
const body=(s,name)=>{const sf=parse(s),fn=sf.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name.text===name);assert(fn?.body);return fn.body.statements.map(n=>n.getText(sf)).join("\n");};
const print=s=>ts.createPrinter({removeComments:true}).printFile(parse(s)),programs=[],dataPrograms=[];
function check(name,a,b){assert.equal(print(a),print(b));dataPrograms.push({name,wholeNormalizedSame:true,sourceSHA256:h(a),originalSHA256:h(b)});}
const oldState=before.source.find(r=>r.path===mapping.oldPath).text,oldFunctions=parse(oldState).statements.filter(ts.isFunctionDeclaration).map(n=>n.name.text);
assert.equal(oldFunctions.length,8);
for(const name of oldFunctions)check(name,body(slot,name),body(oldState,name));
check("install",body(slot,"installOrderPrinceState").replace("privateState()","role.privateState"),"role.privateState.orderPrince = createOrderPrinceState();");
check("replacement",body(slot,"replaceOrderPrinceState").replace("privateState()","b.privateState"),"(b.privateState as { orderPrince: OrderPrinceState }).orderPrince = next;");
check("projected expected",body(slot,"encodeOrderPrinceProjection").replace("role()","b.role"),"return JSON.stringify(projectOrderPrinceState(b.role));");
check("prepared expected",body(slot,"encodeOrderPrinceNext"),"return JSON.stringify(next);");
assert.deepEqual(parse(slot).statements.filter(ts.isFunctionDeclaration).map(n=>n.name.text),[...oldFunctions,"installOrderPrinceState","replaceOrderPrinceState","encodeOrderPrinceProjection","encodeOrderPrinceNext"]);
for(const row of before.source){
 assert.equal(cp.execFileSync("git",["show",before.baseCommit+":"+row.path],{encoding:"utf8"}),row.text);
 const target=row.path===mapping.oldPath?mapping.newPath:row.path,full=fs.readFileSync(target,"utf8"),current=target===mapping.newPath?full.slice(0,full.indexOf("\n/** 原初始化")):full,edits=mapping.edits.filter(e=>e.path===target);
 let forward=row.text,inverse=current;
 for(const e of edits){assert.equal(forward.split(e.before).length-1,1);forward=forward.replace(e.before,e.after);}assert.equal(current,forward);
 for(const e of [...edits].reverse()){assert.equal(inverse.split(e.after).length-1,1);inverse=inverse.replace(e.after,e.before);}assert.equal(inverse,row.text);
 const outputs=[];for(const module of [ts.ModuleKind.ESNext,ts.ModuleKind.CommonJS]){const emit=text=>ts.transpileModule(text,{fileName:row.path,compilerOptions:{target:ts.ScriptTarget.ES2022,module,removeComments:true}}).outputText;assert.equal(emit(inverse),emit(row.text));outputs.push(h(emit(row.text)));}
 programs.push({path:target,beforePath:row.path,sha256:h(full),wholeExactForwardInverseSame:true,mappedOutputSHA256:outputs});
}
assert(!fs.existsSync(mapping.oldPath));
for(const row of before.controls){assert.equal(h(fs.readFileSync(row.path)),row.sha256);assert.equal(h(cp.execFileSync("git",["show",before.baseCommit+":"+row.path])),row.sha256);}
const ports=fs.readFileSync("backend/src/game/mechanisms/roles/order_prince/ports.ts","utf8");assert(ports.includes('export { getOrderPrinceState, projectOrderPrinceState } from "./state-slot";'));assert(!ports.includes("STATE_SLOT"));
const roots=["backend/src","backend/tests","frontend/src","frontend/tests","packages","tooling"],retired=[];
function walk(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true})){const file=dir+"/"+e.name;if(e.isDirectory()&&!['node_modules','dist'].includes(e.name))walk(file);else if(e.isFile()&&/\.[cm]?[jt]sx?$/.test(file)){const sf=ts.createSourceFile(file,fs.readFileSync(file,"utf8"),ts.ScriptTarget.Latest,true);function visit(n){if(ts.isStringLiteralLike(n)&&/\/order_prince\/state$/.test(n.text))retired.push({path:file,specifier:n.text});ts.forEachChild(n,visit);}visit(sf);}}}
for(const root of roots)walk(root);assert.equal(retired.length,0);
const report={approved:true,baseCommit:before.baseCommit,source:programs,dataPrograms,controls:before.controls,retired,summary:{wholePrograms:programs.length,mappedOutputs:programs.length*2,preservedFunctions:8,movedDataPrograms:4,exactEdits:mapping.edits.length},cohort:mapping.cohort,limits:["Observer含Root/Scholar两路线及Root/Order一路线；原全body不变，两族联合原子提交不伪称只Order改动。","新方法表/调用层/物理入口及公开reader是明确API变化；数据program映射、9全程序逆展开不能称未逆新所有代码raw同。","Authority仍持原体/生命/pending及绑定state/expected；写者不新增许可或库存镜像。","六源码根仅字面旧入口，非计算路径/历史generated/私有或仓外覆盖。"]};
fs.writeFileSync(p+"proof.json",JSON.stringify(report,null,2)+"\n");console.log(JSON.stringify(report.summary));
