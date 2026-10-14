/** 负责本批十八源职责说明的有限检查；输入当前源码与Git文档，输出原诊断，不运行全门禁或行为。 */
import fs from "node:fs";
import {execFileSync} from "node:child_process";
import {createHash} from "node:crypto";
import {compiler} from "../../../tooling/refactor/architecture/contracts";
import {checkComments} from "../../../tooling/refactor/architecture/comment-check";
const prefix="docs/refactor/generated/role-inspection-contribution-ports-",before=JSON.parse(fs.readFileSync(prefix+"before.json","utf8")),edits=JSON.parse(fs.readFileSync(prefix+"edits.json","utf8"));
const first=!process.argv.includes("--failed-only");
const paths=first?before.source.map((x:{path:string})=>x.path).concat(edits.newFacets):[...new Set((JSON.parse(fs.readFileSync(prefix+"heads-first.json","utf8")).diagnostics as Array<{path:string}>).map(x=>x.path))];
const files=paths.map((path:string)=>{const text=fs.readFileSync(path,"utf8");return{path,text,sha256:createHash("sha256").update(text).digest("hex")};});
const documentationPaths=execFileSync("git",["ls-files","docs/**/*.md","README.md"],{encoding:"utf8"}).trim().split("\n").filter(Boolean);
const diagnostics=checkComments(compiler(process.cwd()),{files,documentationPaths});
const report={source:files.map(({text,...x}:{path:string;sha256:string;text:string})=>x),documentationPaths:documentationPaths.length,diagnostics,chineseHeadFailures:files.filter((x:{text:string})=>!/[\u4e00-\u9fff]/u.test(x.text.slice(0,x.text.indexOf("*/")+2))).map((x:{path:string})=>x.path)};
fs.writeFileSync(prefix+(first?"heads-first.json":"heads-final.json"),JSON.stringify(report,null,2)+"\n");console.log(JSON.stringify(report));if(diagnostics.length||report.chineseHeadFailures.length)process.exitCode=1;
