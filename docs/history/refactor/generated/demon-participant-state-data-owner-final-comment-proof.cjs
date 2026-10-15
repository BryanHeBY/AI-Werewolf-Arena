/** 只核末一条遗留注释删除，完整解析树与两整raw输出；不运行原主proof/type/head/业务。 */
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const ts=require(path.join(process.cwd(),'backend/node_modules/typescript'));
const p='docs/refactor/generated/demon-participant-state-data-owner-';
const before=JSON.parse(fs.readFileSync(p+'final-comment-before.json','utf8'));
const current=fs.readFileSync(before.path,'utf8'),e=before.edits[0];
const sha=x=>crypto.createHash('sha256').update(x).digest('hex');
if(before.text.split(e.before).length!==2 || before.text.replace(e.before,'')!==current) throw Error('single_comment_forward');
const offset=before.text.indexOf(e.before),inverse=current.slice(0,offset)+e.before+current.slice(offset);
if(inverse!==before.text)throw Error('single_comment_inverse');
function tree(text){const f=ts.createSourceFile('actual.ts',text,ts.ScriptTarget.Latest,true),parts=[];let nodes=0,arrays=0,leaves=0;function walk(n){if(ts.isJSDoc(n))return;nodes++;parts.push(n.kind);let children=0;ts.forEachChild(n,c=>{children++;walk(c)},a=>{arrays++;parts.push(['array',a.length,!!a.hasTrailingComma]);for(const c of a){children++;walk(c)}});if(!children){leaves++;parts.push(['leaf',n.getText(f)])}}walk(f);return{nodes,arrays,leaves,sha256:sha(JSON.stringify(parts))}}
const a=tree(before.text),b=tree(current);if(a.sha256!==b.sha256)throw Error('whole_typed_program');
const protectedPattern=/(?:@ts-(?:expect-error|ignore|check|nocheck)|@jsx(?:ImportSource|Runtime|Frag)?|@license|@preserve)[^\r\n]*/g;
if(JSON.stringify(before.text.match(protectedPattern))!==JSON.stringify(current.match(protectedPattern)))throw Error('protected_tags');
const outputs=[ts.ModuleKind.ESNext,ts.ModuleKind.CommonJS].map(module=>{const emit=text=>ts.transpileModule(text,{compilerOptions:{target:ts.ScriptTarget.ES2022,module,removeComments:true}}).outputText;const x=emit(before.text),y=emit(current);if(x!==y)throw Error('whole_raw_emit:'+module);return{module,sha256:sha(x),same:true}});
const ready=JSON.parse(fs.readFileSync(p+'source-ready-unit-repair.json','utf8'));
for(const s of ready.source.slice(1))if(sha(fs.readFileSync(s.path))!==s.sha256)throw Error('other_two_source_drift');
const result={source:{path:before.path,beforeSha256:before.sha256,sha256:sha(current)},singleCommentForward:true,singleCommentInverse:true,before:a,current:b,protectedTagsSame:true,wholeRawOutputs:outputs,otherTwoSourceSame:true,limits:['仅末comment桥，不替代或重跑主proof/类型/头/运行，旧采样SHA与历史脚本保留。']};
fs.writeFileSync(p+'final-comment-proof.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
