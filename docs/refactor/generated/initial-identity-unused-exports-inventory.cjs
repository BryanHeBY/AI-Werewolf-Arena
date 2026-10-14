/** 在删除前完整解析七源码根的静态引用／导出；不按符号文本预筛，不执行模块、类型或门禁。 */
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),ts=require('../../../backend/node_modules/typescript');
const pre='docs/refactor/generated/initial-identity-unused-exports-',before=JSON.parse(fs.readFileSync(pre+'before.json','utf8'));
const roots=['backend/src','backend/tests','backend/scripts','frontend/src','frontend/tests','packages','tooling'];
const names=['sameThiefScope','sameShapeshifterScope','bindThiefRequest','bindShapeshifterRequest','readThiefCard','readShapeshifterCard'],wanted=new Set(names),paths=new Set(before.source.map(r=>r.path)),occurrences=[],moduleSites=[],namespaceUses=[],embeddedStrings=[];let files=0;
function physical(specifier,file) {if(!specifier.startsWith('.'))return specifier;const bare=path.posix.normalize(path.posix.join(path.posix.dirname(file),specifier));for(const p of [bare,bare+'.ts',bare+'.tsx',bare+'.js',bare+'/index.ts'])if(fs.existsSync(p))return p;return bare;}
function scan(file) {
 const text=fs.readFileSync(file,'utf8'),sha256=crypto.createHash('sha256').update(text).digest('hex');files++;
 const sf=ts.createSourceFile(file,text,ts.ScriptTarget.Latest,true,file.endsWith('x')?ts.ScriptKind.TSX:ts.ScriptKind.TS),namespaces=new Set();
 function site(node,form,specifier,bindings,namespace) {const endpoint=physical(specifier,file);if(!paths.has(endpoint)&&!bindings.some(b=>wanted.has(b.imported)))return;const row={path:file,line:sf.getLineAndCharacterOfPosition(node.getStart(sf)).line+1,form,specifier,endpoint,bindings,namespace,sha256,text:node.getText(sf)};moduleSites.push(row);if(namespace)namespaces.add(namespace);}
 function visit(n) {
  if(ts.isImportDeclaration(n)) {const b=n.importClause?.namedBindings;site(n,'import',n.moduleSpecifier.text,b&&ts.isNamedImports(b)?b.elements.map(e=>({local:e.name.text,imported:e.propertyName?.text??e.name.text,typeOnly:n.importClause.isTypeOnly||e.isTypeOnly})):[],b&&ts.isNamespaceImport(b)?b.name.text:undefined);}
  if(ts.isExportDeclaration(n)&&n.moduleSpecifier) {const b=n.exportClause;site(n,b?'namedExport':'starExport',n.moduleSpecifier.text,b&&ts.isNamedExports(b)?b.elements.map(e=>({local:e.name.text,imported:e.propertyName?.text??e.name.text,typeOnly:n.isTypeOnly||e.isTypeOnly})):[]);}
  if(ts.isImportTypeNode(n)&&ts.isLiteralTypeNode(n.argument)&&ts.isStringLiteral(n.argument.literal))site(n,'importType',n.argument.literal.text,n.qualifier?[{local:n.qualifier.getText(sf),imported:n.qualifier.getText(sf)}]:[]);
  if(ts.isImportEqualsDeclaration(n)&&ts.isExternalModuleReference(n.moduleReference)&&n.moduleReference.expression&&ts.isStringLiteral(n.moduleReference.expression))site(n,'importEquals',n.moduleReference.expression.text,[],n.name.text);
  if(ts.isCallExpression(n)&&(n.expression.kind===ts.SyntaxKind.ImportKeyword||ts.isIdentifier(n.expression)&&n.expression.text==='require')&&n.arguments[0]&&ts.isStringLiteral(n.arguments[0]))site(n,n.expression.kind===ts.SyntaxKind.ImportKeyword?'dynamicImport':'require',n.arguments[0].text,[]);
  if(ts.isIdentifier(n)&&wanted.has(n.text)) {const declaration=ts.isVariableDeclaration(n.parent)&&n.parent.name===n&&paths.has(file);occurrences.push({path:file,line:sf.getLineAndCharacterOfPosition(n.getStart(sf)).line+1,name:n.text,kind:declaration?'originalDeclaration':'reference',text:n.parent.getText(sf),sha256});}
  if((ts.isStringLiteral(n)||ts.isNoSubstitutionTemplateLiteral(n)||ts.isTemplateExpression(n))&&names.some(name=>n.getText(sf).includes(name)))embeddedStrings.push({path:file,line:sf.getLineAndCharacterOfPosition(n.getStart(sf)).line+1,text:n.getText(sf),sha256});
  ts.forEachChild(n,c=>{visit(c);});
 }
 visit(sf);
 // 命名空间消费单独列明，包括反射／对象传递；不能仅因没有named import就漏掉namespace旧API使用。
 function uses(n) {if(ts.isIdentifier(n)&&namespaces.has(n.text)&&!(ts.isNamespaceImport(n.parent)||ts.isImportEqualsDeclaration(n.parent))){namespaceUses.push({path:file,namespace:n.text,line:sf.getLineAndCharacterOfPosition(n.getStart(sf)).line+1,text:n.parent.getText(sf),form:ts.isPropertyAccessExpression(n.parent)&&n.parent.expression===n?'property':ts.isElementAccessExpression(n.parent)&&n.parent.expression===n?'element':'other'});}ts.forEachChild(n,c=>{uses(c);});}
 uses(sf);
}
function dir(p) {if(!fs.existsSync(p))return;for(const item of fs.readdirSync(p,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name))){if(['node_modules','dist','.git','generated'].includes(item.name))continue;const next=path.posix.join(p,item.name);if(item.isDirectory())dir(next);else if(item.isFile()&&/\.(?:[cm]?[jt]sx?)$/.test(item.name))scan(next);}}
roots.forEach(r=>{dir(r);});
const declarations=occurrences.filter(r=>r.kind==='originalDeclaration'),references=occurrences.filter(r=>r.kind!=='originalDeclaration'),namedConsumers=moduleSites.filter(r=>r.bindings.some(b=>wanted.has(b.imported)));
const report={baseCommit:before.baseCommit,roots,files,names,originalDeclarations:declarations,namedConsumers,references,embeddedStrings,moduleSites,namespaceUses,zeroStaticConsumers:namedConsumers.length===0&&references.length===0&&embeddedStrings.length===0,limits:['完整AST解析这些七个当前源码根，排node_modules/dist/generated；仓外、运行计算specifier／字段与任意CJS反射API不作保证。','模板内constructor冷启动脚本另人工读原architecture用例；原两个类仍保留，不改该测试。','命名空间其它旧函数访问明确记录，未把四完整模块当dead facade或整退。']};
if(declarations.length!==6||!names.every(name=>declarations.filter(r=>r.name===name).length===1)||!report.zeroStaticConsumers)throw Error('actual consumer or unexpected declaration count');fs.writeFileSync(pre+'inventory-before.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({files,originalDeclarations:declarations.length,namedConsumers:namedConsumers.length,references:references.length,embeddedStrings:embeddedStrings.length,moduleSites:moduleSites.length,namespaceUses:namespaceUses.length,zeroStaticConsumers:report.zeroStaticConsumers}));
