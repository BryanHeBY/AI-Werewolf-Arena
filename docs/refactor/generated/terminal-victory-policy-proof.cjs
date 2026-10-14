/** 本批局部证明读取完整真实前后源码；只逆明确迁移表达式，不执行玩法、类型门禁或任意回调掩码。 */
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const ts=require('../../../backend/node_modules/typescript');
const p='docs/refactor/generated/terminal-victory-policy-';
const before=JSON.parse(fs.readFileSync(p+'before.json','utf8'));
const edits=JSON.parse(fs.readFileSync(p+'edits.json','utf8')).edits;
const read=x=>fs.readFileSync(x,'utf8'),sha=x=>crypto.createHash('sha256').update(x).digest('hex');
const pmPath=before.source[0].path,old=before.source[0].text,current=read(pmPath);
function assert(x,label){if(!x)throw new Error(label);}
const sf=(name,text)=>ts.createSourceFile(name,text,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS);
const printer=ts.createPrinter({removeComments:true,newLine:ts.NewLineKind.LineFeed});
const print=text=>printer.printFile(sf('proof.ts',text));
function shape(text){let nodes=0,leaves=0;function walk(n){if(ts.isJSDoc(n))return null;nodes++;const children=n.getChildren().filter(n=>!ts.isJSDoc(n));if(!children.length){leaves++;return[n.kind,n.getText()];}return[n.kind,children.map(walk)];}const data=walk(sf('proof.ts',text));return{nodes,leaves,data};}
const emitted=(text,module)=>ts.transpileModule(text,{compilerOptions:{target:ts.ScriptTarget.ES2022,module,removeComments:true}}).outputText;
function completePair(actual,expected){const a=shape(actual),b=shape(expected);assert(JSON.stringify(a.data)===JSON.stringify(b.data),'whole typed tree');return{nodes:b.nodes,nonJSDocLeaves:b.leaves,typedTree:true,printerText:print(actual)===print(expected),outputs:[ts.ModuleKind.ESNext,ts.ModuleKind.CommonJS].map(module=>{const same=emitted(actual,module)===emitted(expected,module);assert(same,'whole emitted output '+module);return{module:ts.ModuleKind[module],same};})};}
let forwarded=old;const stages=edits.map(e=>{assert(forwarded.split(e.before).length-1===e.count,'forward occurrences');const stage={...e,index:forwarded.indexOf(e.before)};forwarded=forwarded.split(e.before).join(e.after);return{...stage,afterText:forwarded};});assert(forwarded===current,'complete exact forward');
let inverse=current;for(const e of [...stages].reverse()){assert(inverse===e.afterText,'actual reverse stage');if(e.after===''){assert(e.count===1,'single exact removal');inverse=inverse.slice(0,e.index)+e.before+inverse.slice(e.index);}else{assert(inverse.split(e.after).length-1===e.count,'exact inverse occurrences');inverse=inverse.split(e.after).join(e.before);}}
assert(inverse===old,'whole PM raw inverse');const fullPM=completePair(inverse,old);
const oldClass=sf(pmPath,old).statements.find(ts.isClassDeclaration);
const method=name=>oldClass.members.find(n=>n.name?.getText()===name);
const policyPath='backend/src/rulesets/terminal-victory-policy.ts',policy=read(policyPath),polysf=sf(policyPath,policy);
const functions=polysf.statements.filter(ts.isFunctionDeclaration);
assert(functions.length===2,'exact two complete algorithms');
const fn=name=>functions.find(n=>n.name.text===name);
const oldConditions=method('resolveWinConditions').body.getText();
let newConditions=fn('resolveConfiguredVictoryConditions').body.getText();
newConditions=newConditions.replaceAll('runtime.world()','this.world').replaceAll('runtime.config()','this.config');
const nonNullCount=(newConditions.match(/this\.config\.(?:winConditions|winCondition)!/g)||[]).length;
assert(nonNullCount===4,'exact newly necessary non-null annotations');
newConditions=newConditions.replace(/this\.config\.(winConditions|winCondition)!/g,'this.config.$1');
const conditions=completePair('class Owner { resolveWinConditions() '+newConditions+' }','class Owner { resolveWinConditions() '+oldConditions+' }');
const seal=method('sealResult').body.statements;
assert(seal[2].kind===ts.SyntaxKind.IfStatement&&ts.isVariableStatement(seal[3]),'old two exact candidate statements');
const expectedCandidate='{\n'+seal[2].getText()+'\n'+seal[3].getText()+'\n}';
let newCandidate=fn('validateTerminalCandidate').body.getText();
assert(newCandidate.includes('return validateVictoryDecision(decision, checkpoint, phase, world, day);'),'whole delegate exact');
newCandidate=newCandidate.replaceAll('world()','this.world').replace('return validateVictoryDecision(decision, checkpoint, phase, world, day);','const { winner, outcome, decidedAt } = validateVictoryDecision(decision, checkpoint, phase, () => this.world, () => this.state.day,);');
const candidate=completePair('class Owner { sealResult() '+newCandidate+' }','class Owner { sealResult() '+expectedCandidate+' }');
const declaration=polysf.statements.find(n=>ts.isVariableStatement(n)&&n.declarationList.declarations.some(d=>d.name.getText()==='TERMINAL_VICTORY_POLICY')).declarationList.declarations[0];
assert(ts.isCallExpression(declaration.initializer)&&declaration.initializer.expression.getText()==='Object.freeze','new frozen table');
const table=declaration.initializer.arguments[0].properties.map(n=>[n.name.getText(),n.initializer.getText()]);
assert(JSON.stringify(table)===JSON.stringify([['conditions','resolveConfiguredVictoryConditions'],['replaceFactionResult','replaceWithFoxVictory'],['validateCandidate','validateTerminalCandidate']]),'table complete direct identities');
const controls=before.controls.map(c=>{assert(sha(c.text)===c.sha256,'before controlhash');assert(read(c.path)===c.text,'control unchanged '+c.path);return{path:c.path,sha256:c.sha256,wholeBytes:true};});
const fix=JSON.parse(read(p+'type-fix.json')),fixAfter=read(fix.path);assert(fixAfter===fix.before.replace(fix.edits[0].before,fix.edits[0].after),'only exact type fix');
const typeFixOutputs=[ts.ModuleKind.ESNext,ts.ModuleKind.CommonJS].map(module=>{const same=emitted(fix.before,module)===emitted(fixAfter,module);assert(same,'new test type erase');return{module:ts.ModuleKind[module],same};});
const options={moduleResolution:ts.ModuleResolutionKind.Node10,module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022};
const facet='backend/src/game/mechanisms/roles/cursed_fox/victory-ports.ts',facetSF=sf(facet,read(facet));
const facetExports=facetSF.statements.filter(ts.isExportDeclaration);assert(facetExports.length===1&&facetExports[0].exportClause.elements.length===1&&facetExports[0].exportClause.elements[0].name.text==='replaceWithFoxVictory','facet no wrapper');
const endpoint=ts.resolveModuleName(facetExports[0].moduleSpecifier.text,path.resolve(facet),options,ts.sys).resolvedModule.resolvedFileName;
assert(path.relative(process.cwd(),endpoint)===before.controls[0].path,'exact original Fox owner');
const oldCalls=[],newCalls=[];
function calls(src,arr){function visit(n){if(ts.isCallExpression(n)&&n.expression.getText(src)==='this.conditionRegistry.evaluateMany')arr.push({argumentCount:n.arguments.length,arguments:n.arguments.map(a=>a.getText(src))});ts.forEachChild(n,c=>{visit(c);});}visit(src);}
calls(sf(pmPath,old),oldCalls);calls(sf(pmPath,current),newCalls);assert(JSON.stringify(oldCalls.map(x=>x.argumentCount))==='[3,4]'&&JSON.stringify(newCalls.map(x=>x.argumentCount))==='[3,4]','two unchanged evaluation arities');
const report={baseline:before.baseline,source:[pmPath,policyPath,facet,fix.path].map(path=>({path,sha256:sha(read(path))})),wholePM:{rawExactInverse:true,...fullPM},conditions:{fullBody:true,newNonNullTypeOnlyCount:nonNullCount,...conditions},candidate:{fullOriginalTwoStatements:true,...candidate},table,facet:{path:facet,physicalOwner:path.relative(process.cwd(),endpoint),directBinding:true},registryCalls:{before:oldCalls,after:newCalls,aritiesSame:true},typeFix:{path:fix.path,beforeSha256:fix.beforeSha256,afterSha256:fix.afterSha256,outputs:typeFixOutputs},controls,limits:['完整PM等价证据是明确规则表达式和import的逆，并非新模块初始化图或任意私有反射调用等价。','新表／查询闭包的分配及读取属于显式内部API变化；不改变World／配置的实际晚读位置。','本批不改变胜利条件算法、Fox算法、结果成员校验或严格档案政策；新源码参与当前构建指纹。']};
fs.writeFileSync(p+'proof.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({wholePM:fullPM,conditions,candidate,registryArities:newCalls.map(x=>x.argumentCount),controls:controls.length,typeFixOutputs}));
