/** 负责补核授予的实际旧返回来源；独立取旧 install 的完整 return 与旧外层 cast，不借用新返回，比较完整实际展开程序和两输出，不运行类型或行为。 */
const fs=require("node:fs"),crypto=require("node:crypto"),ts=require("../../../backend/node_modules/typescript");
const prefix="docs/refactor/generated/night-ability-transfer-failure-policy-",before=JSON.parse(fs.readFileSync(prefix+"before.json","utf8"));
const old=before.source[1].text,current=fs.readFileSync(before.source[1].path,"utf8"),sha=x=>crypto.createHash("sha256").update(x).digest("hex");
const parse=x=>ts.createSourceFile("whole.ts",x,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS),get=(x,n)=>parse(x).statements.find(s=>ts.isFunctionDeclaration(s)&&s.name?.text===n),stmts=n=>n.body.statements.map(s=>s.getText());
const oldGrant=get(old,"grantNightAbility"),newGrant=get(current,"grantNightAbility"),oldInstall=get(old,"installAbility"),newValidate=get(current,"validateAbilityInstall");
const oldOuterReturn=oldGrant.body.statements.at(-1),oldInnerReturn=oldInstall.body.statements.at(-1),newReturn=newGrant.body.statements.at(-1);
if(!ts.isReturnStatement(oldOuterReturn)||!ts.isAsExpression(oldOuterReturn.expression)||!ts.isReturnStatement(oldInnerReturn))throw Error("actual_return_shape");
const oldReturn="return "+oldInnerReturn.expression.getText()+" as "+oldOuterReturn.expression.type.getText()+";",newReturnText=newReturn.getText();
const header=old.slice(oldGrant.getStart(),oldGrant.body.getStart());
const oldExpanded=header+"{\n"+stmts(oldGrant).slice(0,-1).join("\n")+"\n"+stmts(oldInstall).slice(0,-1).join("\n")+"\n"+oldReturn+"\n}";
const newExpanded=header+"{\n"+stmts(newGrant).slice(0,-2).join("\n")+"\n"+stmts(newValidate).slice(0,-1).join("\n")+"\n"+newReturnText+"\n}";
function shape(x){const out=[];function walk(n){if(n.kind===ts.SyntaxKind.JSDoc)return;const cs=n.getChildren().filter(c=>c.kind!==ts.SyntaxKind.JSDoc);out.push([n.kind,cs.length?null:n.getText()]);for(const c of cs)walk(c);}walk(parse(x));return out;}
const a=shape(oldExpanded),b=shape(newExpanded),outputs=[ts.ModuleKind.ESNext,ts.ModuleKind.CommonJS].map(module=>{const emit=x=>ts.transpileModule(x,{compilerOptions:{target:ts.ScriptTarget.ES2022,module,removeComments:true}}).outputText,aa=emit(oldExpanded),bb=emit(newExpanded);return{module:ts.ModuleKind[module],rawEqual:aa===bb,beforeSHA256:sha(aa),afterSHA256:sha(bb)};});
const result={source:{path:before.source[1].path,sha256:sha(current)},actualOldInnerReturn:oldInnerReturn.getText(),actualOldOuterCast:oldOuterReturn.expression.type.getText(),oldDerivedReturn:oldReturn,currentActualReturn:newReturnText,rawReturnEqual:oldReturn===newReturnText,completeTypedNodes:a.length,completeSyntaxLeaves:a.filter(x=>x[1]!==null).length,completeTreeEqual:JSON.stringify(a)===JSON.stringify(b),wholeOutputs:outputs,scope:"原首proof的grant旧返回借用新尾，范围仅校验与前缀；本桥独立实际旧return来源补全，不重复其余checks/types/tests/heads。"};
fs.writeFileSync(prefix+"grant-return-proof.json",JSON.stringify(result,null,2)+"\n");console.log(JSON.stringify(result));if(!result.rawReturnEqual||!result.completeTreeEqual||outputs.some(x=>!x.rawEqual))process.exitCode=1;
