/**
 * 负责本批五文件职责头的有限验证；输入为真实源码、摘要和现有公开文档路径。
 * 输出为门禁诊断及中文头计数；不运行全仓门禁或修改债务，真实性由独立源码审查负责。
 */
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import { compiler, digest } from "../../../tooling/refactor/architecture/contracts";
import { checkComments } from "../../../tooling/refactor/architecture/comment-check";
const scope = JSON.parse(fs.readFileSync("docs/refactor/generated/night-readability-scope-final.json", "utf8"));
const files = scope.source.map((s: {path:string;sha256:string}) => {
  const text=fs.readFileSync(s.path,"utf8");if(digest(text)!==s.sha256)throw Error("scope_mismatch");return {...s,text};
});
const documentationPaths = execFileSync("git", ["ls-files", "docs"], { encoding:"utf8" }).trim().split("\n");
const failures=checkComments(compiler(process.cwd()),{files,documentationPaths});
const chineseHeads=files.filter((f:{text:string})=>/[\u3400-\u9fff]/.test(f.text.slice(0,f.text.indexOf("*/")))).length;
fs.writeFileSync("docs/refactor/generated/night-readability-heads.json",JSON.stringify({files:scope.source,documentationPaths:documentationPaths.length,failures,chineseHeads},null,2)+"\n");
console.log(JSON.stringify({files:files.length,failures:failures.length,chineseHeads}));if(failures.length)process.exitCode=1;
