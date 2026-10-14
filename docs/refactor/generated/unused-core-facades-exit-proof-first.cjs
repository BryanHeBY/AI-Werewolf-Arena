/** 负责核本批入口三处精确编辑、保留出口及旧叶初始化范围；输入真实Git前样与冻结源，输出静态对照及真实转译文本，不加载业务。 */
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const ts=require('../../../backend/node_modules/typescript');
const prefix='docs/refactor/generated/unused-core-facades-exit-';
const sha=x=>crypto.createHash('sha256').update(x).digest('hex');
const before=JSON.parse(fs.readFileSync(prefix+'before.json','utf8'));
const edits=JSON.parse(fs.readFileSync(prefix+'edits.json','utf8'));
const ready=JSON.parse(fs.readFileSync(prefix+'source-ready.json','utf8'));
const file='backend/src/core/domain/index.ts',old=before.source.find(x=>x.path===file).text,current=fs.readFileSync(file,'utf8');
const assert=(ok,label)=>{if(!ok)throw Error(label)};
assert(sha(current)===ready.source[0].sha256,'ready_drift');
let forward=old,inverse=current;
for(const e of edits.edits){assert(forward.split(e.before).length===2,'nonunique_edit');forward=forward.replace(e.before,e.after)}
for(const e of [...edits.edits].reverse()){
 if(e.after) {assert(inverse.split(e.after).length===2,'nonunique_inverse');inverse=inverse.replace(e.after,e.before)}
 else { // Restore retired clauses at their precise original retained neighbor, preserving order.
  const at=old.indexOf(e.before),next=old.slice(at+e.before.length).split('\n')[0]+'\n';
  assert(inverse.split(next).length===2,'nonunique_neighbor');inverse=inverse.replace(next,e.before+next);
 }
}
assert(forward===current,'full_forward');assert(inverse===old,'full_inverse');
const parse=(p,s)=>ts.createSourceFile(p,s,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS);
let nodes=0,arrays=0,leaves=0;
function tree(n,sf){nodes++;const children=[];ts.forEachChild(n,c=>{children.push(tree(c,sf))},a=>{arrays++;children.push({array:a.map(c=>tree(c,sf)),trailing:!!a.hasTrailingComma})});if(!children.length){leaves++;return [n.kind,n.getText(sf)]}return [n.kind,children]}
const first=parse(file,old),restored=parse(file,inverse);assert(JSON.stringify(tree(first,first))===JSON.stringify(tree(restored,restored)),'whole_tree_inverse');
const scannerLeaves=s=>{const scanner=ts.createScanner(ts.ScriptTarget.Latest,true,ts.LanguageVariant.Standard,s),out=[];for(let t=scanner.scan();t!==ts.SyntaxKind.EndOfFileToken;t=scanner.scan())out.push([t,scanner.getTokenText()]);return out};
assert(JSON.stringify(scannerLeaves(old))===JSON.stringify(scannerLeaves(inverse)),'noncomment_token_inverse');
const modules=[['ESNext',ts.ModuleKind.ESNext],['CommonJS',ts.ModuleKind.CommonJS]];
const emit=(p,s,m)=>{const r=ts.transpileModule(s,{fileName:p,compilerOptions:{target:ts.ScriptTarget.ES2022,module:m,removeComments:true},reportDiagnostics:true});assert(!r.diagnostics?.some(d=>d.category===ts.DiagnosticCategory.Error),'transpile_diagnostic');return r.outputText};
const entryEmits=modules.map(([name,m])=>{const a=emit(file,old,m),b=emit(file,current,m),c=emit(file,inverse,m);assert(a===c,'whole_emit_inverse');return {module:name,beforeSHA256:sha(a),currentSHA256:sha(b),actualRawSame:a===b,preciseInverseRawSame:a===c,beforeOutput:a,currentOutput:b}});
function resolve(from,spec){const p=path.posix.normalize(path.posix.join(path.posix.dirname(from),spec));for(const v of [p,p+'.ts',p+'/index.ts'])if(fs.existsSync(v)&&fs.statSync(v).isFile())return v;throw Error('module_missing:'+p)}
const clauses=sf=>sf.statements.filter(ts.isExportDeclaration).map(n=>({text:n.getText(sf),specifier:n.moduleSpecifier?.text||null,names:n.exportClause?.getText(sf)||'*'}));
const oldClauses=clauses(first),newClauses=clauses(parse(file,current));
const removed=new Set(['./registries/phase_registry','./systems/win_condition_system']);
assert(JSON.stringify(oldClauses.filter(r=>!removed.has(r.specifier)))===JSON.stringify(newClauses),'retained_clauses_and_order');
const retained=newClauses.map(r=>({...r,target:resolve(file,r.specifier),targetSHA256:sha(fs.readFileSync(resolve(file,r.specifier)))}));
const leafOutputs=before.source.filter(r=>r.path!==file).map(r=>{
 assert(!fs.existsSync(r.path),'retired_leaf_still_exists');
 const source=parse(r.path,r.text),classes=source.statements.filter(ts.isClassDeclaration);
 assert(source.statements.every(n=>ts.isImportDeclaration(n)||ts.isClassDeclaration(n)),'old_leaf_unexpected_top_statement');
 assert(classes.length===1,'old_leaf_class_count');
 return {path:r.path,beforeSHA256:r.sha256,expectedAbsent:true,imports:source.statements.filter(ts.isImportDeclaration).map(n=>n.moduleSpecifier.text),sourceTopLevel:source.statements.map(n=>ts.SyntaxKind[n.kind]),className:classes[0].name.text,noTopLevelSourceBusinessExpression:true,emits:modules.map(([name,m])=>{const output=emit(r.path,r.text,m);return {module:name,sha256:sha(output),output}})};
});
const report={schemaVersion:1,baseCommit:before.baseCommit,source:ready.source,deleted:ready.deleted,proofInput:{beforeSHA256:sha(fs.readFileSync(prefix+'before.json')),editsSHA256:sha(fs.readFileSync(prefix+'edits.json')),sourceReadySHA256:sha(fs.readFileSync(prefix+'source-ready.json'))},exactEdits:edits.edits.length,fullForward:true,fullInverse:true,completeTreeInverse:{nodesBothSides:nodes,nodeArraysBothSides:arrays,leavesBothSides:leaves},nonCommentTokensBothSides:scannerLeaves(old).length+scannerLeaves(inverse).length,entryEmits,retainedExports:{beforeClauses:oldClauses.length,currentClauses:newClauses.length,retiredClauses:[...removed],originalRemainingOrderAndTextSame:true,clauses:retained},leafOutputs,controls:ready.controls.map(r=>{assert(sha(fs.readFileSync(r.path))===r.sha256,'control_drift');return r}),initializationFindings:{phaseLeaf:'Actual ES/CJS outputs import Phase through model; class field array copying and Phase default expression run only when external caller constructs or calls the class. Domain already reexports model before the retired clause.',winLeaf:'Actual ES/CJS outputs have no evaluator/World/model runtime imports; only class export and evaluate delegation definition plus CJS export bookkeeping. No top-level World creation, clock read, registration or condition evaluation.',remaining:'Retained export clauses, paths, order and target hashes are listed above. Their modules keep actual prior initialization; deletion does not claim arbitrary namespace/CJS/cold graph equivalence.'},limits:['Actual entry output changes deliberately because two exported public classes and direct module paths retire.','No production module loading, cold run, behavior tests, full typecheck or architecture gate.','The tree/token comparison is the complete precise inverse of the one edited barrel, not a claim that API deletion is pure comment or runtime output equal.','Leaf transpilation establishes only emitted top-level shape; it does not execute or prove arbitrary external reflective compatibility.','Fingerprint source paths/raw bytes change; archives and strict validators are not rewritten.']};
fs.writeFileSync(prefix+'proof.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({source:1,deleted:2,exactEdits:3,fullForward:true,fullInverse:true,treeNodes:nodes,nodeArrays:arrays,treeLeaves:leaves,retainedClauses:newClauses.length,entryActualRawSame:entryEmits.map(r=>r.actualRawSame),entryInverseEmitSame:entryEmits.map(r=>r.preciseInverseRawSame),oldLeafTranspiles:4,controls:5}));
