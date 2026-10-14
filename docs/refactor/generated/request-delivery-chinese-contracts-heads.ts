/** 负责核对本批两源的中文职责头形状；输入为当前精确源码，输出为原检查器诊断，不验证业务或改变门禁。 */
import {readFileSync,writeFileSync} from "node:fs";
import {createHash} from "node:crypto";
import {compiler} from "../../../tooling/refactor/architecture/contracts";
import {checkComments} from "../../../tooling/refactor/architecture/comment-check";
const files=["backend/src/core/domain/request_delivery.ts"].map(path=>{const text=readFileSync(path,"utf8");return {path,text,sha256:createHash("sha256").update(text).digest("hex")};});
const violations=checkComments(compiler(process.cwd()),{files,documentationPaths:[]});
writeFileSync("docs/refactor/generated/request-delivery-chinese-contracts-heads.json",JSON.stringify({files:files.map(({path,sha256})=>({path,sha256})),violations},null,2)+"\n");
console.log(JSON.stringify({files:files.length,violations:violations.length}));
if(violations.length)process.exitCode=1;
