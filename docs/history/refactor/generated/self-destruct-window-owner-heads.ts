/**
 * 负责本批八个当前源码职责头的有限形状检查，输入是实际文本与现行 Git 文档路径。
 * 输出为原 checker 的精确诊断；中文语义另经源码审查，不运行全结构门禁或游戏。
 */
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { compiler } from "../../../tooling/refactor/architecture/contracts";
import { checkComments } from "../../../tooling/refactor/architecture/comment-check";
const prefix = "docs/refactor/generated/self-destruct-window-owner-";
const paths = JSON.parse(fs.readFileSync(prefix+"types-config.json", "utf8")).files.map((p: string) => p.slice(9));
const files = paths.map((path: string) => { const text=fs.readFileSync(path,"utf8"); return {path,text,sha256:createHash("sha256").update(text).digest("hex")}; });
const documentationPaths=execFileSync("git",["ls-files","docs/**/*.md","README.md"],{encoding:"utf8"}).trim().split("\n").filter(Boolean);
const diagnostics=checkComments(compiler(process.cwd()),{files,documentationPaths});
fs.writeFileSync(prefix+"heads.json",JSON.stringify({source:files.map(({text,...file})=>file),documentationPathCount:documentationPaths.length,diagnostics},null,2)+"\n");
console.log(JSON.stringify({files:files.length,diagnostics})); if(diagnostics.length) process.exitCode=1;
