/** 负责本批五现行源的有限职责头检查；输入当前源码与同次 Git 文档，输出原诊断，不运行全门禁或行为。 */
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { compiler } from "../../../tooling/refactor/architecture/contracts";
import { checkComments } from "../../../tooling/refactor/architecture/comment-check";
const prefix="docs/refactor/generated/beauty-exile-victory-";
const paths: string[]=JSON.parse(fs.readFileSync(prefix+"paths.json","utf8")).source;
const files=paths.map(path=>{const text=fs.readFileSync(path,"utf8");return {path,text,sha256:createHash("sha256").update(text).digest("hex")};});
const documentationCommit=execFileSync("git",["rev-parse","HEAD"],{encoding:"utf8"}).trim();
const documentationPaths=execFileSync("git",["ls-files","docs/**/*.md","README.md"],{encoding:"utf8"}).trim().split("\n").filter(Boolean);
const diagnostics=checkComments(compiler(process.cwd()),{files,documentationPaths});
const chineseHeadFailures=files.filter(x=>!/[\u4e00-\u9fff]/u.test(x.text.slice(0,x.text.indexOf("*/")+2))).map(x=>x.path);
fs.writeFileSync(prefix+"heads.json",JSON.stringify({source:files.map(({text,...rest})=>rest),documentationCommit,documentationPaths:documentationPaths.length,diagnostics,chineseHeadFailures},null,2)+"\n");
console.log(JSON.stringify({sources:files.length,documentationCommit,documentationPaths:documentationPaths.length,diagnostics,chineseHeadFailures}));
if(diagnostics.length||chineseHeadFailures.length)process.exitCode=1;
