/** 只核本批三个源的实际职责头与中文说明；文档路径来自当前真实 Git，不运行玩法或全门禁。 */
import fs from "node:fs";
import { createHash } from "node:crypto";
import { compiler } from "../../../tooling/refactor/architecture/contracts";
import { checkComments } from "../../../tooling/refactor/architecture/comment-check";
const pre = "docs/refactor/generated/player-checkpoint-format-owner-";
const paths: string[] = JSON.parse(fs.readFileSync(pre + "paths.json", "utf8"));
const files = paths.map((path) => {
  const text = fs.readFileSync(path, "utf8");
  return { path, text, sha256: createHash("sha256").update(text).digest("hex") };
});
const documentationPaths: string[] = JSON.parse(fs.readFileSync(pre + "documentation-paths.json", "utf8"));
const diagnostics = checkComments(compiler(process.cwd()), { files, documentationPaths });
const chineseHeadFailures = files.filter((file) => !/[\u4e00-\u9fff]/u.test(file.text.slice(0, file.text.indexOf("*/") + 2))).map((file) => file.path);
const report = { source: files.map(({ text, ...file }) => file), documentationPaths: documentationPaths.length, diagnostics, chineseHeadFailures };
fs.writeFileSync(pre + "heads.json", JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify(report));
if (diagnostics.length || chineseHeadFailures.length) process.exitCode = 1;
