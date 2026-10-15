/** 仅证明失败14th的真实请求输入修复来源；保原13运行声明／断言，实际新旧JS有意不同，不复主证明或业务。 */
const fs=require('node:fs'),assert=require('node:assert/strict'),{createHash}=require('node:crypto'),ts=require('../../../backend/node_modules/typescript');
const p='docs/refactor/generated/cupid-hybrid-request-lease-completion-',before=JSON.parse(fs.readFileSync(p+'trace-fixture-repair-before.json','utf8')),edit=JSON.parse(fs.readFileSync(p+'trace-fixture-repair-edits.json','utf8')).edits[0],current=fs.readFileSync(before.source.path,'utf8'),sha=x=>createHash('sha256').update(x).digest('hex');
assert.equal(sha(before.source.text),before.source.sha256);assert.equal(before.source.text.split(edit.old).length,2);const at=before.source.text.indexOf(edit.old);
assert.equal(before.source.text.slice(0,at)+edit.new+before.source.text.slice(at+edit.old.length),current);
assert.equal(current.slice(at,at+edit.new.length),edit.new);assert.equal(current.slice(0,at)+edit.old+current.slice(at+edit.new.length),before.source.text);
function parse(text){const s=ts.createSourceFile(before.source.path,text,ts.ScriptTarget.Latest,true);assert.equal(s.parseDiagnostics.length,0);return s;}
const a=parse(before.source.text),b=parse(current);let nodes=0,arrays=0,leaves=0;
function tree(n,s){nodes++;const children=[];ts.forEachChild(n,c=>{children.push(tree(c,s));},items=>{arrays++;children.push(['NodeArray',items.length,!!items.hasTrailingComma,...items.map(c=>tree(c,s))]);});const tokens=x=>{const cs=x.getChildren(s).filter(c=>c.kind<ts.SyntaxKind.FirstJSDocNode||c.kind>ts.SyntaxKind.LastJSDocNode);if(!cs.length){leaves++;return[x.kind,x.getText(s)];}return[x.kind,cs.map(tokens)];};return[n.kind,children,tokens(n)];}
function calls(source,name){const out=[];function walk(n){if(ts.isCallExpression(n)&&n.expression.getText(source)===name)out.push(n);ts.forEachChild(n,c=>{walk(c);});}walk(source);return out;}
const testsA=calls(a,'test'),testsB=calls(b,'test');assert.equal(testsA.length,11);assert.equal(testsB.length,11);
for(let i=0;i<10;i++)assert.deepEqual(tree(testsA[i],a),tree(testsB[i],b));
const assertionsA=calls(a,'expect'),assertionsB=calls(b,'expect');assert.equal(assertionsA.length,assertionsB.length);
for(let i=0;i<assertionsA.length;i++)assert.deepEqual(tree(assertionsA[i],a),tree(assertionsB[i],b));
const outputs=[ts.ModuleKind.ESNext,ts.ModuleKind.CommonJS].map(module=>{const emit=text=>ts.transpileModule(text,{fileName:before.source.path,compilerOptions:{target:ts.ScriptTarget.ES2022,module,removeComments:true}}).outputText,old=emit(before.source.text),now=emit(current),inverse=current.slice(0,at)+edit.old+current.slice(at+edit.new.length);assert.equal(emit(inverse),old);return{module:ts.ModuleKind[module],actualWholeRawSame:old===now,inverseWholeRawSame:true,beforeSHA256:sha(old),afterSHA256:sha(now)};});
const ready=JSON.parse(fs.readFileSync(p+'source-ready-first-executed.json','utf8'));
for(const row of ready.source.slice(0,3))assert.equal(sha(fs.readFileSync(row.path)),row.sha256);
const report={approved:true,before:before.source.sha256,source:{path:before.source.path,sha256:sha(current)},wholeForwardInverse:true,production3Same:true,retainedSourceTestCalls:10,retainedRuntimeDeclarations:13,allExpectCallsPreserved:assertionsA.length,typedNodesBothSides:nodes,nodeArraysBothSides:arrays,noncommentLeafVisitsBothSides:leaves,outputs,limits:['AST比较前10个语法test call，循环展开为原13运行声明；第14声明仅新增构造输入适配。','完整expect调用和原断言保，actual JS输入有意不同；两份逆还原整输出same不叫实际JS相同。','只读parser/转换，不类型、head、业务或完整主证明复跑。']};
fs.writeFileSync(p+'trace-fixture-repair-bridge.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({wholeForwardInverse:true,retainedRuntimeDeclarations:13,allExpectCallsPreserved:assertionsA.length,typedNodesBothSides:nodes,inverseWholeOutputs:2}));
