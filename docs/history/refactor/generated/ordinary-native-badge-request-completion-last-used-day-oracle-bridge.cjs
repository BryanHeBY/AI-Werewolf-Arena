/** 只承接新单元两条字面初值预期修复；不冒运行等价，不复绿头／类型／主证明。 */
const fs=require('node:fs'),assert=require('node:assert/strict'),{createHash}=require('node:crypto');
const ts=require('../../../backend/node_modules/typescript');
const prefix='docs/refactor/generated/ordinary-native-badge-request-completion-',sha=v=>createHash('sha256').update(v).digest('hex');
const data=JSON.parse(fs.readFileSync(prefix+'last-used-day-oracle-edits.json','utf8')).source;
const first=JSON.parse(fs.readFileSync(prefix+'last-used-day-first-snapshot.json','utf8'));
const ready=JSON.parse(fs.readFileSync(prefix+'source-ready.json','utf8'));
const before=data.beforeText,current=fs.readFileSync(data.path,'utf8');assert.equal(sha(before),data.beforeSHA256);assert.equal(sha(current),data.afterSHA256);assert.equal(data.edits.length,2);
let inverse=current,forward=before;
for(const e of [...data.edits].reverse()){assert.equal(before.slice(e.beforeStart,e.beforeEnd),e.before);assert.equal(current.slice(e.afterStart,e.afterEnd),e.after);inverse=inverse.slice(0,e.afterStart)+e.before+inverse.slice(e.afterEnd);forward=forward.slice(0,e.beforeStart)+e.after+forward.slice(e.beforeEnd);}
assert.equal(inverse,before);assert.equal(forward,current);
const oldOracle='expect(f.ability.lastUsedDay).toBeUndefined();',newOracle='expect(f.ability.lastUsedDay).toBeNull();';
assert.equal(before.split(oldOracle).length-1,2);assert.equal(current.split(newOracle).length-1,2);assert.equal(current.split(newOracle).join(oldOracle),before);
function parse(text){const sf=ts.createSourceFile(data.path,text,ts.ScriptTarget.Latest,true);assert.deepEqual(sf.parseDiagnostics,[]);return sf;}
function program(sf){let typedNodes=0,nodeArrays=0,nonCommentLeaves=0;const doc=n=>n.kind>=ts.SyntaxKind.FirstJSDocNode&&n.kind<=ts.SyntaxKind.LastJSDocNode;
 function tree(n){typedNodes++;const c=[];ts.forEachChild(n,x=>{if(!doc(x))c.push(tree(x));},a=>{nodeArrays++;c.push(['array',a.length,!!a.hasTrailingComma,a.filter(x=>!doc(x)).map(tree)]);});return[n.kind,c];}
 function token(n){const c=n.getChildren(sf).filter(x=>!doc(x));if(!c.length){nonCommentLeaves++;return[n.kind,n.getText(sf)];}return[n.kind,c.map(token)];}
 return{tree:tree(sf),tokens:token(sf),metrics:{typedNodes,nodeArrays,nonCommentLeaves}};}
const a=parse(before),b=parse(current),c=parse(inverse);assert.deepEqual(program(a),program(c));assert.deepEqual(program(a).tree,program(b).tree);
function tests(sf){const names=[];function walk(n){if(ts.isCallExpression(n)&&ts.isIdentifier(n.expression)&&n.expression.text==='test')names.push(n.arguments[0].text);ts.forEachChild(n,x=>{walk(x);});}walk(sf);return names;}
assert.deepEqual(tests(a),tests(b));assert.equal(tests(b).length,9);
const outputs=[ts.ModuleKind.ESNext,ts.ModuleKind.CommonJS].map(module=>{const emit=text=>ts.transpileModule(text,{fileName:data.path,compilerOptions:{module,target:ts.ScriptTarget.ES2022,removeComments:true}}).outputText;
const oldJS=emit(before),actualJS=emit(current),inverseJS=emit(inverse);assert.equal(oldJS,inverseJS);assert.notEqual(actualJS,oldJS);return{module:ts.ModuleKind[module],wholeInverseRawSame:true,actualOracleOutputIntentionallyDifferent:true,beforeSHA256:sha(oldJS),currentSHA256:sha(actualJS),inverseSHA256:sha(inverseJS)};});
const previous=JSON.parse(first.sourceReadyText);
const unchanged=previous.source.filter(row=>row.path!==data.path).map(row=>{assert.equal(sha(fs.readFileSync(row.path)),row.sha256);return{path:row.path,sha256:row.sha256};});assert.equal(unchanged.length,4);
for(const row of ready.source)assert.equal(sha(fs.readFileSync(row.path)),row.sha256);
const contract=JSON.parse(fs.readFileSync(prefix+'last-used-day-contract.json','utf8'));assert.equal(sha(contract.text),contract.sha256);assert.ok(contract.text.includes('lastUsedDay: null,'));
const report={sourceReadySHA256:sha(fs.readFileSync(prefix+'source-ready.json')),source:ready.source,oracleChanges:2,before:program(a).metrics,current:program(b).metrics,wholeForwardInverse:true,structuralTreeAndNodeArraysSame:true,onlyExactTwoOracleCallsChanged:true,outputs,unchanged,testNames:tests(b),originalNativeContract:{baseCommit:contract.baseCommit,path:contract.path,sha256:contract.sha256,lastUsedDay:null},limits:['这是新测试字面预期修复，当前执行输出有意不同；完整逆和实际字段合同不替代失败三声明的Root运行。','6已绿不重；两方法修改不扩大为新输入或生产改变，不复类型／头／主proof。']};
fs.writeFileSync(prefix+'last-used-day-oracle-bridge.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({changed:1,oracleChanges:2,program:report.current,wholeInverseRawOutputs:outputs.length,unchanged:unchanged.length,testDeclarations:report.testNames.length}));
