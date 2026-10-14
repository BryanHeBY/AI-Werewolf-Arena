/** 中文回调说明只收窄所有权表述；核完整非注释词项和原两输出，输入是真实修正前文本与末源。 */
import fs from "node:fs";
import { createHash } from "node:crypto";
import { compiler } from "../../../tooling/refactor/architecture/contracts";
const prefix="docs/refactor/generated/daytime-request-port-", ts=compiler(process.cwd()), before=JSON.parse(fs.readFileSync(prefix+"comment-before.json","utf8")), after=fs.readFileSync(before.path,"utf8");
if(before.text.replace(before.before,before.after)!==after)throw new Error("comment_exact_delta");
const tokens=(text:string)=>{const scanner=ts.createScanner(ts.ScriptTarget.Latest,true,ts.LanguageVariant.Standard,text),items=[];let kind;while((kind=scanner.scan())!==ts.SyntaxKind.EndOfFileToken)items.push([kind,scanner.getTokenText()]);return items;};
const one=tokens(before.text),two=tokens(after);if(JSON.stringify(one)!==JSON.stringify(two))throw new Error("comment_program_tokens");
const h=(text:string)=>createHash("sha256").update(text).digest("hex");const outputs=[];for(const module of [ts.ModuleKind.ESNext,ts.ModuleKind.CommonJS]){const emit=(text:string)=>ts.transpileModule(text,{fileName:before.path,compilerOptions:{target:ts.ScriptTarget.ES2022,module,removeComments:true}}).outputText;if(emit(before.text)!==emit(after))throw new Error("comment_program_output");outputs.push(h(emit(after)));}
fs.writeFileSync(prefix+"comment-bridge.json",JSON.stringify({approved:true,path:before.path,beforeSHA256:h(before.text),sha256:h(after),tokenCount:one.length,wholeNonCommentSame:true,wholeOutputs:outputs,onlyComment:true},null,2)+"\n");console.log(JSON.stringify({tokens:one.length,outputs:outputs.length}));
