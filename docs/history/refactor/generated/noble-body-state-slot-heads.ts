/**
 * 负责有限三源职责头和中文说明的结构核对。
 * 输入为当前源码与公开 Markdown 路径；输出为原检查器诊断和当前源码摘要，不运行游戏或全量门禁。
 * 语法通过不证明写权与失败时点，真实内容由独立源审负责。
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import ts from '../../../backend/node_modules/typescript';
import {checkComments} from '../../../tooling/refactor/architecture/comment-check';
const files=['backend/src/game/mechanisms/roles/noble_secret_body/state.ts','backend/src/game/mechanisms/roles/noble_secret_body/authority.ts','backend/tests/unit/features/noble-secret-body/state-slot.test.ts'].map(path=>({path,text:fs.readFileSync(path,'utf8'),sha256:crypto.createHash('sha256').update(fs.readFileSync(path)).digest('hex')}));
function documents(directory:string):string[]{return fs.readdirSync(directory,{withFileTypes:true}).flatMap(row=>row.isDirectory()?documents(path.join(directory,row.name)):row.name.endsWith('.md')?[path.join(directory,row.name)]:[]);}
const documentationPaths=['README.md',...documents('docs')],diagnostics=checkComments(ts,{files,documentationPaths});
const chinese=files.map(f=>({path:f.path,present:/[\u3400-\u9fff]/.test(f.text.slice(0,f.text.indexOf('*/')+2))}));
fs.writeFileSync('docs/refactor/generated/noble-body-state-slot-heads.json',JSON.stringify({files:files.map(({path,sha256})=>({path,sha256})),documentationPaths:documentationPaths.length,diagnostics,chinese},null,2)+'\n');
console.log(JSON.stringify({files:files.length,documentationPaths:documentationPaths.length,diagnostics}));if(diagnostics.length)process.exitCode=1;
