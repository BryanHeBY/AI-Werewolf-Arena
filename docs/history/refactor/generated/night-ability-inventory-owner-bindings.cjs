/** 核公开符号、真实声明端点和共同库存的有限静态加载闭包；不加载产品、执行检查器或检查玩法。 */
const fs=require("node:fs"),path=require("node:path"),cp=require("node:child_process"),crypto=require("node:crypto"),ts=require("../../../backend/node_modules/typescript");
const prefix="docs/refactor/generated/night-ability-inventory-owner-",read=n=>JSON.parse(fs.readFileSync(prefix+n+".json","utf8")),hash=x=>crypto.createHash("sha256").update(x).digest("hex");
const before=read("before"),scope=read("paths"),rootFile=path.resolve("backend/src/game/mechanisms/index.ts"),owner=path.resolve("backend/src/game/mechanisms/roles/abilities.ts");
const config=ts.parseJsonConfigFileContent(read("types-config"),ts.sys,process.cwd()),options=config.options;
const overrides=new Map(before.source.map(x=>[path.resolve(x.path),x.text]));
function program(old){const host=ts.createCompilerHost(options),rf=host.readFile,fe=host.fileExists;if(old){host.readFile=f=>overrides.get(path.resolve(f))??rf(f);host.fileExists=f=>overrides.has(path.resolve(f))||fe(f);}return ts.createProgram([rootFile,...scope.filter(x=>x.change!=="delete").map(x=>path.resolve(x.path))],options,host);}
const old=program(true),now=program(false),oldCheck=old.getTypeChecker(),check=now.getTypeChecker();
const moduleExports=(p,c)=>c.getExportsOfModule(c.getSymbolAtLocation(p.getSourceFile(rootFile)));
const oldNames=moduleExports(old,oldCheck).map(x=>x.name).sort(),newNames=moduleExports(now,check).map(x=>x.name).sort();
const canonical=s=>s&&(s.flags&ts.SymbolFlags.Alias)?check.getAliasedSymbol(s):s;
const endpoint=s=>canonical(s)?.declarations?.map(d=>({path:path.relative(process.cwd(),d.getSourceFile().fileName),kind:ts.SyntaxKind[d.kind],name:d.name?.getText(d.getSourceFile())}));
const moved=["commitPreparedNativeAbility","setNightAbilityEnabled","retireBorrowedNightAbility","expireLuckyAbilitiesOnDeath","setNightAbilityStartDay","recordNightAbilityUse"],internal=["commitPreparedNativeAbility","commitGrantedNightAbility","retireTransferredNightAbility","initializeNightAbilityInventory"];
const bindings=[];
for(const x of scope.filter(x=>x.change!=="delete")){
 const source=now.getSourceFile(path.resolve(x.path));
 for(const n of source.statements){
  if(!ts.isImportDeclaration(n)||!n.importClause?.namedBindings||!ts.isNamedImports(n.importClause.namedBindings))continue;
  for(const e of n.importClause.namedBindings.elements){const name=(e.propertyName??e.name).text;if(!moved.includes(name)&&!internal.includes(name))continue;const symbol=check.getSymbolAtLocation(e.name),actual=endpoint(symbol);bindings.push({path:x.path,specifier:n.moduleSpecifier.text,binding:name,local:e.name.text,typeOnly:!!(n.importClause.isTypeOnly||e.isTypeOnly),endpoint:actual,ownerSame:!!actual?.length&&actual.every(d=>path.resolve(d.path)===owner)});}
 }
}
const movedRootExports=moduleExports(now,check).filter(s=>moved.includes(s.name)).map(s=>({name:s.name,endpoint:endpoint(s)}));
const publicSymbolsSame=JSON.stringify(oldNames)===JSON.stringify(newNames),internalNotRoot=internal.every(n=>!newNames.includes(n));
// 同一物理共用 roleOf/emit；不是第二份事实或角色查询政策。
const runtimePath=path.resolve("backend/src/game/mechanisms/roles/night-ability-change-runtime.ts");
const shared=now.getSourceFile(owner).statements.filter(ts.isImportDeclaration).flatMap(n=>n.importClause?.namedBindings&&ts.isNamedImports(n.importClause.namedBindings)?n.importClause.namedBindings.elements.filter(e=>["roleOf","emit"].includes(e.name.text)).map(e=>({name:e.name.text,endpoint:endpoint(check.getSymbolAtLocation(e.name))})):[]);
const roots=["backend/src","backend/tests","backend/scripts","frontend/src","frontend/tests","packages","tooling"],files=cp.execFileSync("rg",["--files",...roots],{encoding:"utf8",maxBuffer:32*1024*1024}).trim().split("\n").filter(f=>/\.[cm]?[jt]sx?$/.test(f));
const retiredSpecifierSites=[];const oldPath="backend/src/game/mechanisms/roles/prepared-native-install";
for(const file of files){const text=fs.readFileSync(file,"utf8"),source=ts.createSourceFile(file,text,ts.ScriptTarget.Latest,true);const visit=n=>{
 let spec,form;
 if((ts.isImportDeclaration(n)||ts.isExportDeclaration(n))&&n.moduleSpecifier&&ts.isStringLiteralLike(n.moduleSpecifier)){spec=n.moduleSpecifier.text;form=ts.isImportDeclaration(n)?"import":"export";}
 else if(ts.isImportEqualsDeclaration(n)&&ts.isExternalModuleReference(n.moduleReference)&&n.moduleReference.expression&&ts.isStringLiteralLike(n.moduleReference.expression)){spec=n.moduleReference.expression.text;form="ImportEquals";}
 else if(ts.isImportTypeNode(n)&&ts.isLiteralTypeNode(n.argument)&&ts.isStringLiteralLike(n.argument.literal)){spec=n.argument.literal.text;form="ImportType";}
 else if(ts.isCallExpression(n)&&n.arguments[0]&&ts.isStringLiteralLike(n.arguments[0])&&(n.expression.kind===ts.SyntaxKind.ImportKeyword||ts.isIdentifier(n.expression)&&n.expression.text==="require")){spec=n.arguments[0].text;form=n.expression.kind===ts.SyntaxKind.ImportKeyword?"dynamic-import":"require";}
 if(spec?.startsWith(".")&&path.posix.normalize(path.posix.join(path.posix.dirname(file),spec)).replace(/\.[cm]?[jt]s$/,"")===oldPath)retiredSpecifierSites.push({path:file,form,specifier:spec});
 ts.forEachChild(n,c=>{visit(c);});
 };visit(source);}
// 由实际 TypeScript 擦除后的 ES 模块 import/export 构造当前有限图；只捕获静态边，不声称历史冷初始化等价。
const nodes=new Map(),edges=[],queue=[owner];
while(queue.length){const file=queue.shift();if(nodes.has(file)||!fs.existsSync(file))continue;const text=fs.readFileSync(file,"utf8");nodes.set(file,{path:path.relative(process.cwd(),file),sha256:hash(text)});const output=ts.transpileModule(text,{fileName:file,compilerOptions:{...options,module:ts.ModuleKind.ESNext,removeComments:true}}).outputText;const source=ts.createSourceFile(file+".js",output,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);
 for(const n of source.statements){if(!(ts.isImportDeclaration(n)||ts.isExportDeclaration(n))||!n.moduleSpecifier||!ts.isStringLiteralLike(n.moduleSpecifier))continue;const spec=n.moduleSpecifier.text,resolved=ts.resolveModuleName(spec,file,options,ts.sys).resolvedModule?.resolvedFileName;if(!resolved||resolved.includes("node_modules")||resolved.endsWith(".d.ts"))continue;const target=path.resolve(resolved);edges.push({from:path.relative(process.cwd(),file),to:path.relative(process.cwd(),target),specifier:spec});queue.push(target);}}
const backToInventory=edges.filter(e=>path.resolve(e.to)===owner);
const failures=[];if(!publicSymbolsSame)failures.push("root public symbol set changed");if(!internalNotRoot)failures.push("internal inventory commit exposed at root");if(bindings.some(b=>!b.ownerSame))failures.push("consumer endpoint differs");if(shared.length!==2||shared.some(x=>x.endpoint?.some(d=>path.resolve(d.path)!==runtimePath)))failures.push("runtime kernel binding differs");if(retiredSpecifierSites.length)failures.push("retired prepared module still consumed");if(backToInventory.length)failures.push("new static inventory return cycle");
const report={baseCommit:before.baseCommit,rootPublicSymbols:{before:oldNames,after:newNames,same:publicSymbolsSame,internalNotRoot},bindings,rootMovedExports:movedRootExports,sharedRuntime:shared,inventory:{roots,files:files.length,forms:["import","export","ImportEquals","ImportType","dynamic-import","require"],retiredSpecifierSites},moduleGraph:{input:"当前工作树、以abilities为根的实际擦除后静态import/export图；不含动态加载或完整历史初始化时序",nodes:[...nodes.values()],edges,backToInventory},failures};fs.writeFileSync(prefix+"bindings.json",JSON.stringify(report,null,2)+"\n");console.log(JSON.stringify({rootSymbols:oldNames.length,publicSymbolsSame,bindings:bindings.length,sharedRuntime:shared.length,files:files.length,graphNodes:nodes.size,graphEdges:edges.length,retiredSpecifierSites:retiredSpecifierSites.length,failures}));if(failures.length)process.exitCode=1;
