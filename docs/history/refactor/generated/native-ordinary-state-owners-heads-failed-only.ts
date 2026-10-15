/** 负责普通五族24个源的有限职责头与中文检查；输入当前源码和真实公开文档路径，输出原诊断，不执行玩法或全门禁。 */
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { compiler } from "../../../tooling/refactor/architecture/contracts";
import { checkComments } from "../../../tooling/refactor/architecture/comment-check";
const prefix = "docs/refactor/generated/native-ordinary-state-owners-";
const paths: string[] = ["backend/src/game/mechanisms/roles/white_wolf_king/ports.ts"];
const files = paths.map(path => { const text = fs.readFileSync(path, "utf8"); return { path, text, sha256: createHash("sha256").update(text).digest("hex") }; });
const documentationPaths = execFileSync("git", ["ls-files", "docs/**/*.md", "README.md"], { encoding: "utf8" }).trim().split("\n").filter(Boolean);
const diagnostics = checkComments(compiler(process.cwd()), { files, documentationPaths });
const chineseHeadFailures = files.filter(f => !/[\u4e00-\u9fff]/u.test(f.text.slice(0, f.text.indexOf("*/") + 2))).map(f => f.path);
const result = { source: files.map(({text, ...r}) => r), documentationPaths: documentationPaths.length, diagnostics, chineseHeadFailures };
fs.writeFileSync(prefix + "heads-failed-only.json", JSON.stringify(result, null, 2) + "\n");
console.log(JSON.stringify(result));
if (diagnostics.length || chineseHeadFailures.length) process.exitCode = 1;
