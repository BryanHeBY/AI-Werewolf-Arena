/** 负责本批九个审计源码职责头的有界检查；输入真实源码及文档路径，输出原检查诊断，不运行业务或全仓门禁。 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import ts from "../../../backend/node_modules/typescript";
import { checkComments } from "../../../tooling/refactor/architecture/comment-check";
const paths: string[] = JSON.parse(fs.readFileSync("docs/refactor/generated/ai-audit-chinese-contracts-before.json", "utf8")).source.map((entry: {path: string}) => entry.path);
const hash = (s: string) => crypto.createHash("sha256").update(s).digest("hex");
const files = paths.map(path => ({path, text: fs.readFileSync(path, "utf8"), sha256: hash(fs.readFileSync(path, "utf8"))}));
const documentationPaths: string[] = [];
function collect(directory: string) {
  for (const entry of fs.readdirSync(directory, {withFileTypes:true})) {
    const p = path.join(directory, entry.name);
    if (entry.isDirectory()) collect(p);
    else if (entry.isFile() && p.endsWith(".md")) documentationPaths.push(p);
  }
}
collect("docs");
const failures = checkComments(ts, {files, documentationPaths});
const chineseFailures = files.filter(f => !/[\u4e00-\u9fff]/.test(f.text.slice(0, f.text.indexOf("*/") + 2))).map(f=>f.path);
const result = {files: files.map(({text,...meta})=>meta), documentationPathCount:documentationPaths.length, failures, chineseFailures};
fs.writeFileSync("docs/refactor/generated/ai-audit-chinese-contracts-heads.json",JSON.stringify(result,null,2)+"\n");
console.log(JSON.stringify(result,null,2));
if (failures.length || chineseFailures.length) process.exitCode=1;
