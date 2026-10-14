/** 检查本批新增公开端口职责头；输入当前一源，输出原检查诊断，不执行角色或扩大旧源采样。 */
import * as fs from 'node:fs';
import * as crypto from 'node:crypto';
import ts from '../../../backend/node_modules/typescript';
import { checkComments } from '../../../tooling/refactor/architecture/comment-check';
const path='backend/src/game/mechanisms/roles/noble_secret_body/exile-ports.ts',text=fs.readFileSync(path,'utf8');
const files=[{path,text,sha256:crypto.createHash('sha256').update(text).digest('hex')}];
const diagnostics=checkComments(ts,{files,documentationPaths:[]});
fs.writeFileSync('docs/refactor/generated/secret-body-exile-port-heads.json',JSON.stringify({roots:files.map(({path,sha256})=>({path,sha256})),diagnostics,chinese:true},null,2)+'\n');
console.log(JSON.stringify({roots:1,diagnostics:diagnostics.length}));if(diagnostics.length)process.exitCode=1;
