/** 输入三个实际源码和当前 Git 文档，负责调用原职责头检查并输出真实有限诊断；不运行其它门禁或玩法。 */
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { compiler } from "../../../tooling/refactor/architecture/contracts";
import { checkComments } from "../../../tooling/refactor/architecture/comment-check";
const prefix="docs/refactor/generated/red-moon-exile-contribution-";
const paths: string[]=JSON.parse(fs.readFileSync(prefix+"paths.json","utf8"));
const files=paths.map(path=>({path,text:fs.readFileSync(path,"utf8")}));
const documentationPaths=execFileSync("git",["ls-files","docs/**/*.md","README.md"],{encoding:"utf8"}).trim().split("\n").filter(Boolean);
const diagnostics=checkComments(compiler(process.cwd()),{files,documentationPaths});
const chineseHeadFailures=files.filter(r=>!/[\u4e00-\u9fff]/u.test(r.text.slice(0,r.text.indexOf("*/")+2))).map(r=>r.path);
const report={source:files.map(r=>({path:r.path,sha256:createHash("sha256").update(r.text).digest("hex")})),documentationPaths:documentationPaths.length,diagnostics,chineseHeadFailures};
fs.writeFileSync(prefix+"heads.json",JSON.stringify(report,null,2)+"\n");console.log(JSON.stringify(report));if(diagnostics.length||chineseHeadFailures.length)process.exitCode=1;
