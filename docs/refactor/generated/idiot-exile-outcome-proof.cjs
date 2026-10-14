/** 本批完整原钩子、两个真实消费者和唯一公开绑定的有限源码证明；不运行行为、类型或全门禁。 */
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto'), cp = require('node:child_process');
const ts = require('../../../backend/node_modules/typescript');
const prefix = 'docs/refactor/generated/idiot-exile-outcome-';
const read = p => fs.readFileSync(p, 'utf8'), sha = t => crypto.createHash('sha256').update(t).digest('hex');
const check = (ok, message) => { if (!ok) throw Error(message); };
const before = JSON.parse(read(prefix+'before.json')), edits = JSON.parse(read(prefix+'edits.json'));
const source = t => { const sf = ts.createSourceFile('source.ts',t,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS);check(!sf.parseDiagnostics.length,'parse');return sf; };
const printer = ts.createPrinter({removeComments:true});
function shape(t) {
  const sf=source(t);let nodes=0,leaves=0;
  function walk(n) {
    if(n.kind>=ts.SyntaxKind.FirstJSDocNode&&n.kind<=ts.SyntaxKind.LastJSDocNode)return null;
    nodes++;const children=n.getChildren(sf).filter(c=>c.kind<ts.SyntaxKind.FirstJSDocNode||c.kind>ts.SyntaxKind.LastJSDocNode);
    if(!children.length){leaves++;return[n.kind,n.getText(sf)];}
    return[n.kind,children.map(walk)];
  }
  return {tree:walk(sf),nodes,leaves};
}
const emit=(t,m)=>ts.transpileModule(t,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:m,removeComments:true}}).outputText;
function same(a,b,label) {
  const aa=shape(a),bb=shape(b);check(JSON.stringify(aa.tree)===JSON.stringify(bb.tree),label+' full tree/leaves');
  const outputs=[ts.ModuleKind.ESNext,ts.ModuleKind.CommonJS].map(m=>{
    const rawSame=emit(a,m)===emit(b,m),printerMappedSame=emit(printer.printFile(source(a)),m)===emit(printer.printFile(source(b)),m);
    check(printerMappedSame,label+' whole output');return {module:ts.ModuleKind[m],rawSame,printerMappedSame};
  });
  return {nonJSDocNodes:bb.nodes,nonJSDocLeaves:bb.leaves,completeTreeSame:true,outputs};
}
for(const row of [...before.source,...before.controls])check(cp.execFileSync('git',['show',before.baseCommit+':'+row.path]).toString()===row.text&&sha(row.text)===row.sha256,'actual Git '+row.path);
const old=before.source[0],oldSf=source(old.text),owner=read(edits.ownerPath),ownerSf=source(owner);
check(!fs.existsSync(old.path),'old leaf retired');
const body=t=>source(t).statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text===edits.sourceName);
const wholeFunction=same(body(old.text).getText(oldSf),body(owner).getText(ownerSf),'complete original function');
let expected=old.text.slice(old.text.indexOf('import '));
for(const [a,b]of Object.entries(edits.ownerImportReplacements))expected=expected.split(a).join(b);
check(edits.ownerHead+expected===owner,'whole owner exact forward');
const consumers=before.source.slice(1).map(row=>{
  let forward=row.text;for(const e of edits.sourceEdits[row.path]){check(forward.split(e.before).length-1===e.count,'consumer occurrence');forward=forward.split(e.before).join(e.after);}
  check(forward===read(row.path),'whole exact consumer');let inverse=forward;
  for(const e of [...edits.sourceEdits[row.path]].reverse())inverse=inverse.split(e.after).join(e.before);
  check(inverse===row.text,'whole raw inverse consumer');return{path:row.path,sha256:sha(forward),...same(inverse,row.text,row.path),wholeExactForwardInverse:true};
});
const config=JSON.parse(read(prefix+'types-config.json')),options=ts.parseJsonConfigFileContent(config,ts.sys,process.cwd()).options;
function resolve(spec,p) {if(spec.startsWith('node:'))return spec;const r=ts.resolveModuleName(spec,path.resolve(p),options,ts.sys).resolvedModule;check(r,'resolved '+spec);return path.relative(process.cwd(),r.resolvedFileName);}
function imports(p,t) {return source(t).statements.filter(ts.isImportDeclaration).flatMap(n=>ts.isNamedImports(n.importClause?.namedBindings)?n.importClause.namedBindings.elements.map(b=>({name:b.name.text,imported:b.propertyName?.text??b.name.text,specifier:n.moduleSpecifier.text,target:resolve(n.moduleSpecifier.text,p)})):[]);}
const oldImports=imports(old.path,old.text),newImports=imports(edits.ownerPath,owner);
const bindings=oldImports.map(b=>{const next=newImports.find(n=>n.name===b.name);check(next&&next.imported===b.imported,'same binding '+b.name);
  const ultimateTarget=next.target===edits.facetPath?resolve('./authority',edits.facetPath):next.target;
  check(b.target===ultimateTarget,'same physical original owner '+b.name);return{before:b,after:next,ultimateTarget,samePhysicalOriginalOwner:true};});
check(oldImports.length===newImports.length,'all old import bindings');
const facet=source(read(edits.facetPath));check(facet.statements.length===1&&ts.isExportDeclaration(facet.statements[0])&&facet.statements[0].moduleSpecifier.text==='./authority','direct facet');
check(facet.statements[0].exportClause.elements.map(n=>n.name.text).join(',')==='commitDemonIdiotReveal,demonIdiotRevealed','same two exports');
const actualFacet=require(path.resolve(edits.facetPath)),actualAuthority=require(path.resolve(resolve('./authority',edits.facetPath)));
check(actualFacet.commitDemonIdiotReveal===actualAuthority.commitDemonIdiotReveal&&actualFacet.demonIdiotRevealed===actualAuthority.demonIdiotRevealed,'runtime function identities');
const typeBefore=JSON.parse(read(prefix+'unit-type-before.json')),unit=read(typeBefore.path);let inverse=unit;
for(const e of [...typeBefore.edits].reverse()){check(inverse.split(e.after).length-1===e.count,'type inverse count');inverse=inverse.split(e.after).join(e.before);}
check(inverse===typeBefore.text,'whole unit type-only inverse');
const typeOutputs=[ts.ModuleKind.ESNext,ts.ModuleKind.CommonJS].map(m=>{const rawSame=emit(unit,m)===emit(typeBefore.text,m);check(rawSame,'whole unit erased output');return{module:ts.ModuleKind[m],rawSame};});
const controls=before.controls.map(c=>{check(read(c.path)===c.text,'whole stable control '+c.path);return{path:c.path,sha256:c.sha256,wholeBytesSame:true};});
const graph={};function scan(p){if(graph[p]||!fs.existsSync(p)||!(p.startsWith('backend/src/')||p.startsWith('packages/')))return;const text=read(p);const sf=source(emit(text,ts.ModuleKind.ESNext));const edges=sf.statements.filter(n=>(ts.isImportDeclaration(n)||ts.isExportDeclaration(n))&&n.moduleSpecifier&&ts.isStringLiteral(n.moduleSpecifier)).map(n=>resolve(n.moduleSpecifier.text,p));graph[p]={sha256:sha(text),edges};for(const e of edges)scan(e);}
scan(edits.ownerPath);function route(start,target,seen=new Set()){if(start===target)return[start];if(seen.has(start))return null;seen.add(start);for(const e of graph[start]?.edges??[]){const tail=route(e,target,seen);if(tail)return[start,...tail];}return null;}
const returnToOwner=route(resolve('./authority',edits.facetPath),edits.ownerPath);check(!returnToOwner,'new authority return cycle');
const currentPaths=[edits.ownerPath,edits.facetPath,...consumers.map(c=>c.path),typeBefore.path];
const report={baseCommit:before.baseCommit,source:currentPaths.map(p=>({path:p,sha256:sha(read(p))})),deleted:[{path:old.path,sha256:old.sha256,expectedAbsent:true}],originalFunctionLines:body(old.text).getText(oldSf).split('\n').length,wholeFunction,wholeOwnerExactForward:true,consumers,bindings,facet:{path:edits.facetPath,sameRuntimeFunctionReferences:true,implementationOwner:resolve('./authority',edits.facetPath)},unitTypeBridge:{path:typeBefore.path,beforeSha256:typeBefore.sha256,sha256:sha(unit),wholeTypeOnlyInverse:true,outputs:typeOutputs},controls,moduleGraph:{scope:'当前新owner的字面静态值导入闭包；并行源只采样，不声明完整历史或动态初始化相同',modules:Object.keys(graph).length,source:graph,noAuthorityReturnToOwner:true},limits:['旧Idiot私有hook入口真实删除，profile挂载新规则集owner；外部旧specifier不兼容。','完整同步函数体及两个consumer原程序保持，模块路径／公开facet是实际加载/API布局改变，不承诺任意模块重绑定或私有反射等价。','Demon库存、票权、警徽预检及审计写算法仍唯一位于原authority；查询先行或提交异常不吞，已写前缀不退款。']};
fs.writeFileSync(prefix+'proof.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({originalFunctionLines:report.originalFunctionLines,wholeFunction,consumers:consumers.length,bindings:bindings.length,controls:controls.length,staticModules:Object.keys(graph).length,unitTypeOutputs:typeOutputs}));
