const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const cp = require('node:child_process');
const ts = require('/home/hby/dev/AI-Werewolf-Arena/backend/node_modules/typescript');
const root = '/home/hby/dev/AI-Werewolf-Arena';
const sha = v => crypto.createHash('sha256').update(v).digest('hex');
const git = args => cp.execFileSync('git', args, {cwd: root});
const base = git(['rev-parse','HEAD']).toString().trim();
const old = ['backend/src/core/domain/registries/phase_registry.ts','backend/src/core/domain/systems/win_condition_system.ts'];
const symbols = ['PhaseRegistry','WinConditionSystem'];
const roots = ['backend/src/','backend/tests/','backend/scripts/','frontend/src/','frontend/tests/','frontend/scripts/','packages/','tooling/','configs.example/','docs/'];
const publicPath = p => !p.split('/').some(x => ['node_modules','.git','.codex','.aws','dist','build','generated','coverage'].includes(x) || x.startsWith('.env')) && (roots.some(r => p.startsWith(r)) || !p.includes('/') || /^(backend|frontend)\/(?:[^/]+\.json|[^/]+\.toml|eslint\.config\.[cm]?js|vite\.config\.ts|playwright\.config\.ts|remotion\.config\.ts|README\.md)$/.test(p));
const all = [...new Set(git(['ls-files','--cached','--others','--exclude-standard','-z']).toString().split('\0').filter(Boolean))].filter(publicPath).filter(p => {try{return fs.lstatSync(path.join(root,p)).isFile();}catch{return false;}}).sort();
const code = all.filter(p => /\.(?:[cm]?[jt]sx?)$/.test(p));
const texts = new Map(all.filter(p => /\.(?:[cm]?[jt]sx?|md|json|toml|ya?ml|html|sh)$/.test(p)).map(p => [p, fs.readFileSync(path.join(root,p),'utf8')]));
const asts = new Map(code.map(p => [p, ts.createSourceFile(p,texts.get(p),ts.ScriptTarget.Latest,true,p.endsWith('.tsx') ? ts.ScriptKind.TSX : p.endsWith('.jsx') ? ts.ScriptKind.JSX : /\.[cm]?js$/.test(p) ? ts.ScriptKind.JS : ts.ScriptKind.TS)]));
const codeSet = new Set(code);
function resolve(from, spec) {
 if (!spec.startsWith('.')) {
  if(spec==='ai-werewolf-arena-backend') return 'backend/src/index.ts';
  return null;
 }
 const v = path.posix.normalize(path.posix.join(path.posix.dirname(from),spec));
 const basePaths = /\.[cm]?js$/.test(v) ? [v,v.replace(/\.[cm]?js$/,'.ts'),v.replace(/\.[cm]?js$/,'.mts'),v.replace(/\.[cm]?js$/,'.cts')] : [v];
 for(const b of basePaths) for(const q of [b,...['.ts','.tsx','.mts','.cts','.js','.jsx','.mjs','.cjs'].map(e=>b+e),...['.ts','.tsx','.mts','.cts','.js','.jsx','.mjs','.cjs'].map(e=>b+'/index'+e)]) if(codeSet.has(q)) return q;
 return null;
}
const line = (sf,n) => sf.getLineAndCharacterOfPosition(n.getStart(sf)).line+1;
const imports = [], exports = [], dynamic = [], mentions = [], configPaths = [];
for(const [p,sf] of asts) {
 const visit = n => {
  const at={path:p,line:line(sf,n)};
  if(ts.isImportDeclaration(n) && ts.isStringLiteralLike(n.moduleSpecifier)) {
   const clause=n.importClause;
   imports.push({...at,kind:'import',specifier:n.moduleSpecifier.text,target:resolve(p,n.moduleSpecifier.text),typeOnly:!!clause?.isTypeOnly,names:clause?.namedBindings && ts.isNamedImports(clause.namedBindings) ? clause.namedBindings.elements.map(e=>({imported:(e.propertyName||e.name).text,local:e.name.text,typeOnly:e.isTypeOnly})) : [], namespace:clause?.namedBindings && ts.isNamespaceImport(clause.namedBindings) ? clause.namedBindings.name.text : null, defaultName:clause?.name?.text||null});
  }
  if(ts.isExportDeclaration(n)&&n.moduleSpecifier&&ts.isStringLiteralLike(n.moduleSpecifier)) exports.push({...at,kind:'export',specifier:n.moduleSpecifier.text,target:resolve(p,n.moduleSpecifier.text),star:!n.exportClause,names:n.exportClause&&ts.isNamedExports(n.exportClause)?n.exportClause.elements.map(e=>({imported:(e.propertyName||e.name).text,exported:e.name.text})):[],namespace:n.exportClause&&ts.isNamespaceExport(n.exportClause)?n.exportClause.name.text:null});
  if(ts.isImportEqualsDeclaration(n)&&ts.isExternalModuleReference(n.moduleReference)&&n.moduleReference.expression) {
   const x=n.moduleReference.expression;
   imports.push({...at,kind:'importEquals',specifier:ts.isStringLiteralLike(x)?x.text:null,target:ts.isStringLiteralLike(x)?resolve(p,x.text):null,names:[],namespace:n.name.text,defaultName:null});
  }
  if(ts.isImportTypeNode(n)&&ts.isLiteralTypeNode(n.argument)&&ts.isStringLiteralLike(n.argument.literal)) imports.push({...at,kind:'importType',specifier:n.argument.literal.text,target:resolve(p,n.argument.literal.text),names:[{imported:n.qualifier?.getText(sf)||'*',local:null}],namespace:null,defaultName:null});
  if(ts.isCallExpression(n)&&(n.expression.kind===ts.SyntaxKind.ImportKeyword||(ts.isIdentifier(n.expression)&&n.expression.text==='require'))) {
   const x=n.arguments[0], literal=x&&ts.isStringLiteralLike(x);
   const parent=ts.isAwaitExpression(n.parent)?n.parent.parent:n.parent;
   const binding=parent&&ts.isVariableDeclaration(parent)?parent.name.getText(sf):null;
   dynamic.push({...at,kind:n.expression.kind===ts.SyntaxKind.ImportKeyword?'dynamicImport':'require',literal:!!literal,specifier:literal?x.text:null,expression:x?.getText(sf)||null,target:literal?resolve(p,x.text):null,binding});
  }
  if(ts.isIdentifier(n)&&symbols.includes(n.text)) mentions.push({...at,identifier:n.text,context:ts.SyntaxKind[n.parent.kind],text:n.parent.getText(sf).slice(0,240)});
  ts.forEachChild(n,visit);
 };
 visit(sf);
}
// Parse-only propagation of the two named declarations through reexports. No production imports, emit or checker.
const exposed=new Map(old.map((p,i)=>[p,new Set([symbols[i]])]));
let changed=true;
while(changed) {
 changed=false;
 for(const r of exports) if(r.target&&exposed.has(r.target)) {
  const names=exposed.get(r.target);
  const add=r.star ? [...names] : r.namespace ? [r.namespace] : r.names.filter(x=>names.has(x.imported)).map(x=>x.exported);
  if(add.length&&!exposed.has(r.path)){exposed.set(r.path,new Set());changed=true;}
  for(const x of add) if(!exposed.get(r.path).has(x)){exposed.get(r.path).add(x);changed=true;}
 }
}
const publicImports=imports.filter(r=>r.target&&exposed.has(r.target));
const publicDynamic=dynamic.filter(r=>r.target&&exposed.has(r.target));
const namespaceRefs=[];
for(const [p,sf] of asts) {
 const ns = new Set(publicImports.filter(r=>r.path===p).flatMap(r=>[r.namespace,r.defaultName].filter(Boolean)));
 for(const r of publicDynamic.filter(r=>r.path===p&&r.binding&&/^[A-Za-z_$][\w$]*$/.test(r.binding))) ns.add(r.binding);
 // Actual BuildLayout-controlled core binding, manually characterized from the complete driver.
 if(p==='tooling/refactor/trace-game.ts')ns.add('core');
 if(!ns.size)continue;
 const seen=new Set();
 const visit=n=>{
  if(ts.isIdentifier(n)&&ns.has(n.text)) {
   const par=n.parent;
   let kind=null, detail=null;
   if(ts.isPropertyAccessExpression(par)&&par.expression===n){kind='member';detail=par.name.text;}
   else if(ts.isElementAccessExpression(par)&&par.expression===n){kind='element';detail=par.argumentExpression.getText(sf);}
   else if((ts.isImportDeclaration(par)||ts.isNamespaceImport(par)||ts.isImportClause(par)||ts.isImportEqualsDeclaration(par)) || (ts.isVariableDeclaration(par)&&par.name===n) || (ts.isBindingElement(par)&&par.name===n) || (ts.isPropertySignature(par)&&par.name===n) || (ts.isPropertyAssignment(par)&&par.name===n) || (ts.isPropertyAccessExpression(par)&&par.name===n)) {}
   else {kind='bare/escape';detail=par.getText(sf).slice(0,240);}
   if(kind){const key=n.pos+':'+kind;if(!seen.has(key)){seen.add(key);namespaceRefs.push({path:p,line:line(sf,n),binding:n.text,kind,detail});}}
  }
  ts.forEachChild(n,visit);
 };
 visit(sf);
}
const textual=[];
for(const [p,t] of texts) t.split('\n').forEach((s,i)=>{if(/PhaseRegistry|WinConditionSystem|phase_registry|win_condition_system/.test(s))textual.push({path:p,line:i+1,text:s.slice(0,400)});});
for(const [p,t] of texts) if(/(?:^|\/)tsconfig[^/]*\.json$/.test(p)) {
 const parsed=ts.parseConfigFileTextToJson(p,t).config;
 if(parsed?.compilerOptions?.paths)configPaths.push({path:p,paths:parsed.compilerOptions.paths});
}
const counts = values => Object.fromEntries([...new Set(values)].sort().map(v=>[v,values.filter(x=>x===v).length]));
const result = {
 schemaVersion:1,kind:'read-only-parse-consumption-audit',fixedHead:base,
 scope:{publicRoots:roots,excludedSegments:['node_modules','.git','.codex','.aws','dist','build','generated','coverage','.env*'],codeExtensions:['ts','tsx','mts','cts','js','jsx','mjs','cjs'],enumeration:'git ls-files cached + untracked exclude-standard; extant regular public files only',publicFiles:all.length,parsedCodeFiles:code.length,textFiles:texts.size,codeByRoot:counts(code.map(p=>p.split('/')[0])),fileListSHA256:sha(all.join('\n')+'\n'),sourceBytesSHA256:sha([...asts.keys()].map(p=>p+'\0'+sha(texts.get(p))).join('\n')+'\n')},
 exportExposure:[...exposed].map(([p,n])=>({path:p,names:[...n]})),reexportRoutes:exports.filter(r=>r.target&&exposed.has(r.target)),
 importsFromExposedModules:publicImports,dynamicImportsFromExposedModules:publicDynamic,namespaceReferences:namespaceRefs,nonliteralModuleCalls:dynamic.filter(r=>!r.literal),candidateIdentifierSites:mentions,candidateTextReferences:textual,tsconfigPaths:configPaths,
 retiredNameImports:publicImports.filter(r=>r.names.some(n=>exposed.get(r.target).has(n.imported))),
 directLeafConsumers:[...publicImports,...publicDynamic].filter(r=>old.includes(r.target)),
 limitations:['Parsing only; no typecheck, emit, tests, architecture check or production loading.','Relative literal module resolution handles TS/JS file extensions and index paths; arbitrary computed module names and external consumers require explicit limits.','Namespace identifier references are syntax/lexical candidates, not checker-resolved symbols; complete relevant source read confirms the driver binding.','Generated history and build outputs are excluded as evidence/distribution artifacts, not treated as executable current consumers.','External package users and caller-supplied BuildLayout modules cannot be proven absent from this workspace.'],
 script:{path:'/tmp/awa-unused-core-facades-exit-audit.cjs',sha256:sha(fs.readFileSync(__filename))}
};
fs.writeFileSync('/tmp/awa-unused-core-facades-exit-audit.json',JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({head:base,publicFiles:all.length,code:code.length,exposed:result.exportExposure,reexports:result.reexportRoutes.length,publicImports:publicImports.length,retiredNameImports:result.retiredNameImports.length,directLeafConsumers:result.directLeafConsumers.length,namespaceReferences:namespaceRefs,nonliteralModuleCalls:result.nonliteralModuleCalls,textReferences:textual.length,identifierSites:mentions.length},null,2));
