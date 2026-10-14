/** 负责 F03 四源的有限中文职责头检查；输入当前源和真实 Git 文档路径，输出原诊断，不运行类型、玩法或整结构门禁。 */
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { compiler } from "../../../tooling/refactor/architecture/contracts";
import { checkComments } from "../../../tooling/refactor/architecture/comment-check";
const prefix = "docs/refactor/generated/night-ability-transfer-failure-policy-";
const paths = JSON.parse(fs.readFileSync(prefix + "paths.json", "utf8")).source;
const files = paths.map((path: string) => { const text = fs.readFileSync(path, "utf8"); return { path, text, sha256: createHash("sha256").update(text).digest("hex") }; });
const documentationPaths = execFileSync("git", ["ls-files", "docs/**/*.md", "README.md"], { encoding: "utf8" }).trim().split("\n").filter(Boolean);
const diagnostics = checkComments(compiler(process.cwd()), { files, documentationPaths });
const chineseHeadFailures = files.filter((x: {text: string}) => !/[\u4e00-\u9fff]/u.test(x.text.slice(0, x.text.indexOf("*/") + 2))).map((x: {path: string}) => x.path);
const result = { source: files.map(({ text, ...x }: {text: string; path: string; sha256: string}) => x), documentationPaths: documentationPaths.length, diagnostics, chineseHeadFailures };
fs.writeFileSync(prefix + "heads.json", JSON.stringify(result, null, 2) + "\n");
console.log(JSON.stringify(result));
if (diagnostics.length || chineseHeadFailures.length) process.exitCode = 1;
