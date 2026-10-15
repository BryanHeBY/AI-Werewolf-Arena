/** 只负责两源的注释精度及真实初始化上下文输入后继，核完整正逆与转译变化；不复跑首证明、职责头或业务。 */
const fs=require('node:fs'),assert=require('node:assert/strict'),{createHash}=require('node:crypto'),ts=require('../../../backend/node_modules/typescript');
const prefix='docs/refactor/generated/noble-state-installation-',sha=x=>createHash('sha256').update(x).digest('hex');
const before=JSON.parse(fs.readFileSync(prefix+'repair-before.json','utf8')),edits=JSON.parse(fs.readFileSync(prefix+'repair-edits.json','utf8')),ready=JSON.parse(fs.readFileSync(prefix+'source-ready-repair.json','utf8'));
const parse=(p,s)=>ts.createSourceFile(p,s,ts.ScriptTarget.Latest,true);
const modules=[ts.ModuleKind.ESNext,ts.ModuleKind.CommonJS],emit=(p,s,module)=>ts.transpileModule(s,{fileName:p,compilerOptions:{target:ts.ScriptTarget.ES2022,module,removeComments:true}}).outputText;
const results=before.source.map(row=>{
 const now=fs.readFileSync(row.path,'utf8'),own=edits.filter(e=>e.path===row.path);assert.equal(sha(row.text),row.sha256);assert.equal(sha(now),ready.source.find(r=>r.path===row.path).sha256);
 let forward=row.text;for(const e of own){assert.equal(forward.split(e.before).length,2);forward=forward.replace(e.before,e.after)}assert.equal(forward,now);
 let inverse=now;for(const e of [...own].reverse()){assert.equal(inverse.split(e.after).length,2);inverse=inverse.replace(e.after,e.before)}assert.equal(inverse,row.text);
 const outputs=modules.map(module=>{const a=emit(row.path,row.text,module),b=emit(row.path,now,module);if(row.path.endsWith('/state.ts'))assert.equal(a,b);else assert.notEqual(a,b);return{module,beforeSHA256:sha(a),currentSHA256:sha(b),actualSame:a===b}});
 if(row.path.endsWith('.test.ts')){
  const old=parse(row.path,row.text),next=parse(row.path,now),bodies=sf=>sf.statements.filter(n=>ts.isExpressionStatement(n)&&ts.isCallExpression(n.expression)&&n.expression.expression.getText(sf)==='test').map(n=>n.getText(sf));
  assert.equal(bodies(old).length,2);assert.deepEqual(bodies(old),bodies(next));
 }
 return{path:row.path,beforeSHA256:row.sha256,currentSHA256:sha(now),wholeForwardInverse:true,exactEdits:own.length,outputs};
});
const profile='backend/src/game/mechanisms/roles/noble_secret_body/profile.ts',first=JSON.parse(fs.readFileSync(prefix+'source-ready.json','utf8'));assert.equal(sha(fs.readFileSync(profile)),first.source.find(r=>r.path===profile).sha256);
const report={source:ready.source,results,otherProfileSame:true,unitTwoTestDeclarationsSame:true,limits:['state仅一中文说明，两个整输出保持。','unit的currentCamp callback由错误枚举返回改为实际组件对象，两个整输出有意不同；两完整test声明和字面oracle原文保持。','首次首proof/head/source-ready与联合类型红不覆写，不重已绿业务作为本工具的一部分。']};fs.writeFileSync(prefix+'repair-proof.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({changedSources:2,exactEdits:2,stateWholeOutputsSame:2,unitWholeOutputsIntentionallyDifferent:2,unitTestDeclarationsSame:2,otherProfileSame:true}));
