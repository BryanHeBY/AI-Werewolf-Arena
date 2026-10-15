/** 负责本批四十源的真实中文职责检查；只读取冻结源和实际存在的公开文档，不执行生产入口。 */
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { compiler } from "../../../tooling/refactor/architecture/contracts";
import { checkComments } from "../../../tooling/refactor/architecture/comment-check";
const prefix = "docs/refactor/generated/night-ability-grants-";
const scope = JSON.parse(fs.readFileSync(prefix + "scope-final.json", "utf8"));
const sha = (text: string) => createHash("sha256").update(text).digest("hex");
const files = scope.source.map((file: { path: string; sha256: string }) => {
  const text = fs.readFileSync(file.path, "utf8");
  if (sha(text) !== file.sha256) throw Error("frozen_source_changed");
  return { ...file, text };
});
const documentationPaths: string[] = [];
function collect(directory: string): void {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const target = path.posix.join(directory, entry.name);
    if (entry.isSymbolicLink()) continue;
    if (entry.isDirectory()) collect(target);
    else if (entry.isFile() && target.endsWith(".md")) documentationPaths.push(target);
  }
}
collect("docs");
if (fs.existsSync("README.md")) documentationPaths.push("README.md");
const diagnostics = checkComments(compiler(process.cwd()), { files, documentationPaths });
const missingChineseHead = files.filter((file: { path: string; text: string }) => {
  const first = /\/\*\*[\s\S]*?\*\//.exec(file.text)?.[0] ?? "";
  return !/[\u4e00-\u9fff]/.test(first);
}).map((file: { path: string }) => file.path);
fs.writeFileSync(prefix + "heads.json", JSON.stringify({ source: scope.source, sourceCount: files.length, documentationPathCount: documentationPaths.length, diagnostics, missingChineseHead }, null, 2) + "\n");
console.log(JSON.stringify({ sources: files.length, documentationPaths: documentationPaths.length, diagnostics: diagnostics.length, missingChineseHead: missingChineseHead.length }));
if (diagnostics.length || missingChineseHead.length) process.exitCode = 1;
