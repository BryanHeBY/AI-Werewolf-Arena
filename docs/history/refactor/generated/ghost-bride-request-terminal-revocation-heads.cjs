/** 仅读本批三源码的真实职责头；文档路径固定原 Git，不运行角色或类型。 */
const fs=require('node:fs'),cp=require('node:child_process'),{createHash}=require('node:crypto');
const ts=require('../../../backend/node_modules/typescript'),{checkComments}=require('../../../tooling/refactor/architecture/comment-check.ts');
const p='docs/refactor/generated/ghost-bride-request-terminal-revocation-',r=JSON.parse(fs.readFileSync(p+'source-ready.json','utf8'));
const hash=b=>createHash('sha256').update(b).digest('hex');
const files=r.source.map(row=>{const b=fs.readFileSync(row.path);if(hash(b)!==row.sha256)throw Error('ready_changed:'+row.path);return {path:row.path,text:b.toString('utf8'),sha256:row.sha256};});
const documentationPaths=cp.execFileSync('git',['ls-tree','-r','--name-only',r.baseCommit],{encoding:'utf8'}).split('\n').filter(x=>x==='README.md'||/^docs\/.*\.md$/.test(x)).sort();
const diagnostics=checkComments(ts,{files,documentationPaths});
const report={baseCommit:r.baseCommit,sourceReadySHA256:hash(fs.readFileSync(p+'source-ready.json')),roots:files.length,documentationPaths:documentationPaths.length,diagnostics};
fs.writeFileSync(p+'heads.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));if(diagnostics.length)process.exitCode=1;
