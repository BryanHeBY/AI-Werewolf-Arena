/** 只核 newunit 一句职责精度变化，不重复业务、类型或已绿源码头。 */
const fs=require('node:fs'),crypto=require('node:crypto'),ts=require('../../../backend/node_modules/typescript');
const {checkComments}=require('../../../tooling/refactor/architecture/comment-check.ts');
const prefix='docs/refactor/generated/order-prince-revote-',b=JSON.parse(fs.readFileSync(prefix+'head-before.json','utf8')),current=fs.readFileSync(b.path,'utf8');
const check=(v,m)=>{if(!v)throw Error(m);},sha=t=>crypto.createHash('sha256').update(t).digest('hex');
check(b.text.replace(b.delta.before,b.delta.after)===current,'single exact full comment delta');check(current.replace(b.delta.after,b.delta.before)===b.text,'single complete inverse');
function nodes(t) {const s=ts.createSourceFile('unit.ts',t,ts.ScriptTarget.Latest,true);let count=0;function walk(n){if(n.kind>=ts.SyntaxKind.FirstJSDocNode&&n.kind<=ts.SyntaxKind.LastJSDocNode)return null;count++;const children=[];ts.forEachChild(n,c=>{children.push(walk(c));});return [n.kind,children.length?children:n.getText(s)];}return{tree:walk(s),count};}
const old=nodes(b.text),now=nodes(current);check(JSON.stringify(old.tree)===JSON.stringify(now.tree),'whole typed program');
const outputs=[ts.ModuleKind.ESNext,ts.ModuleKind.CommonJS].map(m=>{const emit=t=>ts.transpileModule(t,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:m,removeComments:true}}).outputText;const rawSame=emit(b.text)===emit(current);check(rawSame,'entire emitted unit');return{module:ts.ModuleKind[m],rawSame};});
const documentationPaths=JSON.parse(fs.readFileSync(prefix+'documentation-paths.json','utf8'));const source={path:b.path,text:current,sha256:sha(current)};const diagnostics=checkComments(ts,{files:[source],documentationPaths});
const report={path:b.path,beforeSha256:b.sha256,sha256:sha(current),exactSingleCommentForwardInverse:true,wholeTypedNodes:now.count,wholeTypedTreeSame:true,outputs,headCheck:{source:1,documentationPaths:documentationPaths.length,diagnostics},limits:'首4头使用2806全部真实tracked docs路径（包含非MD），首仅oracle红；本次只失败unit，用同样真实目录中的MD路径，不宣称其它三头重复执行。'};
fs.writeFileSync(prefix+'head-bridge.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));if(diagnostics.length)process.exitCode=1;
