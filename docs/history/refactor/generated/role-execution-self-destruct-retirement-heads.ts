/** 负责本批五源码有限职责头形状检查；输入当前源码与真实Git文档路径，输出原诊断，不运行阶段、类型、模型或全门禁。 */
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { compiler } from "../../../tooling/refactor/architecture/contracts";
import { checkComments } from "../../../tooling/refactor/architecture/comment-check";
const prefix = "docs/refactor/generated/role-execution-self-destruct-retirement-";
const paths: string[] = JSON.parse(fs.readFileSync(prefix + "paths.json", "utf8"));
const files = paths.map(path => { const text=fs.readFileSync(path,"utf8");return {path,text,sha256:createHash("sha256").update(text).digest("hex")}; });
const docs=execFileSync("git",["ls-files","docs/**/*.md","README.md"],{encoding:"utf8"}).trim().split("\n").filter(Boolean);
const diagnostics=checkComments(compiler(process.cwd()),{files,documentationPaths:docs});
const chineseHeadFailures=files.filter(x=>!/[\u4e00-\u9fff]/u.test(x.text.slice(0,x.text.indexOf("*/")+2))).map(x=>x.path);
const result={source:files.map(({text,...x})=>x),documentationPaths:docs.length,diagnostics,chineseHeadFailures};
fs.writeFileSync(prefix+"heads.json",JSON.stringify(result,null,2)+"\n");console.log(JSON.stringify(result));
if(diagnostics.length||chineseHeadFailures.length)process.exitCode=1;
