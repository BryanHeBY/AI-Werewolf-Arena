/** 核首类型失败夹具的 this 注解桥；输入完整首稿和唯一注解，输出两份 actual 整 JS 相同证据，不重运行测试或主证明。 */
const fs=require('node:fs'),assert=require('node:assert/strict'),ts=require('../../../backend/node_modules/typescript'),{createHash}=require('node:crypto');
const prefix='docs/refactor/generated/role-execution-install-retirement-';
const bridge=JSON.parse(fs.readFileSync(prefix+'fixture-this-bridge.json','utf8')),sha=x=>createHash('sha256').update(x).digest('hex');
const current=fs.readFileSync(bridge.path,'utf8');assert.equal(current,bridge.after);assert.equal(sha(bridge.before),bridge.beforeSha256);assert.equal(sha(current),bridge.afterSha256);
assert.equal(bridge.before.split(bridge.edit.before).length,2);assert.equal(bridge.before.replace(bridge.edit.before,bridge.edit.after),current);
assert.equal(current.split(bridge.edit.after).length,2);assert.equal(current.replace(bridge.edit.after,bridge.edit.before),bridge.before);
const outputs=[ts.ModuleKind.ESNext,ts.ModuleKind.CommonJS].map(module=>{
 const emit=text=>ts.transpileModule(text,{fileName:bridge.path,compilerOptions:{target:ts.ScriptTarget.ES2022,module,removeComments:true}}).outputText;
 const a=emit(bridge.before),b=emit(current);assert.equal(a,b);return {module:ts.ModuleKind[module],actualWholeRawSame:true,sha256:sha(a),bytes:Buffer.byteLength(a)};
});
const result={approved:true,path:bridge.path,beforeSha256:bridge.beforeSha256,afterSha256:bridge.afterSha256,fullExactForwardInverse:true,edit:bridge.edit,onlyThisAnnotation:true,outputs,limits:['只承接首新unit的静态this类型；原4案例62断言在首unit阶段运行，未在末稿重跑。','不是生产补丁，不重跑原主证明、中文头或已绿业务。']};
fs.writeFileSync(prefix+'fixture-this-proof.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({fullExactForwardInverse:true,wholeRawOutputs:outputs.length}));
