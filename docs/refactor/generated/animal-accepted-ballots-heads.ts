/** 只检查本批十个现行源当前职责头和中文说明；输入当前源及Git文档路径，输出原诊断，不运行全门禁。 */
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { compiler } from "../../../tooling/refactor/architecture/contracts";
import { checkComments } from "../../../tooling/refactor/architecture/comment-check";
const prefix="docs/refactor/generated/animal-accepted-ballots-";
const paths=["backend/src/game/mechanisms/roles/animal_dream/authority.ts", "backend/src/game/engine/phase_pipeline/voting_pipeline.ts", "backend/tests/unit/features/animal-dream/request-envelope.test.ts", "backend/tests/unit/features/animal-dream/cat-authority.test.ts", "backend/tests/unit/features/animal-dream/puffer-authority.test.ts", "backend/tests/unit/mechanisms/night-choice/request-construction.test.ts", "backend/src/game/mechanisms/roles/animal_dream/ballot-ledger.ts", "backend/src/game/mechanisms/roles/animal_dream/accepted-ballots.ts", "backend/src/game/mechanisms/roles/animal_dream/ballot-ports.ts", "backend/tests/unit/features/animal-dream/accepted-ballots.test.ts"];
const files=paths.map(path=>{const text=fs.readFileSync(path,"utf8");return{path,text,sha256:createHash("sha256").update(text).digest("hex")};});
const documentationPaths=execFileSync("git",["ls-files","docs/**/*.md","README.md"],{encoding:"utf8"}).trim().split("\n").filter(Boolean);
const diagnostics=checkComments(compiler(process.cwd()),{files,documentationPaths});
const report={source:files.map(({text,...r})=>r),documentationPaths:documentationPaths.length,diagnostics,chineseHeadFailures:files.filter(x=>!/[\u4e00-\u9fff]/u.test(x.text.slice(0,x.text.indexOf("*/")+2))).map(x=>x.path)};
fs.writeFileSync(prefix+"heads.json",JSON.stringify(report,null,2)+"\n");console.log(JSON.stringify(report));if(diagnostics.length||report.chineseHeadFailures.length)process.exitCode=1;
