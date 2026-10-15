/** 负责本次阵营输入迁移的有限中文职责头检查；输入为联合冻结源与公开文档名，输出真实诊断，不执行游戏或模型。 */
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { compiler } from "../../../tooling/refactor/architecture/contracts";
import { checkComments } from "../../../tooling/refactor/architecture/comment-check";
const prefix = "docs/refactor/generated/camp-canonical-cohort-";
const fencePath = prefix + "fence.json";
const fence = JSON.parse(fs.readFileSync(fencePath, "utf8"));
const hash = (data: string | Buffer) => createHash("sha256").update(data).digest("hex");
const selected = JSON.parse(fs.readFileSync("docs/refactor/generated/camp-canonical-inspection-risk-source-ready.json", "utf8")).source;
const files = selected.map((row: {path: string; sha256: string}) => {
  const text = fs.readFileSync(row.path, "utf8");
  if (hash(text) !== row.sha256) throw new Error("camp_head_fence_drift:" + row.path);
  return {path: row.path, text, sha256: row.sha256};
});
const documentationPaths = execFileSync("git", ["ls-files", "docs/**/*.md", "README.md"], {encoding: "utf8"}).trim().split("\n").filter(Boolean);
const diagnostics = checkComments(compiler(process.cwd()), {files, documentationPaths});
const chineseHeadFailures = files.filter((x: {text: string}) => !/[\u4e00-\u9fff]/u.test(x.text.slice(0, x.text.indexOf("*/") + 2))).map((x: {path: string}) => x.path);
const result = {fence: {path: fencePath, sha256: hash(fs.readFileSync(fencePath))}, source: files.map(({text, ...x}: {text: string; path: string; sha256: string}) => x), documentationPaths: documentationPaths.length, diagnostics, chineseHeadFailures};
fs.writeFileSync("docs/refactor/generated/camp-canonical-inspection-risk-heads.json", JSON.stringify(result, null, 2) + "\n");
console.log(JSON.stringify({files: files.length, diagnostics, chineseHeadFailures}));
if (diagnostics.length || chineseHeadFailures.length) process.exitCode = 1;
