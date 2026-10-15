/** 只检查本批十六现行源当前职责头和中文说明；输入当前源及Git文档路径，输出原诊断，不运行全门禁。 */
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { compiler } from "../../../tooling/refactor/architecture/contracts";
import { checkComments } from "../../../tooling/refactor/architecture/comment-check";
const prefix="docs/refactor/generated/eclipse-state-slot-";
const paths=["backend/src/game/mechanisms/roles/radiant_eclipse/profile.ts", "backend/src/game/mechanisms/roles/radiant_eclipse/night_frame.ts", "backend/src/game/mechanisms/roles/radiant_eclipse/ports.ts", "backend/tests/unit/features/radiant-eclipse/native-binding.test.ts", "backend/tests/unit/features/radiant-eclipse/await.test.ts", "backend/tests/unit/features/radiant-eclipse/paid-effect.test.ts", "backend/tests/unit/features/radiant-eclipse/lifecycle.test.ts", "backend/tests/unit/features/radiant-eclipse/state.test.ts", "backend/tests/unit/features/radiant-eclipse/descriptors.test.ts", "backend/tests/unit/features/radiant-eclipse/membership.test.ts", "backend/tests/unit/features/radiant-eclipse/radiant-eclipse-effect-immutability.test.ts", "backend/tests/scenarios/features/radiant-eclipse/pending-dream-reentry.test.ts", "backend/tests/scenarios/features/radiant-eclipse/paid-dream-effects.test.ts", "backend/tests/unit/contracts/eclipse-wall-data-types.types.ts", "backend/src/game/mechanisms/roles/radiant_eclipse/eclipse-state-slot.ts", "backend/tests/unit/features/radiant-eclipse/eclipse-state-slot.test.ts"];
const files=paths.map(path=>{const text=fs.readFileSync(path,"utf8");return{path,text,sha256:createHash("sha256").update(text).digest("hex")};});
const documentationPaths=execFileSync("git",["ls-files","docs/**/*.md","README.md"],{encoding:"utf8"}).trim().split("\n").filter(Boolean);
const diagnostics=checkComments(compiler(process.cwd()),{files,documentationPaths});
const report={source:files.map(({text,...r})=>r),documentationPaths:documentationPaths.length,diagnostics,chineseHeadFailures:files.filter(x=>!/[\u4e00-\u9fff]/u.test(x.text.slice(0,x.text.indexOf("*/")+2))).map(x=>x.path)};
fs.writeFileSync(prefix+"heads.json",JSON.stringify(report,null,2)+"\n");console.log(JSON.stringify(report));if(diagnostics.length||report.chineseHeadFailures.length)process.exitCode=1;
