/**
 * 负责单一白天中断声明的精确迁移对照与职责头检查；输入为真实 before、编辑、现行源码和 Git 文档路径。
 * 输出为全文 forward/逆、完整擦除后输出和原注释诊断；明确类型接受面扩大，不生成游戏预期或执行测试。
 */
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { compiler } from "../../../tooling/refactor/architecture/contracts";
import { checkComments } from "../../../tooling/refactor/architecture/comment-check";
const prefix="docs/refactor/generated/daytime-request-port-", ts=compiler(process.cwd());
const before=JSON.parse(fs.readFileSync(prefix+"before.json","utf8")), row=before.source[0], edits=JSON.parse(fs.readFileSync(prefix+"edits.json","utf8"));
const fail=(condition: boolean, message: string)=>{if(!condition) throw new Error(message);};
let expected=row.text; for(const edit of edits) {fail(expected.split(edit.before).length-1===edit.count,"forward_count"); expected=expected.replaceAll(edit.before,edit.after);}
const actual=fs.readFileSync(row.path,"utf8"); fail(actual===expected,"whole_forward"); let inverse=actual; for(const edit of [...edits].reverse()) inverse=inverse.replaceAll(edit.after,edit.before); fail(inverse===row.text,"whole_inverse");
const sha=(text: string)=>createHash("sha256").update(text).digest("hex"); const outputs=[];
for(const module of [ts.ModuleKind.ESNext,ts.ModuleKind.CommonJS]) {const emit=(text:string)=>ts.transpileModule(text,{fileName:row.path,compilerOptions:{target:ts.ScriptTarget.ES2022,module,removeComments:true}}).outputText; fail(emit(actual)===emit(row.text),"whole_raw_output"); outputs.push({module:ts.ModuleKind[module],wholeSame:true,sha256:sha(emit(actual))});}
const files=[{path:row.path,text:actual,sha256:sha(actual)}], documentationPaths=execFileSync("git",["ls-files","docs/**/*.md","README.md"],{encoding:"utf8"}).trim().split("\n").filter(Boolean); const diagnostics=checkComments(ts,{files,documentationPaths});
const report={approved:diagnostics.length===0,source:files.map(({text,...file})=>file),wholeForward:true,wholeInverse:true,wholeOutputs:outputs,diagnostics,documentationPathCount:documentationPaths.length,typeChange:"三个接口参数由原名义工厂变现有create-only结构端口，静态接受面扩大；不是完整类型树不变。"};
fs.writeFileSync(prefix+"proof.json",JSON.stringify(report,null,2)+"\n");console.log(JSON.stringify({outputs:outputs.length,diagnostics}));if(diagnostics.length)process.exitCode=1;
