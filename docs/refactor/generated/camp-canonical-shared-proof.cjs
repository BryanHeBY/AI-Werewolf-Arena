/** 核对共享API与support的实际Git完整前体和精确差分；输出逆向完整程序证明，明确不声称新Camp输入与旧行为等价。 */
const fs=require('node:fs'),cp=require('node:child_process'),assert=require('node:assert/strict'),crypto=require('node:crypto'),ts=require('../../../backend/node_modules/typescript');
const dir='docs/refactor/generated/',hash=b=>crypto.createHash('sha256').update(b).digest('hex');
function tree(text,path){const f=ts.createSourceFile(path,text,ts.ScriptTarget.Latest,true);assert.equal(f.parseDiagnostics.length,0,path);let nodes=0,arrays=0,leaves=0;function walk(n){nodes++;const out=[];ts.forEachChild(n,x=>{out.push(walk(x));},a=>{arrays++;out.push(['array',a.length,!!a.hasTrailingComma,...a.map(walk)]);});if(!out.length){leaves++;return[n.kind,n.getText(f)];}return[n.kind,out];}return{shape:walk(f),nodes,arrays,leaves};}
for(const prefix of ['camp-canonical-shared-api','camp-canonical-shared-support']){
 const read=s=>JSON.parse(fs.readFileSync(dir+prefix+'-'+s+'.json','utf8')),before=read('before'),ready=read('source-ready'),edits=read('edits');let rows=before.source;
 const ex=dir+prefix+'-before-expanded.json';if(fs.existsSync(ex)){const e=JSON.parse(fs.readFileSync(ex));assert.equal(hash(fs.readFileSync(e.originalSnapshot.path)),e.originalSnapshot.sha256);rows=[...rows,...e.additionalSource];}
 let nodes=0,arrays=0,leaves=0;const programs=rows.map(r=>{
  const git=cp.execFileSync('git',['show',before.baseCommit+':'+r.path]);assert.equal(hash(git),r.sha256,r.path);assert.equal(git.toString(),r.text,r.path);
  let forward=r.text;const stages=[];for(const e of edits.filter(e=>e.path===r.path)){const at=e.offset;assert.equal(forward.slice(at,at+e.before.length),e.before,r.path);stages.push(e);forward=forward.slice(0,at)+e.after+forward.slice(at+e.before.length);}
  const current=fs.readFileSync(r.path,'utf8');assert.equal(current,forward,r.path);assert.equal(hash(current),ready.source.find(x=>x.path===r.path).sha256,r.path);
  let inverse=current;for(const e of stages.reverse()){assert.equal(inverse.slice(e.offset,e.offset+e.after.length),e.after,r.path);inverse=inverse.slice(0,e.offset)+e.before+inverse.slice(e.offset+e.after.length);}assert.equal(inverse,r.text);
  const a=tree(r.text,r.path),b=tree(inverse,r.path);assert.deepEqual(a,b);nodes+=a.nodes;arrays+=a.arrays;leaves+=a.leaves;
  return{path:r.path,beforeSha256:r.sha256,sha256:hash(current),completeForwardInverse:true,exactEdits:stages.length,typedNodes:a.nodes,nodeArrays:a.arrays,noncommentLeaves:a.leaves,outputs:[ts.ModuleKind.ESNext,ts.ModuleKind.CommonJS].map(module=>{const emit=t=>ts.transpileModule(t,{fileName:r.path,compilerOptions:{target:ts.ScriptTarget.ES2022,module,removeComments:true}}).outputText,old=emit(r.text),inv=emit(inverse),actual=emit(current);assert.equal(old,inv);return{module:ts.ModuleKind[module],inverseWholeRawSame:true,actualWholeRawSame:old===actual,beforeSha256:hash(old),actualSha256:hash(actual)};})};
 });
 const report={approved:true,baseCommit:before.baseCommit,source:ready.source,programs,summary:{actualPrograms:programs.length,exactEdits:edits.length,typedNodes:nodes,nodeArrays:arrays,noncommentLeaves:leaves,inverseWholeOutputs:programs.length*2},limits:['Camp is explicit new source/API/initialization/failure data policy. Actual JS differs; inverse proves edited range only.','No runtime/type/comment gate or production loading is performed. SourceReady and first-check successor are separate staged inputs.']};
 fs.writeFileSync(dir+prefix+'-proof.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({prefix,...report.summary}));
}
