/** 检查F05b实际改动的World／测试输入中文职责头；只读取当前明确根和Git文档名，不运行模型、对局或全门禁。 */
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { compiler } from '../../../tooling/refactor/architecture/contracts';
import { checkComments } from '../../../tooling/refactor/architecture/comment-check';
const P='docs/refactor/generated/camp-canonical-world-inputs-';
const selected=JSON.parse(fs.readFileSync(P+'changed-paths.json','utf8')) as string[];
const files=selected.map(path=>{const text=fs.readFileSync(path,'utf8');return{path,text,sha256:createHash('sha256').update(text).digest('hex')};});
const documentationPaths=execFileSync('git',['ls-files','docs/**/*.md','README.md'],{encoding:'utf8'}).trim().split('\n').filter(Boolean);
const diagnostics=checkComments(compiler(process.cwd()),{files,documentationPaths});
const chineseHeadFailures=files.filter(x=>!/[\u4e00-\u9fff]/u.test(x.text.slice(0,x.text.indexOf('*/')+2))).map(x=>x.path);
const result={source:files.map(({text,...x})=>x),documentationPaths:documentationPaths.length,diagnostics,chineseHeadFailures};
fs.writeFileSync(P+'heads.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
if(diagnostics.length||chineseHeadFailures.length)process.exitCode=1;
