/** 只承接 EOF 空行收尾与旧 API 编译负例的真实阶段；不重先前行为、类型或完整程序检查。 */
const fs=require("node:fs"),ts=require("../../../backend/node_modules/typescript"),crypto=require("node:crypto");
const prefix="docs/refactor/generated/night-ability-inventory-owner-",read=n=>JSON.parse(fs.readFileSync(prefix+n+".json","utf8")),hash=x=>crypto.createHash("sha256").update(x).digest("hex");
const parse=text=>ts.createSourceFile("input.ts",text,ts.ScriptTarget.Latest,true),printer=ts.createPrinter({removeComments:true});
const emit=(text,module)=>ts.transpileModule(text,{compilerOptions:{target:ts.ScriptTarget.ES2022,module,removeComments:true}}).outputText;
const whitespace=read("final-whitespace-before"),after=fs.readFileSync(whitespace.path,"utf8"),step=whitespace.replacement;
const exact=whitespace.text.split(step.before).length-1===1&&whitespace.text.replace(step.before,step.after)===after;
const outputs=[ts.ModuleKind.ESNext,ts.ModuleKind.CommonJS].map(module=>({module:ts.ModuleKind[module],same:emit(whitespace.text,module)===emit(after,module)}));
const apiBefore=read("lifecycle-api-before"),apiAfter=fs.readFileSync(apiBefore.path,"utf8"),apiEdits=read("lifecycle-api-edits");let applied=apiBefore.text;for(const e of apiEdits){if(applied.split(e.before).length-1!==1)throw Error("API edit mismatch");applied=applied.replace(e.before,e.after);}
const unitA=parse(apiBefore.text),unitB=parse(apiAfter),tests=s=>s.statements.filter(n=>ts.isExpressionStatement(n)&&ts.isCallExpression(n.expression)&&n.expression.expression.getText(s)==="test").map(n=>printer.printNode(ts.EmitHint.Unspecified,n,s));
const sameTests=JSON.stringify(tests(unitA))===JSON.stringify(tests(unitB));
const report={whitespace:{path:whitespace.path,beforeSHA256:whitespace.sha256,afterSHA256:hash(after),exactSingleEOFFix:exact,completePrintedTypedProgramSame:printer.printFile(parse(whitespace.text))===printer.printFile(parse(after)),outputs},lifecycleAPI:{path:apiBefore.path,beforeSHA256:hash(apiBefore.text),afterSHA256:hash(apiAfter),exactFourEdits:applied===apiAfter,completeRuntimeTestStatementsSame:sameTests,limit:"两不可达编译负例改读退休准备叶并新增同叶namespace；头说明同步。此输入与原成功用例采样不同，不称整JS字节同或重测运行。"}};
fs.writeFileSync(prefix+"final-delta.json",JSON.stringify(report,null,2)+"\n");console.log(JSON.stringify(report));if(!exact||!outputs.every(x=>x.same)||!report.whitespace.completePrintedTypedProgramSame||!report.lifecycleAPI.exactFourEdits||!sameTests)process.exitCode=1;
