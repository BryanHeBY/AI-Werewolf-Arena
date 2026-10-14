/** 负责两源职责头的一次有界检查；输入实际源码和原同Git文档路径，输出原诊断，不执行业务或全仓门禁。 */
import fs from "node:fs";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import ts from "../../../backend/node_modules/typescript";
import { checkComments } from "../../../tooling/refactor/architecture/comment-check";
const prefix = "docs/refactor/generated/exchange-night-lifecycle-chinese-contracts-";
const before = JSON.parse(fs.readFileSync(prefix + "before.json", "utf8"));
const files = before.source.map((row: {path: string}) => { const text=fs.readFileSync(row.path,"utf8");return {path:row.path,text,sha256:crypto.createHash("sha256").update(text).digest("hex")};});
const documentationPaths=execFileSync("git",["ls-tree","-r","--name-only",before.baseCommit],{encoding:"utf8",maxBuffer:32*1024*1024}).split("\n").filter(p=>/^docs\/.*\.md$/.test(p)||p==="README.md");
const failures=checkComments(ts,{files,documentationPaths});
const chineseHeadFailures=files.filter((f:{text:string})=>!/[\u4e00-\u9fff]/.test(f.text.slice(0,f.text.indexOf("*/")+2))).map((f:{path:string})=>f.path);
const result={source:files.map(({text,...meta}:{text:string,path:string,sha256:string})=>meta),sameGitDocumentationPaths:documentationPaths.length,failures,chineseHeadFailures};
fs.writeFileSync(prefix+"heads.json",JSON.stringify(result,null,2)+"\n");console.log(JSON.stringify(result));if(failures.length||chineseHeadFailures.length)process.exitCode=1;
