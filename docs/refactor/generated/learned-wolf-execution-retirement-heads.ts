/** 检查本批十二源的中文职责头形状；输入已冻结字节与公开文档路径，输出原诊断，不代替人工语义审查。 */
import fs from "node:fs";
import { createHash } from "node:crypto";
import { compiler } from "../../../tooling/refactor/architecture/contracts";
import { checkComments } from "../../../tooling/refactor/architecture/comment-check";
const prefix = "docs/refactor/generated/learned-wolf-execution-retirement-";
const ready = JSON.parse(fs.readFileSync(prefix + "source-ready.json", "utf8"));
const sample = JSON.parse(fs.readFileSync(prefix + "check-input.json", "utf8"));
const files = ready.source.map((entry: {path: string; sha256: string}) => {
  const text = fs.readFileSync(entry.path, "utf8"), sha256 = createHash("sha256").update(text).digest("hex");
  if (sha256 !== entry.sha256) throw new Error("source_ready_drift:" + entry.path);
  return {...entry, text};
});
const diagnostics = checkComments(compiler(process.cwd()), { files, documentationPaths: sample.documentationPaths });
const chineseHeadFailures = files.filter((entry: {text: string}) => !/[\u4e00-\u9fff]/u.test(entry.text.slice(0,entry.text.indexOf("*/") + 2))).map((entry: {path: string}) => entry.path);
fs.writeFileSync(prefix + "heads.json", JSON.stringify({ source: ready.source, documentationPaths: sample.documentationPaths.length, diagnostics, chineseHeadFailures }, null, 2) + "\n");
console.log(JSON.stringify({ source: files.length, documentationPaths: sample.documentationPaths.length, diagnostics: diagnostics.length, chineseHeadFailures }));
if (diagnostics.length || chineseHeadFailures.length) process.exitCode = 1;
