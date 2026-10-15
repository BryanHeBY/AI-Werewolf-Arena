/** 仅承接真实首加载／类型失败后的两源精确增量；不复已绿主证明／职责头或执行业务。 */
const fs=require('node:fs'),assert=require('node:assert/strict'),{createHash}=require('node:crypto');
const ts=require('../../../backend/node_modules/typescript');
const prefix='docs/refactor/generated/ordinary-native-badge-request-completion-';
const data=JSON.parse(fs.readFileSync(prefix+'load-type-repair-edits.json','utf8'));
const ready=JSON.parse(fs.readFileSync(prefix+'source-ready.json','utf8'));
const first=JSON.parse(fs.readFileSync(prefix+'first-executed-snapshot.json','utf8'));
const sha=v=>createHash('sha256').update(v).digest('hex');
function parse(text,file){const sf=ts.createSourceFile(file,text,ts.ScriptTarget.Latest,true);assert.deepEqual(sf.parseDiagnostics,[]);return sf;}
function program(sf){let typedNodes=0,nodeArrays=0,nonCommentLeaves=0;const doc=n=>n.kind>=ts.SyntaxKind.FirstJSDocNode&&n.kind<=ts.SyntaxKind.LastJSDocNode;
 function tree(n){typedNodes++;const c=[];ts.forEachChild(n,x=>{if(!doc(x))c.push(tree(x));},a=>{nodeArrays++;c.push(['array',a.length,!!a.hasTrailingComma,a.filter(n=>!doc(n)).map(tree)]);});return[n.kind,c];}
 function token(n){const c=n.getChildren(sf).filter(n=>!doc(n));if(!c.length){nonCommentLeaves++;return[n.kind,n.getText(sf)];}return[n.kind,c.map(token)];}
 return{tree:tree(sf),tokens:token(sf),metrics:{typedNodes,nodeArrays,nonCommentLeaves}};}
const reports=[];
for(const row of data.source){const current=fs.readFileSync(row.path,'utf8');assert.equal(sha(row.beforeText),row.beforeSHA256);assert.equal(sha(current),row.afterSHA256);
 let forward=row.beforeText,inverse=current;
 for(const e of [...row.edits].reverse()){assert.equal(row.beforeText.slice(e.beforeStart,e.beforeEnd),e.before);assert.equal(current.slice(e.afterStart,e.afterEnd),e.after);forward=forward.slice(0,e.beforeStart)+e.after+forward.slice(e.beforeEnd);inverse=inverse.slice(0,e.afterStart)+e.before+inverse.slice(e.afterEnd);}
 assert.equal(forward,current);assert.equal(inverse,row.beforeText);
 const old=parse(row.beforeText,row.path),now=parse(current,row.path),restored=parse(inverse,row.path);assert.deepEqual(program(old),program(restored));
 const unit=row.path.includes('/tests/');
 const outputs=[ts.ModuleKind.ESNext,ts.ModuleKind.CommonJS].map(module=>{const emit=text=>ts.transpileModule(text,{fileName:row.path,compilerOptions:{target:ts.ScriptTarget.ES2022,module,removeComments:true}}).outputText;
 const a=emit(row.beforeText),b=emit(current),c=emit(inverse);assert.equal(c,a);if(unit)assert.equal(b,a);
 return{module:ts.ModuleKind[module],wholeInverseSame:true,actualUnitTypeErasureSame:unit?true:undefined,actualRouteOutputDifferent:unit?undefined:b!==a,beforeSHA256:sha(a),afterSHA256:sha(b),inverseSHA256:sha(c)};});
 reports.push({path:row.path,edits:row.edits.length,before:program(old).metrics,current:program(now).metrics,outputs});
}
for(const row of ready.source)assert.equal(sha(fs.readFileSync(row.path)),row.sha256);
const changed=new Set(data.source.map(r=>r.path));
const unchanged=first.source.filter(r=>!changed.has(r.path)).map(row=>{assert.equal(sha(fs.readFileSync(row.path)),row.sha256);return{path:row.path,sha256:row.sha256};});assert.equal(unchanged.length,3);
const pkgPath='packages/game-contract/package.json',indexPath='packages/game-contract/src/index.ts',identityPath='packages/game-contract/src/identity.ts';
const pkg=JSON.parse(fs.readFileSync(pkgPath,'utf8'));assert.equal(pkg.exports['.'],'./src/index.ts');assert.equal(pkg.exports['./identity'],undefined);
const index=parse(fs.readFileSync(indexPath,'utf8'),indexPath),identity=parse(fs.readFileSync(identityPath,'utf8'),identityPath);
const phaseExport=index.statements.find(n=>ts.isExportDeclaration(n)&&n.moduleSpecifier?.text==='./identity'&&n.exportClause?.elements.some(e=>e.name.text==='Phase'));
assert.ok(phaseExport);
const phase=identity.statements.find(n=>ts.isEnumDeclaration(n)&&n.name.text==='Phase');assert.ok(phase);
const unitPath=data.source.find(r=>r.path.includes('/tests/')).path;
const currentUnit=parse(fs.readFileSync(unitPath,'utf8'),unitPath);let declarations=0;
function walk(n){if(ts.isCallExpression(n)&&ts.isIdentifier(n.expression)&&n.expression.text==='test')declarations++;ts.forEachChild(n,c=>{walk(c);});}walk(currentUnit);assert.equal(declarations,9);
const report={sourceReadySHA256:sha(fs.readFileSync(prefix+'source-ready.json')),firstExecutedSnapshotSHA256:sha(fs.readFileSync(prefix+'first-executed-snapshot.json')),source:ready.source,changed:reports,unchanged,unitDeclarations:declarations,publicRoute:{package:{path:pkgPath,sha256:sha(fs.readFileSync(pkgPath))},root:indexPath,rootSHA256:sha(fs.readFileSync(indexPath)),rootNamedPhaseExport:phaseExport.getText(index),physicalPhaseOwner:identityPath,ownerSHA256:sha(fs.readFileSync(identityPath)),completeEnumSHA256:sha(phase.getText(identity)),oldSubpathNotExported:true},limits:['公共Phase路由修复会改变模块入口／加载，不声称 helper 整体旧新 raw 同；仅单元两纯type增量的两raw实际同。','首9失败全为模块加载，原测试正文未执行；后继Root才重执行9，头／主proof绿不重。','这里只执行纯文本／AST／输出，不加载产品、业务、类型或职责头。']};
fs.writeFileSync(prefix+'load-type-repair.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({changed:reports.length,unchanged:unchanged.length,programs:reports.map(r=>({path:r.path,edits:r.edits,...r.current})),inverseRawOutputs:reports.length*2,unitActualRawSame:2,unitDeclarations:declarations,publicPhaseOwner:identityPath}));
