/** 仅核三源真实 Git、完整注释记录正反向和非注释 token；不做 AST/emit/类型/测试或全门禁镜像。 */
const fs=require('node:fs'),assert=require('node:assert/strict'),cp=require('node:child_process'),ts=require('../../../backend/node_modules/typescript'),{createHash}=require('node:crypto'),pre='docs/refactor/generated/ai-interface-prompt-chinese-contracts-';
const before=JSON.parse(fs.readFileSync(pre+'before.json','utf8')),edits=JSON.parse(fs.readFileSync(pre+'edits.json','utf8')),sha=s=>createHash('sha256').update(s).digest('hex');
function tokens(s){
 const scanner=ts.createScanner(ts.ScriptTarget.Latest,true,ts.LanguageVariant.Standard,s),out=[],interpolations=[];let braces=0,kind;
 // 模板插值结束时重扫 tail/middle，避免把随后真实注释误当模板文本；不建立 AST。
 while((kind=scanner.scan())!==ts.SyntaxKind.EndOfFileToken){
  if(kind===ts.SyntaxKind.TemplateHead)interpolations.push(braces);
  else if(kind===ts.SyntaxKind.OpenBraceToken)braces++;
  else if(kind===ts.SyntaxKind.CloseBraceToken){
   if(interpolations.length&&braces===interpolations.at(-1)){kind=scanner.reScanTemplateToken(false);if(kind===ts.SyntaxKind.TemplateTail)interpolations.pop();}
   else braces--;
  }
  out.push([kind,scanner.getTokenText()]);
 }
 assert.equal(interpolations.length,0);return out;
}
const source=before.source.map(b=>{assert.equal(sha(b.text),b.sha256);assert.equal(cp.execFileSync('git',['show',before.baseCommit+':'+b.path],{encoding:'utf8'}),b.text);const current=fs.readFileSync(b.path,'utf8'),owned=edits.filter(e=>e.path===b.path);let forward=b.text,inverse=current;for(const e of owned){assert.equal(forward.split(e.before).length,2);forward=forward.replace(e.before,e.after);}for(const e of [...owned].reverse()){assert.equal(inverse.split(e.after).length,2);inverse=inverse.replace(e.after,e.before);}assert.equal(forward,current);assert.equal(inverse,b.text);const A=tokens(b.text),B=tokens(current);assert.deepEqual(B,A);return{path:b.path,beforeSHA256:b.sha256,sha256:sha(current),exactWholeCommentForwardAndInverseSame:true,noncommentTokens:A.length,noncommentTokenKindsAndRawTextSame:true,commentRecords:owned.length};});
const r={approved:true,baseCommit:before.baseCommit,source,summary:{sourceCount:source.length,commentRecords:edits.length,noncommentTokens:source.reduce((n,x)=>n+x.noncommentTokens,0),wholeASTExecuted:false,emitExecuted:false},limits:['只注释、实际 Git 全文和 token 检查；源码字符串／标识符／类型／导入导出及其顺序不改。','读取真实 Policy、Process/default bridge、Werewolf／Loopback control和session lifecycle，仅旁核语义，不改其源。','不类型／运行／全门禁，不承诺重导叶无初始化或声明本身授许可。']};fs.writeFileSync(pre+'proof.json',JSON.stringify(r,null,2)+'\n');console.log(JSON.stringify(r.summary));
