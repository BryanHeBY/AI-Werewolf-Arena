/** 仅五输入职责头的静态检查，不执行产品或归档／权限判定；真实内容由同行完整读核。 */
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import ts from '../../../backend/node_modules/typescript';
import { checkComments } from '../../../tooling/refactor/architecture/comment-check';
const prefix='docs/refactor/generated/ordinary-native-badge-request-completion-';
const ready=JSON.parse(fs.readFileSync(prefix+'source-ready.json','utf8'));
const files=ready.source.map((row:{path:string;sha256:string})=>{
  const text=fs.readFileSync(row.path,'utf8');
  if(createHash('sha256').update(text).digest('hex')!==row.sha256)throw new Error('source_ready_changed:'+row.path);
  return {path:row.path,text,sha256:row.sha256};
});
const documentationPaths=execFileSync('git',['ls-files'],{encoding:'utf8'}).split('\n').filter(p=>/\.md$/.test(p));
const diagnostics=checkComments(ts,{files,documentationPaths});
const chineseHeadFailures=files.filter((f:{text:string})=>!/[\u3400-\u9fff]/.test(f.text.slice(0,f.text.indexOf('*/')+2))).map((f:{path:string})=>f.path);
const report={source:ready.source,sourceReadySHA256:createHash('sha256').update(fs.readFileSync(prefix+'source-ready.json')).digest('hex'),documentationPaths:documentationPaths.length,diagnostics,chineseHeadFailures};
fs.writeFileSync(prefix+'heads.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({source:files.length,documentationPaths:documentationPaths.length,diagnostics:diagnostics.length,chineseHeadFailures}));
if(diagnostics.length||chineseHeadFailures.length)process.exitCode=1;
