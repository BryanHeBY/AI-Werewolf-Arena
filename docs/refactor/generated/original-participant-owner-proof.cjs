/** 负责核完整参与者声明和全部实际接线；输入真实 Git 前文与精确编辑，不加载生产或执行游戏。 */
const fs = require('node:fs'), assert = require('node:assert/strict'), path = require('node:path');
const {createHash} = require('node:crypto'), ts = require('../../../backend/node_modules/typescript');
const prefix = 'docs/refactor/generated/original-participant-owner-';
const before = JSON.parse(fs.readFileSync(prefix+'before.json','utf8'));
const edits = JSON.parse(fs.readFileSync(prefix+'edits.json','utf8'));
const paths = JSON.parse(fs.readFileSync(prefix+'paths.json','utf8'));
const sha = x => createHash('sha256').update(x).digest('hex');
const parse = (text,file) => ts.createSourceFile(file,text,ts.ScriptTarget.Latest,true);
let nodes=0, leaves=0;
function tree(n,source) {
  nodes++; const children=[];
  ts.forEachChild(n,c=>{if(c.kind<ts.SyntaxKind.FirstJSDocNode||c.kind>ts.SyntaxKind.LastJSDocNode)children.push(tree(c,source));},a=>{children.push(['NodeArray',...a.map(x=>tree(x,source))]);});
  if(!children.length){leaves++;return[n.kind,n.getText(source)];}
  return[n.kind,...children];
}
const names = {DebateParticipant:'OriginalParticipant',captureDebateParticipant:'captureOriginalParticipant',sameDebateParticipant:'sameOriginalParticipant'};
const oldAuthority=before.source.find(x=>x.path.endsWith('/debater/authority.ts'));
const ownerPath=paths[0],ownerText=fs.readFileSync(ownerPath,'utf8'),owner=parse(ownerText,ownerPath);
const old=parse(oldAuthority.text,oldAuthority.path);
const declarations=[];
for(const [oldName,newName]of Object.entries(names)){
  const a=old.statements.find(x=>x.name?.text===oldName),b=owner.statements.find(x=>x.name?.text===newName);assert.ok(a&&b);
  let mapped=b.getText(owner);for(const [original,canonical]of Object.entries(names))mapped=mapped.replace(new RegExp('\\b'+canonical+'\\b','g'),original);
  const mappedSource=parse(mapped,ownerPath);assert.deepEqual(tree(a,old),tree(mappedSource.statements[0],mappedSource));
  declarations.push({oldName,newName,completeDeclarationSameAfterNameMapping:true});
}
const emit=(text,module)=>ts.transpileModule(text,{compilerOptions:{target:ts.ScriptTarget.ES2022,module,removeComments:true}}).outputText;
const source=[],whole=[],outputs=[];
for(const x of before.source){
  if(!x.text)continue;
  const current=fs.readFileSync(x.path,'utf8');assert.equal(sha(x.text),x.sha256);
  let f=x.text,r=current;const rows=edits.filter(e=>e.path===x.path);
  for(const e of rows){assert.equal(f.split(e.before).length,2);f=f.replace(e.before,e.after);}
  for(const e of [...rows].reverse()){const at=e.offsetAtApplication;assert.equal(r.slice(at,at+e.after.length),e.after);r=r.slice(0,at)+e.before+r.slice(at+e.after.length);}
  assert.equal(f,current);assert.equal(r,x.text);
  assert.deepEqual(tree(parse(r,x.path),parse(r,x.path)),tree(parse(x.text,x.path),parse(x.text,x.path)));
  for(const module of [ts.ModuleKind.ESNext,ts.ModuleKind.CommonJS]){
    assert.equal(emit(r,module),emit(x.text,module));outputs.push({path:x.path,module:ts.ModuleKind[module],completeInverseRawSame:true,actualRawSame:emit(current,module)===emit(x.text,module)});
  }
  whole.push({path:x.path,exactCompleteForwardInverse:true,edits:rows.length});
}
// 直接具名导入导航到新文件的实际 export 声明；不将标签或 barrel 视作物理 owner。
const bindings=[];
for(const file of paths.filter(x=>x!==ownerPath)){
  const text=fs.readFileSync(file,'utf8'),sf=parse(text,file);
  for(const statement of sf.statements.filter(ts.isImportDeclaration)){
    if(!statement.moduleSpecifier.text.endsWith('/original-participant'))continue;
    const resolved=path.resolve(path.dirname(file),statement.moduleSpecifier.text)+'.ts';assert.equal(resolved,path.resolve(ownerPath));
    for(const element of statement.importClause.namedBindings.elements){
      const imported=element.propertyName?.text??element.name.text;assert.ok(owner.statements.some(x=>x.name?.text===imported&&x.modifiers?.some(m=>m.kind===ts.SyntaxKind.ExportKeyword)));
      bindings.push({path:file,imported,local:element.name.text,typeOnly:!!statement.importClause.isTypeOnly||!!element.isTypeOnly,physicalOwner:ownerPath});
    }
  }
}
const currentAuthority=parse(fs.readFileSync(oldAuthority.path,'utf8'),oldAuthority.path);
assert.ok(!currentAuthority.statements.some(x=>x.name&&Object.keys(names).includes(x.name.text)));
const imports=owner.statements.filter(ts.isImportDeclaration).map(x=>({route:x.moduleSpecifier.text,typeOnly:!!x.importClause.isTypeOnly}));
assert.ok(imports.every(x=>x.route.startsWith('./')));
for(const control of before.controls)assert.equal(sha(fs.readFileSync(control.path)),control.sha256);
for(const file of paths)source.push({path:file,sha256:sha(fs.readFileSync(file))});
const result={baseCommit:before.baseCommit,source,deleted:[],completeOwnedDeclarations:declarations,whole,outputs,cumulativeTypedComparisons:nodes,cumulativeASTLeaves:leaves,physicalBindings:bindings,ownerImports:imports,oldThreeAuthorityExportsRetired:true,controls:before.controls.map(({text,...x})=>x),limits:['Actual import paths and module API change; only inverse/mapped programs match original, not arbitrary CJS namespace reassignment.','OriginalPlayerScope stricter ref/descriptor/brand policy is a whole-byte control and is not merged.','No all-repo cold execution or Camp sole-source policy.']};
fs.writeFileSync(prefix+'proof.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({whole:whole.length,owned:declarations.length,rawOutputs:outputs.length,bindings:bindings.length,nodes,leaves}));
