/** 单一JSDoc精度的完整非注释程序／NodeArray／叶／实际输出承接，不复其它绿检查。 */
const fs=require('node:fs'),assert=require('node:assert/strict'),{createHash}=require('node:crypto'),ts=require('../../../backend/node_modules/typescript');
const prefix='docs/refactor/generated/ordinary-native-badge-request-completion-',sha=b=>createHash('sha256').update(b).digest('hex');
const before=JSON.parse(fs.readFileSync(prefix+'comment-precision-before.json','utf8'));
const delta=JSON.parse(fs.readFileSync(prefix+'comment-precision-edit.json','utf8'));
const ready=JSON.parse(fs.readFileSync(prefix+'source-ready.json','utf8'));
const original=before.source.text,current=fs.readFileSync(delta.path,'utf8');
assert.equal(sha(original),delta.beforeSHA256);assert.equal(sha(current),delta.afterSHA256);assert.equal(original.split(delta.before).length-1,1);assert.equal(original.replace(delta.before,delta.after),current);assert.equal(current.replace(delta.after,delta.before),original);
function parse(text){const sf=ts.createSourceFile(delta.path,text,ts.ScriptTarget.Latest,true);assert.deepEqual(sf.parseDiagnostics,[]);return sf;}
function program(sf){let typedNodes=0,nodeArrays=0,nonCommentLeaves=0;const doc=n=>n.kind>=ts.SyntaxKind.FirstJSDocNode&&n.kind<=ts.SyntaxKind.LastJSDocNode;
 function tree(n){typedNodes++;const c=[];ts.forEachChild(n,x=>{if(!doc(x))c.push(tree(x));},a=>{nodeArrays++;c.push(['NodeArray',a.length,!!a.hasTrailingComma,a.filter(x=>!doc(x)).map(tree)]);});return[n.kind,c];}
 function tokens(n){const c=n.getChildren(sf).filter(x=>!doc(x));if(!c.length){nonCommentLeaves++;return[n.kind,n.getText(sf)];}return[n.kind,c.map(tokens)];}
 const tags=[];function collect(n){for(const d of n.jsDoc??[]){for(const t of d.tags??[])tags.push(t.getText(sf));if(d.typeExpression)tags.push(d.typeExpression.getText(sf));}ts.forEachChild(n,c=>{collect(c);});}collect(sf);
 return{tree:tree(sf),tokens:tokens(sf),tags,metrics:{typedNodes,nodeArrays,nonCommentLeaves}};}
const old=parse(original),now=parse(current);assert.deepEqual(program(old),program(now));
const outputs=[ts.ModuleKind.ESNext,ts.ModuleKind.CommonJS].map(module=>{const emit=text=>ts.transpileModule(text,{fileName:delta.path,compilerOptions:{target:ts.ScriptTarget.ES2022,module,removeComments:true}}).outputText;const a=emit(original),b=emit(current);assert.equal(a,b);return{module:ts.ModuleKind[module],actualWholeRawSame:true,beforeSHA256:sha(a),afterSHA256:sha(b)};});
const oldReady=JSON.parse(before.firstApprovedMetadata['source-ready.json']);
const unchanged=oldReady.source.filter(row=>row.path!==delta.path).map(row=>{assert.equal(sha(fs.readFileSync(row.path)),row.sha256);return{path:row.path,sha256:row.sha256};});assert.equal(unchanged.length,4);
for(const row of ready.source)assert.equal(sha(fs.readFileSync(row.path)),row.sha256);
const report={sourceReadySHA256:sha(fs.readFileSync(prefix+'source-ready.json')),source:ready.source,commentEdits:1,changedSource:delta.path,completeForwardInverse:true,actualNonCommentProgramSame:true,program:program(now).metrics,outputs,unchanged,firstApprovedPeerSnapshot:before.peerSnapshot,limits:['只此描述性注释，当前运行程序及两输出实际相同；不重9业务、类型、头或主proof。','首批准/首所有红绿原收据不覆写，末formal只承接此精度和最终hash。']};fs.writeFileSync(prefix+'comment-precision-bridge.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({commentEdits:1,program:report.program,actualWholeOutputsSame:outputs.length,unchanged:unchanged.length}));
