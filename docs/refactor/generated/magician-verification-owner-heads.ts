/**
 * 负责核对魔术师验证迁移的五个现行源码职责头。输入为当前候选及真实 Git 文档路径，
 * 输出职责诊断和单独的中文首头检查；仅检查说明形状，不代替规则真义或运行验收。
 */
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { compiler } from "../../../tooling/refactor/architecture/contracts";
import { checkComments } from "../../../tooling/refactor/architecture/comment-check";
const before = JSON.parse(fs.readFileSync("docs/refactor/generated/magician-verification-owner-before.json", "utf8"));
const paths: string[] = [...before.moves.map((move: { to: string }) => move.to), ...before.consumers];
const files = paths.map(path => {
  const text = fs.readFileSync(path, "utf8");
  return { path, text, sha256: createHash("sha256").update(text).digest("hex") };
});
const documentationPaths = execFileSync("git", ["ls-files", "docs/**/*.md", "README.md"], { encoding: "utf8" }).trim().split("\n").filter(Boolean);
const diagnostics = checkComments(compiler(process.cwd()), { files, documentationPaths });
const missingChineseHead = files.filter(file => !/[\u4e00-\u9fff]/.test(file.text.slice(0, file.text.indexOf("*/") + 2))).map(file => file.path);
const result = { source: files.map(({path, sha256}) => ({path, sha256})), documentationPathCount: documentationPaths.length, diagnostics, missingChineseHead,
  limit: "职责词项与中文首头检查只覆盖现行五个候选，旧删除叶不作为存在输入；注释没有修改，具体内容仍交独立审查。" };
fs.writeFileSync("docs/refactor/generated/magician-verification-owner-heads.json", JSON.stringify(result, null, 2) + "\n");
console.log(JSON.stringify({ files: files.length, documentationPaths: documentationPaths.length, diagnostics: diagnostics.length, missingChineseHead: missingChineseHead.length }));
if (diagnostics.length || missingChineseHead.length) process.exitCode = 1;
