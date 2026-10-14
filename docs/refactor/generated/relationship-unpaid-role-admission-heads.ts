/** 只读取本批八个冻结源码和 Git 文档路径，核有效中文职责头并保存原诊断；不运行业务、类型或全门禁。 */
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { compiler } from "../../../tooling/refactor/architecture/contracts";
import { checkComments } from "../../../tooling/refactor/architecture/comment-check";
const prefix = "docs/refactor/generated/relationship-unpaid-role-admission-";
const readyPath = prefix + "source-ready-reflect.json";
const sha = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
const ready = JSON.parse(fs.readFileSync(readyPath, "utf8"));
const files = ready.source.map((entry: { path: string; sha256: string }) => {
  const text = fs.readFileSync(entry.path, "utf8");
  if (sha(text) !== entry.sha256) throw new Error("ready_source_drift:" + entry.path);
  return { ...entry, text };
});
const documentationPaths = execFileSync("git", ["ls-files", "docs/**/*.md", "README.md"], { encoding: "utf8" }).trim().split("\n").filter(Boolean);
const diagnostics = checkComments(compiler(process.cwd()), { files, documentationPaths });
const chineseHeadFailures = files.filter((entry: { text: string }) => !/[\u4e00-\u9fff]/u.test(entry.text.slice(0, entry.text.indexOf("*/") + 2))).map((entry: { path: string }) => entry.path);
const report = { source: files.map(({ text, ...entry }: { text: string; path: string; sha256: string }) => entry), sourceReadySHA256: sha(fs.readFileSync(readyPath)), documentationPaths: documentationPaths.length, diagnostics, chineseHeadFailures };
fs.writeFileSync(prefix + "heads.json", JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify({ roots: files.length, documentationPaths: documentationPaths.length, diagnostics: diagnostics.length, chineseHeadFailures }));
if (diagnostics.length || chineseHeadFailures.length) process.exitCode = 1;
