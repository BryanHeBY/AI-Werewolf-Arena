/** 只复查首轮真实失败的赤月 hook 职责头；输入最终单源与 Git 文档，输出实际诊断，不重其它绿色头。 */
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { compiler } from "../../../tooling/refactor/architecture/contracts";
import { checkComments } from "../../../tooling/refactor/architecture/comment-check";
const prefix="docs/refactor/generated/red-moon-exile-contribution-";
const path="backend/src/game/mechanisms/roles/red_moon_apostle/voted_out_hook.ts",text=fs.readFileSync(path,"utf8");
const documentationPaths=execFileSync("git",["ls-files","docs/**/*.md","README.md"],{encoding:"utf8"}).trim().split("\n").filter(Boolean);
const diagnostics=checkComments(compiler(process.cwd()),{files:[{path,text}],documentationPaths});
const chineseHeadFailures=/[\u4e00-\u9fff]/u.test(text.slice(0,text.indexOf("*/")+2))?[]:[path];
const report={source:[{path,sha256:createHash("sha256").update(text).digest("hex")}],documentationPaths:documentationPaths.length,diagnostics,chineseHeadFailures};
fs.writeFileSync(prefix+"heads-failed.json",JSON.stringify(report,null,2)+"\n");console.log(JSON.stringify(report));if(diagnostics.length||chineseHeadFailures.length)process.exitCode=1;
