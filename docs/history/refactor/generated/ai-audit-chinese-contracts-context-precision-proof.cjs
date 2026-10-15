/** 负责末任务包装说明的单源纯注释对照；输入真实精度前全文和当前源码，输出完整非注释树及两份原编译输出，不重跑九源或类型／业务检查。 */
const fs = require('node:fs'), crypto = require('node:crypto'), assert = require('node:assert/strict');
const ts = require('../../../backend/node_modules/typescript');
const prefix = 'docs/refactor/generated/ai-audit-chinese-contracts-';
const d = JSON.parse(fs.readFileSync(prefix + 'context-precision.json', 'utf8'));
const current = fs.readFileSync(d.path, 'utf8');
const sha = s => crypto.createHash('sha256').update(s).digest('hex');
assert.equal(sha(d.before.text),d.before.sha256);
assert.equal(sha(current),d.afterSHA256);
assert.equal(current.split(d.replacement.after).length,2);
assert.equal(current.replace(d.replacement.after,d.replacement.before),d.before.text);
function tree(text) {
  const sf=ts.createSourceFile(d.path,text,ts.ScriptTarget.Latest,true);
  assert.deepEqual(sf.parseDiagnostics,[]);
  let nodes=0,leaves=0;
  function visit(n) {
    if (n.kind>=ts.SyntaxKind.FirstJSDocNode&&n.kind<=ts.SyntaxKind.LastJSDocNode) return undefined;
    nodes++;
    const children=n.getChildren(sf).filter(c=>!(c.kind>=ts.SyntaxKind.FirstJSDocNode&&c.kind<=ts.SyntaxKind.LastJSDocNode));
    if(!children.length){leaves++;return[n.kind,n.getText(sf)];}
    return[n.kind,children.map(visit)];
  }
  const full=visit(sf);return{full,nodes,leaves};
}
const A=tree(d.before.text),B=tree(current);assert.deepEqual(A,B);
const outputs=[ts.ModuleKind.ESNext,ts.ModuleKind.CommonJS].map(module=>{
  const emit=text=>ts.transpileModule(text,{fileName:d.path,compilerOptions:{target:ts.ScriptTarget.ES2022,module,removeComments:true}}).outputText;
  const old=emit(d.before.text),now=emit(current);assert.equal(old,now);
  return{module:ts.ModuleKind[module],wholeRawSame:true,sha256:sha(now)};
});
const r={path:d.path,beforeSHA256:d.before.sha256,sha256:d.afterSHA256,exactSingleCommentInverseSame:true,fullNonCommentTreeSame:true,nonCommentTreeNodes:A.nodes,nonCommentLeaves:A.leaves,outputs};
fs.writeFileSync(prefix+'context-precision-proof.json',JSON.stringify(r,null,2)+'\n');console.log(JSON.stringify(r));
