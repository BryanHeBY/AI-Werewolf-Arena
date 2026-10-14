/**
 * 负责本批仅首轮失败的骑士公开入口源码职责头的有限形状检查；输入为实际文本与当前 Git 文档路径。
 * 输出为原 checker 的诊断，不代替中文语义审查或启动全门禁、类型与对局。
 */
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { compiler } from "../../../tooling/refactor/architecture/contracts";
import { checkComments } from "../../../tooling/refactor/architecture/comment-check";
const prefix = "docs/refactor/generated/knight-duel-window-owner-";
const paths = ["backend/src/game/mechanisms/roles/knight/ports.ts"];
const files = paths.map(path => { const text = fs.readFileSync(path, "utf8"); return { path, text, sha256: createHash("sha256").update(text).digest("hex") }; });
const documentationPaths = execFileSync("git", ["ls-files", "docs/**/*.md", "README.md"], { encoding: "utf8" }).trim().split("\n").filter(Boolean);
const diagnostics = checkComments(compiler(process.cwd()), { files, documentationPaths });
fs.writeFileSync(prefix + "heads.json", JSON.stringify({ source: files.map(({ text, ...file }) => file), documentationPathCount: documentationPaths.length, diagnostics }, null, 2) + "\n");
console.log(JSON.stringify({ files: files.length, diagnostics }));
if (diagnostics.length) process.exitCode = 1;
