/** 负责本批七源职责头采样；输入精确源码/真实Git文档路径，输出原诊断与中文存在性，不判行为或改变门禁。 */
import {readFileSync,writeFileSync} from "node:fs";
import {createHash} from "node:crypto";
import {compiler} from "../../../tooling/refactor/architecture/contracts";
import {checkComments} from "../../../tooling/refactor/architecture/comment-check";
const before=JSON.parse(readFileSync("docs/refactor/generated/checkpoint-format-owners-before.json","utf8"));
const files=before.source.map(({path}:{path:string})=>{const text=readFileSync(path,"utf8");return{path,text,sha256:createHash("sha256").update(text).digest("hex")};});
const documentationPaths=JSON.parse(readFileSync("docs/refactor/generated/checkpoint-format-owners-documentation-paths.json","utf8"));
const violations=checkComments(compiler(process.cwd()),{files,documentationPaths});
const report={files:files.map(({path,sha256})=>({path,sha256})),documentationPaths:documentationPaths.length,violations};
writeFileSync("docs/refactor/generated/checkpoint-format-owners-heads.json",JSON.stringify(report,null,2)+"\n");
console.log(JSON.stringify({files:files.length,documentationPaths:documentationPaths.length,violations:violations.length}));if(violations.length)process.exitCode=1;
