/** 负责真实 Git 装配全文和实际新编码表达式的完整对照；输入源与精确编辑，输出语法、token、两种完整 JS 和实际 bindings 证据，不执行游戏。 */
const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const ts = require('../../../backend/node_modules/typescript');
const prefix = 'docs/refactor/generated/private-state-codec-';
const before = JSON.parse(fs.readFileSync(prefix + 'before.json','utf8'));
const edits = JSON.parse(fs.readFileSync(prefix + 'edits.json','utf8'));
const paths = JSON.parse(fs.readFileSync(prefix + 'paths.json','utf8'));
const hash = s => crypto.createHash('sha256').update(s).digest('hex');
const source = (p,t) => ts.createSourceFile(p,t,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS);
function shape(n,s) { let result = { kind:n.kind, children:[] }; ts.forEachChild(n,x=>{result.children.push(shape(x,s));},a=>{result.children.push({array:Array.from(a,x=>shape(x,s))});}); if (!result.children.length) result.text=n.getText(s);return result; }
function tokens(text) { const sc=ts.createScanner(ts.ScriptTarget.Latest,true,ts.LanguageVariant.Standard,text);const result=[]; for(let k=sc.scan();k!==ts.SyntaxKind.EndOfFileToken;k=sc.scan()) result.push([k,sc.getTokenText()]);return result; }
function find(s,predicate) {const result=[];function visit(n){if(predicate(n))result.push(n);ts.forEachChild(n,visit);}visit(s);return result;}
function outputs(t,p) {return [ts.ModuleKind.ESNext,ts.ModuleKind.CommonJS].map(module=>ts.transpileModule(t,{fileName:p,compilerOptions:{target:ts.ScriptTarget.ES2022,module,removeComments:true}}).outputText);}
const old = before.source[0];
const git = cp.execFileSync('git',['show',before.baseCommit+':'+old.path],{encoding:'utf8'});
assert.equal(git,old.text);assert.equal(hash(git),old.sha256);
const current = fs.readFileSync(old.path,'utf8');let forward=git;
for(const e of edits[old.path]){assert.equal(forward.split(e.before).length-1,e.count);forward=forward.replace(e.before,e.after);}assert.equal(forward,current);
let inverse=current;for(const e of [...edits[old.path]].reverse()){assert.equal(inverse.split(e.after).length-1,e.count);inverse=inverse.replace(e.after,e.before);}assert.equal(inverse,git);
const oldSF=source(old.path,git), restoredSF=source(old.path,inverse);
assert.deepEqual(shape(restoredSF,restoredSF),shape(oldSF,oldSF));assert.deepEqual(tokens(inverse),tokens(git));
const oldInit=find(oldSF,n=>ts.isPropertyAssignment(n)&&n.name.getText(oldSF)==='privateState');assert.equal(oldInit.length,1);
const ownerPath=paths[1],ownerText=fs.readFileSync(ownerPath,'utf8'),owner=source(ownerPath,ownerText);
const fn=find(owner,n=>ts.isFunctionDeclaration(n)&&n.name?.text==='encodeCheckpointPrivateState');assert.equal(fn.length,1);
const returns=find(fn[0],n=>ts.isReturnStatement(n));assert.equal(returns.length,1);
const actual=returns[0].expression;assert(ts.isParenthesizedExpression(actual));const expression=actual.expression;
assert.deepEqual(shape(expression,owner),shape(oldInit[0].initializer,oldSF));assert.deepEqual(tokens(expression.getText(owner)),tokens(oldInit[0].initializer.getText(oldSF)));
const call=find(source(old.path,current),n=>ts.isCallExpression(n)&&n.expression.getText()==='encodeCheckpointPrivateState');assert.equal(call.length,1);assert.deepEqual(call[0].arguments.map(n=>n.getText()),['world','id','complete','animal','original','role','audit']);
const wrapped = expressionText => 'function compare(world,id,complete,animal,original,role,audit){return '+expressionText+';}';
const originalExpressionOutputs=outputs(wrapped(oldInit[0].initializer.getText(oldSF)),old.path), currentExpressionOutputs=outputs(wrapped(expression.getText(owner)),ownerPath);
const originalWhole=outputs(git,old.path), inverseWhole=outputs(inverse,old.path);
const exprOutputComparisons=originalExpressionOutputs.map((o,i)=>{assert.equal(currentExpressionOutputs[i],o);return {module:i?'CommonJS':'ESNext',oldSHA256:hash(o),actualSHA256:hash(currentExpressionOutputs[i]),same:true};});
const wholeOutputs=originalWhole.map((o,i)=>{assert.equal(inverseWhole[i],o);return {module:i?'CommonJS':'ESNext',oldSHA256:hash(o),inverseSHA256:hash(inverseWhole[i]),same:true};});
const bindings=[];
for (const name of ['snapshotPlainData','fragrantCheckpointPrivateState','projectLonelyGirl']) {
 const get=s=>find(s,n=>ts.isImportDeclaration(n)&&n.importClause?.namedBindings&&ts.isNamedImports(n.importClause.namedBindings)&&n.importClause.namedBindings.elements.some(e=>e.name.text===name));
 const a=get(oldSF),b=get(owner);assert.equal(a.length,1);assert.equal(b.length,1);
 const aRoute=a[0].moduleSpecifier.text,bRoute=b[0].moduleSpecifier.text;
 const oldEndpoint=path.normalize(path.join(path.dirname(old.path),aRoute))+'.ts', newEndpoint=path.normalize(path.join(path.dirname(ownerPath),bRoute))+'.ts';assert.equal(newEndpoint,oldEndpoint);
 const endpointText=fs.readFileSync(newEndpoint,'utf8');const endpointSF=source(newEndpoint,endpointText);const declaration=find(endpointSF,n=>ts.isFunctionDeclaration(n)&&n.name?.text===name);assert.equal(declaration.length,1);
 bindings.push({name,oldRoute:aRoute,newRoute:bRoute,endpoint:newEndpoint,sha256:hash(endpointText),declarationSHA256:hash(declaration[0].getText(endpointSF))});
}
const precision = JSON.parse(fs.readFileSync(prefix+'comment-precision-before.json','utf8'));
const precisionOld = precision.source.text;assert.equal(hash(precisionOld),precision.source.sha256);let precisionForward=precisionOld;
for(const e of precision.edits){assert.equal(precisionForward.split(e.before).length-1,e.count);precisionForward=precisionForward.replace(e.before,e.after);}assert.equal(precisionForward,ownerText);
assert.deepEqual(tokens(precisionOld),tokens(ownerText));const precisionSF=source(ownerPath,precisionOld);assert.deepEqual(shape(precisionSF,precisionSF),shape(owner,owner));
const precisionOutputs=outputs(precisionOld,ownerPath);const actualOwnerOutputs=outputs(ownerText,ownerPath);assert.deepEqual(precisionOutputs,actualOwnerOutputs);
const commentPrecision={path:ownerPath,beforeSHA256:hash(precisionOld),finalSHA256:hash(ownerText),exactComments:2,completeTypedAndTokensSame:true,wholeOutputs:2,wholeRawSame:true};
const controls=before.controls.map(c=>{const raw=cp.execFileSync('git',['show',before.baseCommit+':'+c.path]);assert.equal(hash(raw),c.sha256);assert.equal(hash(fs.readFileSync(c.path)),c.sha256);return {...c,sameGitAndCurrent:true};});
const count=n=>{let k=1;ts.forEachChild(n,x=>{k+=count(x);});return k;};
const result={approved:true,baseCommit:before.baseCommit,source:paths.map(p=>({path:p,sha256:hash(fs.readFileSync(p))})),retainedProgram:{path:old.path,completeForwardInverse:true,exactEdits:edits[old.path].length,typedNodes:count(oldSF),noncommentTokens:tokens(git).length,outputs:wholeOutputs},actualOwnerExpression:{originalPath:old.path,newPath:ownerPath,completeTypedAndTokensSame:true,typedNodes:count(expression),noncommentTokens:tokens(expression.getText(owner)).length,outputs:exprOutputComparisons,arguments:['world','id','complete','animal','original','role','audit']},bindings,controls,commentPrecision,limits:['实际完整JS模块路径/函数调用和分配/栈变化；两整模块输出仅精确迁移逆后同，不称原模块JS逐字同。','实际新return完整表达式对原initializer，不覆盖原整个装配body证明新owner。','特殊分支仍原算法，未新增schema或JSON接受限制；不证明所有55族codec已完成或全图初始化恒同。','四类type-only输入依赖擦除，不输出World/回执到归档。']};
fs.writeFileSync(prefix+'proof.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
