/** 只负责本批三根的有效中文职责头形状检查；输入当前三源码和当前Git公开文档路径，输出原诊断，不运行全门禁或任何业务。 */
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { compiler } from "../../../tooling/refactor/architecture/contracts";
import { checkComments } from "../../../tooling/refactor/architecture/comment-check";
const prefix="docs/refactor/generated/ordinary-night-death-preparation-";
const ready=JSON.parse(fs.readFileSync(prefix+"source-ready.json","utf8"));
const files=ready.source.map((entry:{path:string;sha256:string})=>{const text=fs.readFileSync(entry.path,"utf8"),sha256=createHash("sha256").update(text).digest("hex");if(sha256!==entry.sha256)throw new Error("source_ready_drift:"+entry.path);return{path:entry.path,text,sha256};});
const documentationPaths=execFileSync("git",["ls-files","docs/**/*.md","README.md"],{encoding:"utf8"}).trim().split("\n").filter(Boolean);
const diagnostics=checkComments(compiler(process.cwd()),{files,documentationPaths});
const chineseHeadFailures=files.filter((entry:{text:string})=>!/[\u4e00-\u9fff]/u.test(entry.text.slice(0,entry.text.indexOf("*/")+2))).map((entry:{path:string})=>entry.path);
const report={source:files.map(({text,...entry}:{text:string;path:string;sha256:string})=>entry),sourceReadySHA256:createHash("sha256").update(fs.readFileSync(prefix+"source-ready.json")).digest("hex"),documentationPaths:documentationPaths.length,diagnostics,chineseHeadFailures};
fs.writeFileSync(prefix+"heads.json",JSON.stringify(report,null,2)+"\n");console.log(JSON.stringify({sources:files.length,documentationPaths:documentationPaths.length,diagnostics:diagnostics.length,chineseHeadFailures}));if(diagnostics.length||chineseHeadFailures.length)process.exitCode=1;
