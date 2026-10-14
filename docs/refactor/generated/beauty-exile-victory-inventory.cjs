/** 核本批 relation 全字面消费；补首 proof 的精确完整路径预筛限制，不重跑程序／运行／类型证明。 */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{execFileSync}=require('node:child_process'),{createHash}=require('node:crypto'),ts=require('../../../backend/node_modules/typescript');
const prefix='docs/refactor/generated/beauty-exile-victory-',target='backend/src/game/mechanisms/roles/wolf_beauty/relation.ts';
const roots=['backend/src','backend/tests','backend/scripts','frontend/src','frontend/tests','packages','tooling'];
const files=execFileSync('rg',['--files',...roots],{encoding:'utf8'}).trim().split('\n').filter(p=>/\.(?:[cm]?[jt]sx?)$/.test(p));
const retired=['captureBeautyExile','resolveBeautyExileVictory','BeautyExileCandidate'],sites=[],failures=[];
function resolves(from,spec){if(!spec.startsWith('.'))return false;const base=path.posix.normalize(path.posix.join(path.posix.dirname(from),spec));return [base,base+'.ts',base+'.mts',base+'.cts',base+'/index.ts'].includes(target);}
for(const p of files){const text=fs.readFileSync(p,'utf8');if(!text.includes('relation'))continue;
 const f=ts.createSourceFile(p,text,ts.ScriptTarget.Latest,true,/\.[jt]sx$/.test(p)?ts.ScriptKind.TSX:undefined);
 function record(n,spec,names,unknown=false){if(!resolves(p,spec))return;const row={path:p,sourceSHA256:createHash('sha256').update(text).digest('hex'),syntax:ts.SyntaxKind[n.kind],module:spec,names,unknown};sites.push(row);if(unknown||names.some(x=>retired.includes(x)))failures.push(row);}
 function visit(n){
  if(ts.isImportDeclaration(n)&&ts.isStringLiteralLike(n.moduleSpecifier)){
   const c=n.importClause?.namedBindings;record(n,n.moduleSpecifier.text,c&&ts.isNamedImports(c)?c.elements.map(e=>e.propertyName?.text??e.name.text):[],!!c&&ts.isNamespaceImport(c));
  }
  if(ts.isExportDeclaration(n)&&n.moduleSpecifier&&ts.isStringLiteralLike(n.moduleSpecifier)){const c=n.exportClause;record(n,n.moduleSpecifier.text,c&&ts.isNamedExports(c)?c.elements.map(e=>e.propertyName?.text??e.name.text):[],!c);}
  if(ts.isImportTypeNode(n)&&ts.isLiteralTypeNode(n.argument)&&ts.isStringLiteralLike(n.argument.literal))record(n,n.argument.literal.text,n.qualifier?[n.qualifier.getText(f).split('.')[0]]:[],!n.qualifier);
  if(ts.isCallExpression(n)&&(n.expression.kind===ts.SyntaxKind.ImportKeyword||ts.isIdentifier(n.expression)&&n.expression.text==='require')&&n.arguments.length===1&&ts.isStringLiteralLike(n.arguments[0]))record(n,n.arguments[0].text,[],true);
  if(ts.isImportEqualsDeclaration(n)&&ts.isExternalModuleReference(n.moduleReference)&&n.moduleReference.expression&&ts.isStringLiteralLike(n.moduleReference.expression))record(n,n.moduleReference.expression.text,[],true);
  ts.forEachChild(n,c=>{visit(c);});
 }
 visit(f);
}
assert.deepEqual(failures,[]);
fs.writeFileSync(prefix+'inventory.json',JSON.stringify({approved:true,roots,extensions:'TS/MTS/CTS/TSX/JS/MJS/CJS/JSX',literalFiles:files.length,forms:['import','export','importType','literal dynamic/require','importEquals'],retiredSymbols:retired,sites,failures,limitation:'只字面静态消费；非字面模块加载和任意模块 namespace 反射不作等价承诺。首 proof inventory 预筛未覆盖同族 ./relation，此补项单独保存，不重写首报告。'},null,2)+'\n');
console.log(JSON.stringify({files:files.length,relationLiteralSites:sites.length,failures:failures.length}));
