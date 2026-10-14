/** 仅核首证明之外的新增调用／类型绑定，保留首全程序收据；不执行玩法或重复全程序比较。 */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto'),ts=require('../../../backend/node_modules/typescript');
const pre='docs/refactor/generated/ordinary-wolf-knife-routing-',read=p=>fs.readFileSync(p,'utf8'),sha=t=>crypto.createHash('sha256').update(t).digest('hex');
const edits=JSON.parse(read(pre+'edits.json')),before=JSON.parse(read(pre+'before.json')),config=ts.readConfigFile(pre+'types-config.json',ts.sys.readFile),opts=ts.parseJsonConfigFileContent(config.config,ts.sys,process.cwd()).options;
function endpoint(spec,file){const r=ts.resolveModuleName(spec,path.resolve(file),opts,ts.sys).resolvedModule;assert.ok(r);return path.relative(process.cwd(),r.resolvedFileName);}
const source=ts.createSourceFile(before.source[0].path,read(before.source[0].path),ts.ScriptTarget.Latest,true);
const imports=source.statements.filter(ts.isImportDeclaration),callerBindings=[];
for(const name of ['resolveOrdinaryWolfKnife','AcceptedWolfKnifeTarget']){const n=imports.find(n=>n.importClause?.namedBindings&&ts.isNamedImports(n.importClause.namedBindings)&&n.importClause.namedBindings.elements.some(e=>e.name.text===name));assert.ok(n);assert.equal(endpoint(n.moduleSpecifier.text,before.source[0].path),edits.newOwner);callerBindings.push({name,physicalOwner:edits.newOwner});}
const contract=imports.find(n=>n.moduleSpecifier.text==='../../stages/night/contracts');assert.ok(contract);
const owner=ts.createSourceFile(edits.newOwner,read(edits.newOwner),ts.ScriptTarget.Latest,true),shared=owner.statements.find(n=>ts.isImportDeclaration(n)&&n.importClause?.namedBindings&&ts.isNamedImports(n.importClause.namedBindings)&&n.importClause.namedBindings.elements.some(e=>e.name.text==='WolfKnifeTargetScope'));assert.ok(shared);
assert.equal(endpoint(shared.moduleSpecifier.text,edits.newOwner),endpoint(contract.moduleSpecifier.text,before.source[0].path));
const originalInlineType=endpoint('../../../../core/domain/night_effects',before.source[0].path),movedInlineType=endpoint('../core/domain/night_effects',edits.newOwner);assert.equal(originalInlineType,movedInlineType);
const report={source:edits.paths.map(p=>({path:p,sha256:sha(read(p))})),callerBindings,sharedScopeContract:endpoint(shared.moduleSpecifier.text,edits.newOwner),originalInlineType,movedInlineType,samePhysicalTypeOwners:true,limits:'仅核新增两binding与类型路径端点，未重复首次完整程序／输出、类型或玩法检查。'};
fs.writeFileSync(pre+'binding-supplement.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
