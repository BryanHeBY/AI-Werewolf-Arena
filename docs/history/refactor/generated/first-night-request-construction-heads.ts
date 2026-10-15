/**
 * 负责本批十三个实际源码职责头的有限检查；输入当前完整文本与 Git 文档路径，输出原 checker 诊断。
 * 只核头部结构，不运行对局／类型／全门禁，也不代替真实中文契约的人工审读。
 */
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { compiler } from "../../../tooling/refactor/architecture/contracts";
import { checkComments } from "../../../tooling/refactor/architecture/comment-check";
const prefix = "docs/refactor/generated/first-night-request-construction-";
const before = JSON.parse(fs.readFileSync(prefix + "before.json", "utf8"));
const files = before.source.map(({path}: {path:string}) => {const text=fs.readFileSync(path,"utf8");return {path,text,sha256:createHash("sha256").update(text).digest("hex")};});
const documentationPaths=execFileSync("git",["ls-files","docs/**/*.md","README.md"],{encoding:"utf8"}).trim().split("\n").filter(Boolean);
const diagnostics=checkComments(compiler(process.cwd()),{files,documentationPaths});
fs.writeFileSync(prefix+"heads.json",JSON.stringify({source:files.map(({text,...f}: {text:string,path:string,sha256:string})=>f),documentationPathCount:documentationPaths.length,diagnostics},null,2)+"\n");
console.log(JSON.stringify({sources:files.length,documentationPaths:documentationPaths.length,diagnostics}));
if(diagnostics.length)process.exitCode=1;
