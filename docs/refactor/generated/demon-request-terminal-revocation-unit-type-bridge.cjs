/** 只核首执行单元的 unknown 类型中介：原字面 oracle／注释全保，实际双输出相同，不重复业务或头。 */
const fs=require("node:fs"),assert=require("node:assert/strict"),{createHash}=require("node:crypto");
const ts=require("../../../backend/node_modules/typescript"),prefix="docs/refactor/generated/demon-request-terminal-revocation-";
const before=JSON.parse(fs.readFileSync(prefix+"unit-type-before.json","utf8")),ready=JSON.parse(fs.readFileSync(prefix+"source-ready.json","utf8"));
const hash=b=>createHash("sha256").update(b).digest("hex"),actual=fs.readFileSync(before.path,"utf8");
const old="executeDemonNativeNight(input as NightStageContext, kind)",next="executeDemonNativeNight(input as unknown as NightStageContext, kind)";
assert.equal(before.text.split(old).length-1,1);assert.equal(actual,before.text.replace(old,next));assert.equal(hash(before.text),before.sha256);
const parse=text=>{const sf=ts.createSourceFile(before.path,text,ts.ScriptTarget.Latest,true);assert.deepEqual(sf.parseDiagnostics,[]);return sf;};
const counts=sf=>{const kinds={};function walk(n){kinds[n.kind]=(kinds[n.kind]??0)+1;ts.forEachChild(n,c=>{walk(c);});}walk(sf);return kinds;};
const a=counts(parse(before.text)),b=counts(parse(actual)),expected={...a};expected[ts.SyntaxKind.AsExpression]=(expected[ts.SyntaxKind.AsExpression]??0)+1;expected[ts.SyntaxKind.UnknownKeyword]=(expected[ts.SyntaxKind.UnknownKeyword]??0)+1;assert.deepEqual(b,expected);
const outputs=[ts.ModuleKind.ESNext,ts.ModuleKind.CommonJS].map(module=>{
  const emit=text=>ts.transpileModule(text,{fileName:before.path,compilerOptions:{target:ts.ScriptTarget.ES2022,module,removeComments:true}}).outputText;
  const original=emit(before.text),current=emit(actual);assert.equal(current,original);return {module:ts.ModuleKind[module],sha256:hash(current),wholeRawSame:true};
});
const first=JSON.parse(before.sourceReady.text);for(const row of first.source.slice(0,2))assert.equal(hash(fs.readFileSync(row.path)),row.sha256);
assert.equal(hash(actual),ready.source.find(r=>r.path===before.path).sha256);
const report={firstReadySHA256:before.sourceReady.sha256,finalReadySHA256:hash(fs.readFileSync(prefix+"source-ready.json")),path:before.path,beforeSHA256:before.sha256,sha256:hash(actual),exactTypeOnlyDelta:1,addedSyntaxKinds:{AsExpression:1,UnknownKeyword:1},allOtherSourceTextIncludingTitlesOraclesCommentsSame:true,otherTwoProductionSame:true,outputs,limits:["Erased type repair only; no unit/type/head/main proof rerun."]};
fs.writeFileSync(prefix+"unit-type-bridge.json",JSON.stringify(report,null,2)+"\n");console.log(JSON.stringify(report));
