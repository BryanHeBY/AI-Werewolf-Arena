/** 有限检查本批十八现行源码的实际职责头；只失败源复查，不运行依赖／类型／玩法。 */
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { compiler } from "../../../tooling/refactor/architecture/contracts";
import { checkComments } from "../../../tooling/refactor/architecture/comment-check";
const P = "docs/refactor/generated/native-learned-death-guns-";
const failed = process.argv.includes("--failed-only");
const plan = JSON.parse(fs.readFileSync(P + "actual-scope-plan.json", "utf8"));
const paths: string[] = failed ? [...new Set(JSON.parse(fs.readFileSync(P + "heads-first.json", "utf8")).diagnostics.map((x: {path:string}) => x.path))] as string[] : plan.source;
const files = paths.map(path => { const text = fs.readFileSync(path,"utf8"); return {path,text,sha256:createHash("sha256").update(text).digest("hex")}; });
const documentationPaths=execFileSync("git",["ls-files","docs/**/*.md","README.md"],{encoding:"utf8"}).trim().split("\n").filter(Boolean);
const diagnostics=checkComments(compiler(process.cwd()),{files,documentationPaths});
fs.writeFileSync(P + (failed ? "heads-failed.json" : "heads-first.json"),JSON.stringify({source:files.map(({text,...x})=>x),documentationPathCount:documentationPaths.length,diagnostics},null,2)+"\n");
console.log(JSON.stringify({roots:paths.length,docs:documentationPaths.length,diagnostics}));if(diagnostics.length)process.exitCode=1;
