/** 负责本批十四现行源的有限职责头检查；输入真实当前源码与同次Git文档，输出原诊断，不运行全门禁或行为。 */
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { compiler } from "../../../tooling/refactor/architecture/contracts";
import { checkComments } from "../../../tooling/refactor/architecture/comment-check";
const prefix="docs/refactor/generated/evil-knight-state-slot-";
const paths=JSON.parse(fs.readFileSync(prefix+"types-config.json","utf8")).files.map((x:string)=>x.slice(9));
const files=paths.map((path:string)=>{const text=fs.readFileSync(path,"utf8");return {path,text,sha256:createHash("sha256").update(text).digest("hex")};});
const documentationPaths=execFileSync("git",["ls-files","docs/**/*.md","README.md"],{encoding:"utf8"}).trim().split("\n").filter(Boolean);
const diagnostics=checkComments(compiler(process.cwd()),{files,documentationPaths});
const report={source:files.map(({text,...rest}:{path:string;sha256:string;text:string})=>rest),documentationPaths:documentationPaths.length,diagnostics,chineseHeadFailures:files.filter((x:{text:string})=>!/[\u4e00-\u9fff]/u.test(x.text.slice(0,x.text.indexOf("*/")+2))).map((x:{path:string})=>x.path)};
fs.writeFileSync(prefix+"heads.json",JSON.stringify(report,null,2)+"\n");console.log(JSON.stringify({sources:files.length,documentationPaths:documentationPaths.length,diagnostics,chineseHeadFailures:report.chineseHeadFailures}));if(diagnostics.length||report.chineseHeadFailures.length)process.exitCode=1;
