/** 只检查本批九源真实职责说明；输入当前源和Git文档路径，输出原诊断，不运行全门禁。 */
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { compiler } from "../../../tooling/refactor/architecture/contracts";
import { checkComments } from "../../../tooling/refactor/architecture/comment-check";
const prefix="docs/refactor/generated/sheriff-request-construction-";
const paths=["backend/src/core/domain/actions.ts", "backend/src/game/mechanisms/sheriff/election.ts", "backend/src/game/mechanisms/sheriff/speaking_order.ts", "backend/src/game/mechanisms/sheriff/badge_choice.ts", "backend/src/game/engine/phase_pipeline/day_pipeline.ts", "backend/src/game/engine/death_resolution.ts", "backend/tests/unit/mechanisms/participation-and-election.test.ts", "backend/tests/unit/engine/pk-policies.test.ts", "backend/tests/unit/mechanisms/sheriff/request-construction.test.ts"];
const files=paths.map(path=>{const text=fs.readFileSync(path,"utf8");return{path,text,sha256:createHash("sha256").update(text).digest("hex")};});
const documentationPaths=execFileSync("git",["ls-files","docs/**/*.md","README.md"],{encoding:"utf8"}).trim().split("\n").filter(Boolean);
const diagnostics=checkComments(compiler(process.cwd()),{files,documentationPaths});
const report={source:files.map(({text,...r})=>r),documentationPaths:documentationPaths.length,diagnostics,chineseHeadFailures:files.filter(x=>!/[\u4e00-\u9fff]/u.test(x.text.slice(0,x.text.indexOf("*/")+2))).map(x=>x.path)};
fs.writeFileSync(prefix+"heads.json",JSON.stringify(report,null,2)+"\n");console.log(JSON.stringify(report));if(diagnostics.length||report.chineseHeadFailures.length)process.exitCode=1;
