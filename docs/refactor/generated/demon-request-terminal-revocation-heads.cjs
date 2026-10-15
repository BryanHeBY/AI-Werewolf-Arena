/** 只解析本批三个实际源码的职责头；文档路径来自真实前态 Git，不执行生产或类型。 */
const fs=require("node:fs"),cp=require("node:child_process"),{createHash}=require("node:crypto");
const ts=require("../../../backend/node_modules/typescript"),{checkComments}=require("../../../tooling/refactor/architecture/comment-check.ts");
const prefix="docs/refactor/generated/demon-request-terminal-revocation-",ready=JSON.parse(fs.readFileSync(prefix+"source-ready.json","utf8"));
const hash=b=>createHash("sha256").update(b).digest("hex");
const files=ready.source.map(r=>{const bytes=fs.readFileSync(r.path);if(hash(bytes)!==r.sha256)throw Error("source_ready_changed");return {path:r.path,text:bytes.toString("utf8"),sha256:r.sha256};});
const documentationPaths=cp.execFileSync("git",["ls-tree","-r","--name-only",ready.baseCommit],{encoding:"utf8"}).split("\n").filter(p=>p==="README.md"||/^docs\/.*\.md$/.test(p)).sort();
const diagnostics=checkComments(ts,{files,documentationPaths}),report={sourceReadySHA256:hash(fs.readFileSync(prefix+"source-ready.json")),roots:files.length,documentationPaths:documentationPaths.length,diagnostics};
fs.writeFileSync(prefix+"heads.json",JSON.stringify(report,null,2)+"\n");console.log(JSON.stringify(report));if(diagnostics.length)process.exitCode=1;
