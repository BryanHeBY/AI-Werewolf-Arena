/**
 * 负责本批冻结 58 源的首份职责头检查；输入为冻结源码和实际公开文档路径。
 * 输出原 checkComments 诊断；只检查头的结构及词项，不执行源码或代替语义审查。
 */
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { compiler } from "../../../tooling/refactor/architecture/contracts";
import { checkComments } from "../../../tooling/refactor/architecture/comment-check";
const prefix = "docs/refactor/generated/board-ruleset-chinese-contracts";
const ready = JSON.parse(fs.readFileSync(prefix + "-source-ready.json", "utf8"));
const sha = (text: string) => createHash("sha256").update(text).digest("hex");
const files = ready.source.map((row: { path: string; sha256: string }) => {
  const text = fs.readFileSync(row.path, "utf8");
  if (sha(text) !== row.sha256) throw Error("source_ready_changed:" + row.path);
  return { path: row.path, text };
});
const documentationPaths = execFileSync("git", ["ls-files", "docs/**/*.md", "README.md"], { encoding: "utf8" }).trim().split("\n").filter(Boolean);
const diagnostics = checkComments(compiler(process.cwd()), { files, documentationPaths });
const report = { sourceReadySHA256: sha(fs.readFileSync(prefix + "-source-ready.json", "utf8")), source: ready.source, checkedRoots: files.length, documentationPaths: documentationPaths.length, diagnostics };
fs.writeFileSync(prefix + "-heads.json", JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify({ roots: files.length, docs: documentationPaths.length, diagnostics: diagnostics.length }));
if (diagnostics.length) process.exitCode = 1;
