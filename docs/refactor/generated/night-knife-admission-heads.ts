/** 仅核本批四源真实职责头与中文；输入当前源码和Git文档路径，输出原诊断，不运行全门禁。 */
import fs from "node:fs";
import {execFileSync} from "node:child_process";
import {createHash} from "node:crypto";
import {compiler} from "../../../tooling/refactor/architecture/contracts";
import {checkComments} from "../../../tooling/refactor/architecture/comment-check";
const prefix="docs/refactor/generated/night-knife-admission-";
const paths=["backend/src/game/engine/phase_pipeline/night_pipeline.ts","backend/src/game/mechanisms/roles/ghost_bride/night_stages.ts","backend/src/rulesets/night-knife-admission.ts","backend/tests/unit/rulesets/night-knife-admission.test.ts"];
const selected=process.argv.includes("--failed-only")?[...new Set((JSON.parse(fs.readFileSync(prefix+"heads-first.json","utf8")).diagnostics as Array<{path:string}>).map(x=>x.path))]:paths;
const files=selected.map(path=>{const text=fs.readFileSync(path,"utf8");return{path,text,sha256:createHash("sha256").update(text).digest("hex")};});
const documentationPaths=execFileSync("git",["ls-files","docs/**/*.md","README.md"],{encoding:"utf8"}).trim().split("\n").filter(Boolean);
const diagnostics=checkComments(compiler(process.cwd()),{files,documentationPaths});
const report={source:files.map(({text,...r})=>r),documentationPaths:documentationPaths.length,diagnostics,chineseHeadFailures:files.filter(x=>!/[\u4e00-\u9fff]/u.test(x.text.slice(0,x.text.indexOf("*/")+2))).map(x=>x.path)};
fs.writeFileSync(prefix+(process.argv.includes("--failed-only")?"heads-final.json":"heads-first.json"),JSON.stringify(report,null,2)+"\n");console.log(JSON.stringify(report));if(diagnostics.length||report.chineseHeadFailures.length)process.exitCode=1;
