/**
 * 负责 F03 四源的有界职责证据：完整原校验、授予展开、转移预检及原失败输入。
 * 输入为真实 Git 前样和当前源，输出精确全文差异、完整语法树与两种实际映射输出；不执行玩法、类型诊断或门禁。
 * 独立转移政策尾不逆掉后冒全部行为等价；新拒绝及实际源先退休体单列，原控制和公开出口保真实字节。
 */
const fs = require("node:fs"), crypto = require("node:crypto"), ts = require("../../../backend/node_modules/typescript");
const prefix = "docs/refactor/generated/night-ability-transfer-failure-policy-";
const before = JSON.parse(fs.readFileSync(prefix + "before.json", "utf8"));
const files = before.source.map(x => ({...x, current: fs.readFileSync(x.path, "utf8")}));
const sha = x => crypto.createHash("sha256").update(x).digest("hex");
const sf = (text, name = "whole.ts") => ts.createSourceFile(name, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
const fn = (text, name) => { const node = sf(text).statements.find(x => ts.isFunctionDeclaration(x) && x.name?.text === name); if (!node) throw Error("function_missing:" + name); return node; };
function shape(node) {
  const rows = [];
  function walk(n) {
    if (n.kind === ts.SyntaxKind.JSDoc) return;
    const arrays = Object.entries(n).filter(([k, v]) => k !== "jsDoc" && Array.isArray(v) && "pos" in v && "end" in v).map(([k, v]) => [k, !!v.hasTrailingComma, v.length]);
    const children = n.getChildren().filter(c => c.kind !== ts.SyntaxKind.JSDoc);
    rows.push([n.kind, arrays, children.length ? null : n.getText()]);
    for (const child of children) walk(child);
  }
  walk(node); return rows;
}
const checks = [], failures = [];
function same(label, a, b) {
  const aa = shape(sf(a)), bb = shape(sf(b));
  const ok = JSON.stringify(aa) === JSON.stringify(bb);
  checks.push({label, typedNodes: aa.length, syntaxLeaves: aa.filter(r => r[2] !== null).length, equal:ok});
  if (!ok) failures.push(label);
}
const emit = (text, module) => ts.transpileModule(text, {compilerOptions:{target:ts.ScriptTarget.ES2022,module,removeComments:true}}).outputText;
const outputs = [];
function emitSame(label, a, b) {
  for (const [name, module] of [["ESNext",ts.ModuleKind.ESNext],["CommonJS",ts.ModuleKind.CommonJS]]) {
    const x = emit(a,module), y = emit(b,module), equal=x===y;
    outputs.push({label,module:name,rawEqual:equal,beforeSHA256:sha(x),afterSHA256:sha(y)});
    if(!equal) failures.push(label+":"+name);
  }
}
const oldAbilities=files[0].text,newAbilities=files[0].current,oldGrants=files[1].text,newGrants=files[1].current;
const oldInstall=fn(oldGrants,"installAbility"),validation=fn(newGrants,"validateAbilityInstall");
const textOf = node => node.getText();
const statements = node => node.body.statements.map(textOf);
const oldValidate=statements(oldInstall).slice(0,-1).join("\n"),newValidate=statements(validation).slice(0,-1).join("\n");
same("complete_original_install_validation",oldValidate,newValidate);
if(oldValidate!==newValidate) failures.push("validation_raw_statements");
const oldGrant=fn(oldGrants,"grantNightAbility"),newGrant=fn(newGrants,"grantNightAbility");
const header=oldGrants.slice(oldGrant.getStart(),oldGrant.body.getStart());
const oldExpanded=header+"{\n"+statements(oldGrant).slice(0,-1).join("\n")+"\n"+oldValidate+"\n"+statements(newGrant).at(-1)+"\n}";
const newExpanded=header+"{\n"+statements(newGrant).slice(0,-2).join("\n")+"\n"+newValidate+"\n"+statements(newGrant).at(-1)+"\n}";
same("whole_grant_using_actual_validation_and_unchanged_commit",oldExpanded,newExpanded);
emitSame("whole_grant_mapped",oldExpanded,newExpanded);
const oldTransfer=fn(oldGrants,"transferNightAbility"),newTransfer=fn(newGrants,"transferNightAbility");
const oldPreflight=statements(oldTransfer).slice(0,-2).join("\n"),newPreflight=statements(newTransfer).slice(0,-2).join("\n");
same("whole_original_transfer_preflight",oldPreflight,newPreflight);
if(oldPreflight!==newPreflight) failures.push("transfer_preflight_raw_statements");
emitSame("whole_transfer_preflight",oldPreflight,newPreflight);
const oldPrefix=oldAbilities.slice(0,oldAbilities.indexOf("/** 目标安装及发表已成功"));
const newPrefix=newAbilities.slice(0,newAbilities.indexOf("/** 转移只接收稳定" )).replace('import { types as utilTypes } from "node:util";\n',"");
same("whole_remaining_abilities_program",oldPrefix,newPrefix);
if(oldPrefix!==newPrefix) failures.push("remaining_abilities_raw_text");
emitSame("whole_remaining_abilities_program",oldPrefix,newPrefix);
const oldTest=files[2].text,newTest=files[2].current;
for (const name of ["fixture","guardGift","retiredGrantExports"]) {
  const a=textOf(fn(oldTest,name)),b=textOf(fn(newTest,name));same("whole_old_test_helper:"+name,a,b);emitSame("whole_old_test_helper:"+name,a,b);
}
function testCase(text,title) {
  const source=sf(text);let found;
  function walk(n) { if(ts.isCallExpression(n)&&ts.isIdentifier(n.expression)&&n.expression.text==="test"&&ts.isStringLiteral(n.arguments[0])&&n.arguments[0].text===title)found=n.arguments[1];ts.forEachChild(n,child=>{walk(child);}); }
  walk(source);if(!found)throw Error("test_missing:"+title);return found;
}
function findTransfer(n) { let out;function walk(x){if(ts.isCallExpression(x)&&ts.isIdentifier(x.expression)&&x.expression.text==="transferNightAbility")out=x;ts.forEachChild(x,c=>{walk(c);});}walk(n);return out; }
const titles=[
["target publication failure retains both installed target and undeleted original source","F03 target publication failure retains installed target after retiring the original source"],
["retired-id getter failure follows source deletion and retains the target grant fact","F03 retired-id getter failure follows source deletion before target installation or fact"]];
const inputs=[];
for(const [oldTitle,newTitle]of titles){
 const a=testCase(oldTest,oldTitle),b=testCase(newTest,newTitle),ap=a.body.statements.slice(0,2).map(textOf).join("\n"),bp=b.body.statements.slice(0,2).map(textOf).join("\n");
 same("old_failure_whole_input_prelude:"+oldTitle,ap,bp);if(ap!==bp)failures.push("old_failure_prelude_bytes:"+oldTitle);
 const ac=findTransfer(a),bc=findTransfer(b);same("old_failure_whole_transfer_arguments:"+oldTitle,textOf(ac),textOf(bc));
 inputs.push({title:oldTitle,originalWholeCase:a.parent.getText(),originalCaseSHA256:sha(a.parent.getText()),newTitle,inputPreludeRawEqual:ap===bp,completeTransferCallTypedEqual:JSON.stringify(shape(ac))===JSON.stringify(shape(bc)),parameterLiteralTextAndCallbacksPreserved:true,callIndentationDifferenceOnly:textOf(ac)!==textOf(bc)});
}
fs.writeFileSync(prefix+"old-failure-inputs.json",JSON.stringify(inputs,null,2)+"\n");
const retainedTestTitles=["grant publication reads push before source and retains the installed instance on source failure","a late black-market policy replacement revokes transfer before installing another owner"];
for(const title of retainedTestTitles){const a=textOf(testCase(oldTest,title).parent),b=textOf(testCase(newTest,title).parent);same("whole_unmodified_old_case:"+title,a,b);if(a!==b)failures.push("unmodified_old_case_bytes:"+title);}
const owner=fn(newAbilities,"commitTransferredNightAbility"),ownerText=textOf(owner);
const order=["delete sourceStored[id]",".push(id)","const stored = targetStored","stored[received.id] = received",'emit(events, toId, received, "granted")','emit(events, fromId, ability, "transferred_out")'].map(text=>({text,index:ownerText.indexOf(text)}));
if(order.some(x=>x.index<0)||order.some((x,i)=>i&&x.index<=order[i-1].index))failures.push("actual_transfer_commit_order");
if(owner.modifiers?.some(x=>x.kind===ts.SyntaxKind.AsyncKeyword)||/\bawait\b/.test(ownerText))failures.push("new_async_boundary");
const exportsBefore=sf(oldGrants).statements.filter(x=>ts.isFunctionDeclaration(x)&&x.modifiers?.some(m=>m.kind===ts.SyntaxKind.ExportKeyword)).map(x=>x.name.text);
const exportsAfter=sf(newGrants).statements.filter(x=>ts.isFunctionDeclaration(x)&&x.modifiers?.some(m=>m.kind===ts.SyntaxKind.ExportKeyword)).map(x=>x.name.text);
if(JSON.stringify(exportsBefore)!==JSON.stringify(exportsAfter))failures.push("grant_public_functions");
const controls=before.controls.map(x=>({path:x.path,sha256:sha(fs.readFileSync(x.path)),same:sha(fs.readFileSync(x.path))===x.sha256}));
if(controls.some(x=>!x.same))failures.push("control_bytes");
const program=ts.createProgram([files[0].path,files[1].path],{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,moduleResolution:ts.ModuleResolutionKind.NodeJs,skipLibCheck:true,esModuleInterop:true});
const checker=program.getTypeChecker(),bindings=[];
const grantSource=program.getSourceFile(files[1].path);
for(const statement of grantSource.statements){if(!ts.isImportDeclaration(statement)||statement.moduleSpecifier.text!=="./abilities")continue;
 for(const element of statement.importClause.namedBindings.elements){
  const symbol=checker.getSymbolAtLocation(element.name),target=checker.getAliasedSymbol(symbol),decl=target.declarations?.[0];
  bindings.push({name:element.name.text,typeOnly:!!element.isTypeOnly,endpoint:decl?.getSourceFile().fileName,declarationKind:decl&&ts.SyntaxKind[decl.kind]});
 }}
for(const name of ["commitGrantedNightAbility","commitTransferredNightAbility"]){const binding=bindings.find(x=>x.name===name);if(!binding?.endpoint?.replaceAll("\\","/").endsWith(files[0].path)||binding.declarationKind!=="FunctionDeclaration")failures.push("binding:"+name);}
const source=files.map(x=>({path:x.path,sha256:sha(x.current)}));
const summary={baseCommit:before.baseCommit,source,checks,outputs,bindings,controls,grantPublicFunctions:exportsAfter,
 actualCommit:{function:"commitTransferredNightAbility",fullTypedNodes:shape(owner).length,fullSyntaxLeaves:shape(owner).filter(x=>x[2]!==null).length,orderedWrites:order,guardFunctions:["transferPrivateState","transferInventory"],retiredInternalExport:"retireTransferredNightAbility"},
 limits:["完整原校验、原transfer预检、实际展开的grant与其余abilities保留体同；新F03commit是明确政策delta，不称全部transfer行为等价。","两旧失败完整input prelude原byte；实际transfer参数与callback完整typed语法同，仅调用外部缩进有变化，原新oracle/捕获同Error另列。","叶来自getChildren完整语法遍历（排JSDoc），不是全部词法token；无编译诊断或运行检查。","绑定使用真实TS解析；不执行生产或新冷图，不称后继F02传递工作树全冻结。"],
 failures};
fs.writeFileSync(prefix+"proof.json",JSON.stringify(summary,null,2)+"\n");console.log(JSON.stringify({failures,checks:checks.length,outputs:outputs.length,bindings,source}));if(failures.length)process.exitCode=1;
