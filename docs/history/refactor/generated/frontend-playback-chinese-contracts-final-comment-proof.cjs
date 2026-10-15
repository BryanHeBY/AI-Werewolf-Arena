/** 仅核浏览器单元“正序跳帧”说明精度，保首十八源主证明，不重类型、头或浏览器。 */
const fs=require('node:fs'),assert=require('node:assert/strict'),{createHash}=require('node:crypto'),ts=require('../../../backend/node_modules/typescript');
const prefix='docs/refactor/generated/frontend-playback-chinese-contracts-',before=JSON.parse(fs.readFileSync(prefix+'final-comment-before.json','utf8'));
const current=fs.readFileSync(before.path,'utf8'),sha=x=>createHash('sha256').update(x).digest('hex');
assert.equal(before.text.split(before.before).length,2);assert.equal(current,before.text.replace(before.before,before.after));assert.equal(current.replace(before.after,before.before),before.text);
function program(text){const source=ts.createSourceFile(before.path,text,ts.ScriptTarget.Latest,true);assert.deepEqual(source.parseDiagnostics,[]);let nodes=0,arrays=0,leaves=0;
function walk(n){nodes++;const parts=[];ts.forEachChild(n,c=>{parts.push(walk(c))},a=>{arrays++;parts.push(['array',a.length,!!a.hasTrailingComma,a.map(walk)])});return[n.kind,parts]}
function tokens(n){const cs=n.getChildren(source).filter(c=>c.kind<ts.SyntaxKind.FirstJSDocNode||c.kind>ts.SyntaxKind.LastJSDocNode);if(!cs.length){leaves++;return[n.kind,n.getText(source)]}return[n.kind,cs.map(tokens)]}
const typed=walk(source),tokenTree=tokens(source);return{nodes,arrays,leaves,sha256:sha(JSON.stringify([typed,tokenTree]))}}
const a=program(before.text),b=program(current);assert.deepEqual(a,b);
const outputs=[ts.ModuleKind.ESNext,ts.ModuleKind.CommonJS].map(module=>{const emit=text=>ts.transpileModule(text,{fileName:before.path,compilerOptions:{target:ts.ScriptTarget.ES2022,module,jsx:ts.JsxEmit.ReactJSX,removeComments:true}}).outputText;const x=emit(before.text),y=emit(current);assert.equal(x,y);return{module:ts.ModuleKind[module],sha256:sha(x),wholeRawSame:true}});
const first=JSON.parse(fs.readFileSync(prefix+'source-ready.json','utf8'));for(const r of first.source)if(r.path!==before.path)assert.equal(sha(fs.readFileSync(r.path)),r.sha256);
const report={source:{path:before.path,beforeSha256:before.sha256,sha256:sha(current)},singleCommentForwardInverse:true,program:b,outputs,otherSeventeenSourcesSame:true,limit:'仅末说明精度，不重首十八源主证明、头、类型、测试或浏览器。'};
fs.writeFileSync(prefix+'final-comment-proof.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
