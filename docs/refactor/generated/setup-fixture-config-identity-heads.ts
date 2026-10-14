/** 负责两测试源有限职责头与中文检查；输入当前源和真实Git文档，输出原checker诊断，不执行玩法或全仓门禁。 */
import fs from 'node:fs';import {execFileSync} from 'node:child_process';import {createHash} from 'node:crypto';
import {compiler} from '../../../tooling/refactor/architecture/contracts';import {checkComments} from '../../../tooling/refactor/architecture/comment-check';
const pre='docs/refactor/generated/setup-fixture-config-identity-',before=JSON.parse(fs.readFileSync(pre+'before.json','utf8'));
const files=before.source.map((x:any)=>{const text=fs.readFileSync(x.path,'utf8');return{path:x.path,text,sha256:createHash('sha256').update(text).digest('hex')};});
const documentationPaths=execFileSync('git',['ls-files','docs/**/*.md','README.md'],{encoding:'utf8'}).trim().split('\n').filter(Boolean);
const diagnostics=checkComments(compiler(process.cwd()),{files,documentationPaths});const chineseHeadFailures=files.filter((x:any)=>!/[\u4e00-\u9fff]/u.test(x.text.slice(0,x.text.indexOf('*/')+2))).map((x:any)=>x.path);
const result={source:files.map(({text,...x}:any)=>x),documentationPaths:documentationPaths.length,diagnostics,chineseHeadFailures};fs.writeFileSync(pre+'heads.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));if(diagnostics.length||chineseHeadFailures.length)process.exitCode=1;
