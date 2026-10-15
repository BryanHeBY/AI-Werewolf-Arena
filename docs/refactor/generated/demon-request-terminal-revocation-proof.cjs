/** 只读核本批实际 Git、精确政策增量与未修改的付款／来源程序；不执行角色、类型或行为。 */
const fs=require("node:fs"),cp=require("node:child_process"),assert=require("node:assert/strict"),{createHash}=require("node:crypto");
const ts=require("../../../backend/node_modules/typescript"),prefix="docs/refactor/generated/demon-request-terminal-revocation-";
const before=JSON.parse(fs.readFileSync(prefix+"before.json","utf8")),ready=JSON.parse(fs.readFileSync(prefix+"source-ready.json","utf8")),edits=JSON.parse(fs.readFileSync(prefix+"edits.json","utf8"));
const hash=b=>createHash("sha256").update(b).digest("hex");
function parse(file,text){const sf=ts.createSourceFile(file,text,ts.ScriptTarget.Latest,true);assert.deepEqual(sf.parseDiagnostics,[]);return sf;}
function tree(sf){let nodes=0,arrays=0;function walk(n){nodes++;const children=[];ts.forEachChild(n,c=>{children.push(walk(c));},items=>{arrays++;children.push(["array",items.length,!!items.hasTrailingComma,items.map(walk)]);});return [n.kind,children];}const shape=walk(sf);return {shape,nodes,arrays};}
const emit=(text,file,module)=>ts.transpileModule(text,{fileName:file,compilerOptions:{target:ts.ScriptTarget.ES2022,module,removeComments:true}}).outputText;
const keep={
  "authority.ts":["liveNight","authorizedDemonHunter","canSubmitDemonHunt","commitDemonHunt","closeDemonHunterTurn","freezeDemonHunt","closeDemonHunterNight","openDemonWitchTurnFrame","demonNativePoisonFrame","openDemonNativeNightFrame","demonHunterAuditPlayer"],
  "native_potion_requests.ts":["bindDemonWitchRequest","bindDemonNativeNightRequest","readDemonNativeNightTool","readDemonPotionTool","demonWitchRequestCurrent","demonWitchRequestTargetCurrent","demonWitchMarksSafe"],
};
const programs=before.source.map(row=>{
  const actual=fs.readFileSync(row.path,"utf8"),steps=edits.find(e=>e.path===row.path).edits;
  assert.equal(hash(row.text),row.sha256);assert.equal(hash(actual),ready.source.find(r=>r.path===row.path).sha256);
  assert.equal(cp.execFileSync("git",["cat-file","blob",before.baseCommit+":"+row.path]).toString("utf8"),row.text);
  let inverse=actual,forward=row.text;
  for(const e of [...steps].reverse()){
    assert.equal(row.text.slice(e.beforeStart,e.beforeEnd),e.before);assert.equal(actual.slice(e.afterStart,e.afterEnd),e.after);
    inverse=inverse.slice(0,e.afterStart)+e.before+inverse.slice(e.afterEnd);
    forward=forward.slice(0,e.beforeStart)+e.after+forward.slice(e.beforeEnd);
  }
  assert.equal(inverse,row.text);assert.equal(forward,actual);
  const a=parse(row.path,row.text),b=parse(row.path,actual),i=parse(row.path,inverse);
  assert.deepEqual(tree(i),tree(a));
  const declarations=sf=>new Map(sf.statements.filter(ts.isFunctionDeclaration).map(n=>[n.name?.text,n.getText(sf)]));
  const old=declarations(a),current=declarations(b),names=keep[row.path.split("/").at(-1)];
  for(const name of names){assert(old.has(name),name);assert.equal(current.get(name),old.get(name),"protected original function: "+name);}
  const outputs=[ts.ModuleKind.ESNext,ts.ModuleKind.CommonJS].map(module=>{
    const oldRaw=emit(row.text,row.path,module),actualRaw=emit(actual,row.path,module),inverseRaw=emit(inverse,row.path,module);
    assert.equal(inverseRaw,oldRaw);assert.notEqual(actualRaw,oldRaw);
    return {module:ts.ModuleKind[module],beforeSHA256:hash(oldRaw),actualSHA256:hash(actualRaw),wholeInverseRawSame:true,wholeActualRawSame:false};
  });
  return {path:row.path,exactEdits:steps.length,wholeForwardInverse:true,beforeNodes:tree(a).nodes,currentNodes:tree(b).nodes,protectedWholeFunctions:names,outputs};
});
for(const row of before.controls){const raw=fs.readFileSync(row.path);assert.equal(hash(raw),row.sha256);assert.equal(cp.execFileSync("git",["cat-file","blob",before.baseCommit+":"+row.path]).toString("utf8"),row.text);}
const unit=ready.source.at(-1),unitTree=parse(unit.path,fs.readFileSync(unit.path,"utf8"));assert.equal(hash(fs.readFileSync(unit.path)),unit.sha256);
const legacy=JSON.parse(fs.readFileSync(prefix+"legacy-receipts.json","utf8"));for(const row of legacy.artifacts)assert.equal(hash(fs.readFileSync(row.path)),row.sha256);
const report={baseCommit:before.baseCommit,sourceReadySHA256:hash(fs.readFileSync(prefix+"source-ready.json")),programs,newUnit:{path:unit.path,sha256:unit.sha256,typedNodes:tree(unitTree).nodes},controls:before.controls.length,originalLegacyArtifactsSame:legacy.artifacts.length,summary:{productionPrograms:programs.length,exactEdits:programs.reduce((n,p)=>n+p.exactEdits,0),protectedWholeFunctions:programs.reduce((n,p)=>n+p.protectedWholeFunctions.length,0),wholeInverseRawOutputs:4,wholeActualDifferentRawOutputs:4},limits:["Independent F02 policy deliberately changes actual JavaScript; inverse equality is not old runtime equivalence.","Protected actual payment/freeze/frame/audit functions remain exact original text; request-only terminal records do not own paid source validity.","Pure parsing/emit/data-source proof only; no type checker, game, original legacy probe, unit or gate is run here."]};
fs.writeFileSync(prefix+"proof.json",JSON.stringify(report,null,2)+"\n");console.log(JSON.stringify(report.summary));
