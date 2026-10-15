/** 负责本测试源原职责头的有限检查；输入当前源码和真实 Git 文档，输出原诊断，不检查全仓或执行玩法。 */
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { compiler } from "../../../tooling/refactor/architecture/contracts";
import { checkComments } from "../../../tooling/refactor/architecture/comment-check";
const prefix = "docs/refactor/generated/ghost-bride-config-identity-fixture-";
const before = JSON.parse(fs.readFileSync(prefix + "before.json", "utf8"));
const text = fs.readFileSync(before.path, "utf8");
const files = [{ path: before.path, text, sha256: createHash("sha256").update(text).digest("hex") }];
const documentationPaths = execFileSync("git", ["ls-files", "docs/**/*.md", "README.md"], { encoding: "utf8" }).trim().split("\n").filter(Boolean);
const diagnostics = checkComments(compiler(process.cwd()), { files, documentationPaths });
const chineseHeadFailures = files.filter(x => !/[\u4e00-\u9fff]/u.test(x.text.slice(0, x.text.indexOf("*/") + 2))).map(x => x.path);
const result = { source: files.map(({ text, ...x }) => x), documentationPaths: documentationPaths.length, diagnostics, chineseHeadFailures };
fs.writeFileSync(prefix + "heads.json", JSON.stringify(result, null, 2) + "\n");
console.log(JSON.stringify(result));
if (diagnostics.length || chineseHeadFailures.length) process.exitCode = 1;
