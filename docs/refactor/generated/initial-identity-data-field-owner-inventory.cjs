/** 实际当前源码字面导入／导出／importType／require库存；不扫描冻结历史generated文本或执行模块。 */
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),ts=require('../../../backend/node_modules/typescript');
const prefix='docs/refactor/generated/initial-identity-data-field-owner-',roots=['backend/src','backend/tests','backend/scripts','frontend/src','frontend/tests','packages','tooling'];
const extensions=/\.(?:[cm]?[jt]sx?)$/;let files=0;const sites=[];
const targets=new Set(['dataField']);
function scan(file) {
 const text=fs.readFileSync(file,'utf8');files++;
 const s=ts.createSourceFile(file,text,ts.ScriptTarget.Latest,true,file.endsWith('x')?ts.ScriptKind.TSX:ts.ScriptKind.TS);
 function entry(node,form,specifier,bindings){const physical=specifier.startsWith('.')?path.posix.normalize(path.posix.join(path.posix.dirname(file),specifier)).replace(/\.[cm]?tsx?$/,''):specifier; if(bindings.some(b=>targets.has(b))||['backend/src/game/mechanisms/roles/thief/state','backend/src/game/mechanisms/roles/initial_identity/data-ports'].includes(physical))sites.push({path:file,line:s.getLineAndCharacterOfPosition(node.getStart(s)).line+1,form,specifier,bindings,text:node.getText(s),sha256:crypto.createHash('sha256').update(text).digest('hex')});}
 function walk(n){
  if(ts.isImportDeclaration(n)){const b=n.importClause?.namedBindings;entry(n,'import',n.moduleSpecifier.text,b&&ts.isNamedImports(b)?b.elements.map(e=>e.propertyName?.text??e.name.text):[]);}
  if(ts.isExportDeclaration(n)&&n.moduleSpecifier){const b=n.exportClause;entry(n,'export',n.moduleSpecifier.text,b&&ts.isNamedExports(b)?b.elements.map(e=>e.propertyName?.text??e.name.text):[]);}
  if(ts.isImportTypeNode(n)&&ts.isLiteralTypeNode(n.argument)&&ts.isStringLiteral(n.argument.literal))entry(n,'importType',n.argument.literal.text,n.qualifier?[n.qualifier.getText(s)]:[]);
  if(ts.isImportEqualsDeclaration(n)&&ts.isExternalModuleReference(n.moduleReference)&&n.moduleReference.expression&&ts.isStringLiteral(n.moduleReference.expression))entry(n,'importEquals',n.moduleReference.expression.text,[]);
  if(ts.isCallExpression(n)&&(n.expression.kind===ts.SyntaxKind.ImportKeyword||ts.isIdentifier(n.expression)&&n.expression.text==='require')&&n.arguments[0]&&ts.isStringLiteral(n.arguments[0]))entry(n,n.expression.kind===ts.SyntaxKind.ImportKeyword?'dynamicImport':'require',n.arguments[0].text,[]);
  ts.forEachChild(n,c=>{walk(c);});
 }
 walk(s);
}
function dir(p){if(!fs.existsSync(p))return;for(const d of fs.readdirSync(p,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name))){if(['node_modules','dist','.git','generated'].includes(d.name))continue;const next=path.posix.join(p,d.name);if(d.isDirectory())dir(next);else if(d.isFile()&&extensions.test(d.name))scan(next);}}
roots.forEach(r=>{dir(r);});
const functionSites=sites.filter(s=>s.bindings.some(b=>targets.has(b)));
const report={roots,typedAndJsFiles:files,forms:['named/namespace/default import','named/star export','ImportTypeNode','ImportEquals','dynamic import','require'],sites,functionSites,limits:'仅这些七个当前源码根（packages排node_modules/dist/generated）；字面静态路由，不声称计算specifier或任意动态外部消费者。'};
fs.writeFileSync(prefix+'inventory.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({files,sites:sites.length,functionSites:functionSites.length}));
