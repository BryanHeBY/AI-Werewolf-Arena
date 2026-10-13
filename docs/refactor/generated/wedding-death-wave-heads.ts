import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import ts from '/home/hby/dev/AI-Werewolf-Arena/backend/node_modules/typescript';
import {checkComments} from '/home/hby/dev/AI-Werewolf-Arena/tooling/refactor/architecture/comment-check';
const root='/home/hby/dev/AI-Werewolf-Arena',g=root+'/docs/refactor/generated',before=JSON.parse(fs.readFileSync(g+'/wedding-death-wave-before.json','utf8'));
function docs(p:string):string[]{return fs.readdirSync(p,{withFileTypes:true}).flatMap(e=>{const q=path.join(p,e.name);return e.isDirectory()?docs(q):e.isFile()&&q.endsWith('.md')?[q.slice(root.length+1)]:[]});}
const documentationPaths=['README.md',...docs(root+'/docs')];const files=before.scope.map((p:string)=>({path:p,text:fs.readFileSync(root+'/'+p,'utf8'),sha256:crypto.createHash('sha256').update(fs.readFileSync(root+'/'+p)).digest('hex')}));const diagnostics=checkComments(ts,{files,documentationPaths});const chineseHeads=files.map((f:any)=>({path:f.path,present:/[\u3400-\u9fff]/.test(f.text.slice(0,f.text.indexOf('*/')+2))}));const out={files:files.map(({path,sha256}:any)=>({path,sha256})),documentationPaths:documentationPaths.length,diagnostics,chineseHeads};fs.writeFileSync(g+'/wedding-death-wave-heads.json',JSON.stringify(out,null,2)+'\n');console.log(JSON.stringify({files:files.length,documentationPaths:documentationPaths.length,diagnostics}));if(diagnostics.length)process.exitCode=1;
