/** 核两源真实 Git 的精确注释正逆，不执行算法、类型、测试或全门禁。 */
const fs=require('node:fs'),cp=require('node:child_process'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const ts=require('../../../backend/node_modules/typescript');
const prefix='docs/refactor/generated/exchange-night-lifecycle-chinese-contracts-';
const before=JSON.parse(fs.readFileSync(prefix+'before.json','utf8')),edits=JSON.parse(fs.readFileSync(prefix+'edits.json','utf8'));
const sha=x=>crypto.createHash('sha256').update(x).digest('hex');
function tokens(text){
  const scanner=ts.createScanner(ts.ScriptTarget.Latest,true,ts.LanguageVariant.Standard,text),rows=[];
  for(let kind=scanner.scan();kind!==ts.SyntaxKind.EndOfFileToken;kind=scanner.scan())rows.push([kind,scanner.getTokenText()]);
  return rows;
}
const source=before.source.map(row=>{
  const git=cp.execFileSync('git',['show',before.baseCommit+':'+row.path],{encoding:'utf8'});assert.equal(git,row.text);assert.equal(sha(git),row.sha256);
  const current=fs.readFileSync(row.path,'utf8'),deltas=edits.filter(e=>e.path===row.path);let forward=row.text;
  for(const d of deltas){assert.equal(forward.split(d.before).length,2);forward=forward.replace(d.before,d.after);}
  assert.equal(forward,current);let inverse=current;
  for(const d of [...deltas].reverse()){assert.equal(inverse.split(d.after).length,2);inverse=inverse.replace(d.after,d.before);}
  assert.equal(inverse,row.text);const oldTokens=tokens(row.text),currentTokens=tokens(current);assert.deepEqual(currentTokens,oldTokens);
  return{path:row.path,beforeSHA256:row.sha256,sha256:sha(current),exactWholeGitForwardAndInverseSame:true,wholeNonCommentTokenSequenceSame:true,nonCommentTokens:oldTokens.length,commentRecords:deltas.length};
});
const control=before.stableControl;assert.equal(sha(fs.readFileSync(control.path)),control.sha256);assert.equal(sha(cp.execFileSync('git',['show',before.baseCommit+':'+control.path])),control.sha256);
const report={baseCommit:before.baseCommit,source,stableControl:{...control,wholeGitAndCurrentSame:true},exactCommentRecords:edits.length,limits:['仅两源精确注释对照与非注释token；不重执行已有生命周期算法proof、types、tests或全门禁。','注释真义另由真实调用方和独立审查核实。']};
fs.writeFileSync(prefix+'proof.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
