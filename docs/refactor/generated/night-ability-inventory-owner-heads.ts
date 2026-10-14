/** 只核本批实际职责头；读取公共源码及文档路径，不执行产品或其它门禁。 */
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { compiler } from "../../../tooling/refactor/architecture/contracts";
import { checkComments } from "../../../tooling/refactor/architecture/comment-check";
const prefix="docs/refactor/generated/night-ability-inventory-owner-";
const paths=JSON.parse(fs.readFileSync(prefix+"paths.json","utf8")).filter((x:any)=>x.change!=="delete").map((x:any)=>x.path);
const files=paths.map((path:string)=>{const text=fs.readFileSync(path,"utf8");return{path,text,sha256:createHash("sha256").update(text).digest("hex")};});
const documentationPaths=execFileSync("git",["ls-files","docs/**/*.md","README.md"],{encoding:"utf8"}).trim().split("\n").filter(Boolean);
const diagnostics=checkComments(compiler(process.cwd()),{files,documentationPaths});
const report={source:files.map(({text,...r}:any)=>r),documentationPaths:documentationPaths.length,diagnostics,chineseHeadFailures:files.filter((x:any)=>!/[\u4e00-\u9fff]/u.test(x.text.slice(0,x.text.indexOf("*/")+2))).map((x:any)=>x.path)};
fs.writeFileSync(prefix+"heads.json",JSON.stringify(report,null,2)+"\n");console.log(JSON.stringify(report));if(diagnostics.length||report.chineseHeadFailures.length)process.exitCode=1;
