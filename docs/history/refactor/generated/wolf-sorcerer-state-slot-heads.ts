/**
 * 负责狼术师十一个现行源码职责头的有限形状检查；输入为真实当前源码与 Git 文档路径，输出原 checkComments 诊断。
 * 首次只跑十一源，修正后只重失败源；不运行完整架构门禁、测试或类型编译。
 */
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { compiler } from "../../../tooling/refactor/architecture/contracts";
import { checkComments } from "../../../tooling/refactor/architecture/comment-check";
const prefix = "docs/refactor/generated/wolf-sorcerer-state-slot-";
const first = !process.argv.includes("--failed-only");
const before = JSON.parse(fs.readFileSync(prefix + "before.json", "utf8"));
const paths = first ? before.source.filter((file: {path: string}) => !file.path.endsWith("/wolf_sorcerer/state.ts")).map((file: {path: string}) => file.path).concat(["backend/src/game/mechanisms/roles/wolf_sorcerer/state-slot.ts", "backend/tests/unit/features/wolf-sorcerer/state-slot.test.ts"]) :
  [...new Set(JSON.parse(fs.readFileSync(prefix + "heads-first.json", "utf8")).diagnostics.map((item: {path: string}) => item.path))];
const files = paths.map((path: string) => {
  const text = fs.readFileSync(path, "utf8");
  return {path, text, sha256: createHash("sha256").update(text).digest("hex")};
});
const documentationPaths = execFileSync("git", ["ls-files", "docs/**/*.md", "README.md"], {encoding:"utf8"}).trim().split("\n").filter(Boolean);
const diagnostics = checkComments(compiler(process.cwd()), {files, documentationPaths});
const report = {source:files.map(({text, ...file}: {text: string; path: string; sha256: string}) => file), documentationPathCount:documentationPaths.length, diagnostics, run:first ? "first-eleven" : "failed-only"};
fs.writeFileSync(prefix + (first ? "heads-first.json" : "heads-final.json"), JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify({files:files.length, documentationPaths:documentationPaths.length, diagnostics}));
if (diagnostics.length) process.exitCode = 1;
