/** 核本批完整迁出政策、流水线全文正逆及实际接线，不执行玩法、类型或架构门禁。 */
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const ts = require('../../../backend/node_modules/typescript');
const prefix = 'docs/refactor/generated/order-prince-revote-', read = p => fs.readFileSync(p,'utf8');
const before = JSON.parse(read(prefix+'before.json')), edits = JSON.parse(read(prefix+'edits.json'));
const sha = t => crypto.createHash('sha256').update(t).digest('hex');
const check = (v,m) => { if(!v) throw new Error(m); };
const parse = t => { const s = ts.createSourceFile('program.ts',t,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS); check(!s.parseDiagnostics.length,'parse actual program'); return s; };
const printer = ts.createPrinter({removeComments:true});
function tree(t) {
  const s = parse(t); let nodes=0, leaves=0;
  function walk(n) {
    if(n.kind>=ts.SyntaxKind.FirstJSDocNode && n.kind<=ts.SyntaxKind.LastJSDocNode) return null;
    nodes++; const children=n.getChildren(s).filter(c => c.kind<ts.SyntaxKind.FirstJSDocNode || c.kind>ts.SyntaxKind.LastJSDocNode);
    if(!children.length) { leaves++; return [n.kind,n.getText(s)]; }
    return [n.kind,children.map(walk)];
  }
  return {shape:walk(s),nodes,leaves};
}
const emit = (t,m) => ts.transpileModule(t,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:m,removeComments:true}}).outputText;
// TS printer 保留节点的原换行布局；只统一完整 AST 的词间空白，并复核全部 typed tree，字面不裁剪。
function canonical(t) {
  const shape=tree(t); const texts=[];
  function collect(n) { if(!n)return; if(typeof n[1]==='string') texts.push(n[1]); else n[1].forEach(c=>{collect(c);}); }
  collect(shape.shape); const result=texts.join(' ');
  check(JSON.stringify(tree(result).shape)===JSON.stringify(shape.shape),'canonical all typed tree unchanged');
  return result;
}
function compare(a,b,label) {
  const aa=tree(a),bb=tree(b); check(JSON.stringify(aa.shape)===JSON.stringify(bb.shape),label+' complete nonJSDoc tree');
  const outputs=[ts.ModuleKind.ESNext,ts.ModuleKind.CommonJS].map(m=> {
    const actualRawSame=emit(a,m)===emit(b,m),printerMappedSame=emit(printer.printFile(parse(a)),m)===emit(printer.printFile(parse(b)),m),completeTokenWhitespaceMappedRawSame=emit(canonical(a),m)===emit(canonical(b),m);
    check(completeTokenWhitespaceMappedRawSame,label+' entire emitted program');
    return {module:ts.ModuleKind[m],actualRawSame,printerMappedSame,completeTokenWhitespaceMappedRawSame};
  });
  return {nonJSDocNodes:aa.nodes,nonJSDocLeaves:aa.leaves,completeTreeSame:true,outputs};
}
const old=before.source[0]; let forward=old.text; const stages=[];
for(const e of edits.edits) { check(forward.split(e.before).length-1===e.count,'unique forward edit'); const previous=forward; forward=forward.replace(e.before,e.after); stages.push({previous,next:forward,e}); }
check(forward===read(old.path),'actual entire Pipeline forward');
let inverse=forward;
for(const stage of [...stages].reverse()) {
  check(inverse===stage.next,'full intermediate inverse');
  if(stage.e.after==='') { const at=stage.previous.indexOf(stage.e.before); inverse=inverse.slice(0,at)+stage.e.before+inverse.slice(at); }
  else { check(inverse.split(stage.e.after).length-1===stage.e.count,'unique inverse edit'); inverse=inverse.replace(stage.e.after,stage.e.before); }
  check(inverse===stage.previous,'full inverse intermediate bytes');
}
check(inverse===old.text,'complete original Git Pipeline bytes');
const pipeline=compare(inverse,old.text,'whole Pipeline');
const ownerPath='backend/src/rulesets/order-prince-revote.ts', ownerText=read(ownerPath), owner=parse(ownerText);
const fn=owner.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text==='recollectOrderPrinceVotes');
check(fn?.asteriskToken && fn.body.statements.length===2 && ts.isIfStatement(fn.body.statements[0]),'whole actual generator body');
const last=fn.body.statements[1]; check(ts.isReturnStatement(last)&&last.expression?.getText(owner)==='undefined','only explicit skipped completion');
const f=ts.factory;
const sourceOptions={runtime:'options'};
function originalPolicyTransformer(context) {
  function visit(n) {
    if(ts.isAsExpression(n) && ts.isParenthesizedExpression(n.expression) && ts.isYieldExpression(n.expression.expression))
      return f.createAwaitExpression(ts.visitNode(n.expression.expression.expression,visit));
    if(ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression) && n.expression.expression.getText(owner)==='runtime') {
      if(n.expression.name.text==='collectVotes')
        return f.createCallExpression(f.createPropertyAccessExpression(f.createThis(),'collectVotes'),undefined,[...n.arguments.map(a=>ts.visitNode(a,visit)),f.createIdentifier('requests'),f.createIdentifier('actionProvider'),f.createIdentifier('options')]);
      if(n.expression.name.text==='recordVotes')
        return f.createCallExpression(f.createPropertyAccessExpression(f.createThis(),'recordVotesInSeatOrder'),undefined,[...n.arguments.map(a=>ts.visitNode(a,visit)),f.createPropertyAccessExpression(f.createIdentifier('options'),'day'),f.createTrue()]);
    }
    if(ts.isReturnStatement(n) && n.expression && ts.isCallExpression(n.expression) && n.expression.expression.getText(owner)==='runtime.recordVotes')
      return f.createExpressionStatement(f.createParenthesizedExpression(f.createBinaryExpression(f.createObjectLiteralExpression([f.createShorthandPropertyAssignment('tally'),f.createShorthandPropertyAssignment('publicVotes')]),f.createToken(ts.SyntaxKind.EqualsToken),ts.visitNode(n.expression,visit))));
    if(ts.isPropertyAccessExpression(n) && n.expression.getText(owner)==='runtime') {
      const key=n.name.text;
      if(['world','toolGateway','events'].includes(key)) return f.createPropertyAccessExpression(f.createThis(),key);
      if(['config','requests','actionProvider','options'].includes(key)) return f.createIdentifier(key);
    }
    return ts.visitEachChild(n,visit,context);
  }
  return root=>ts.visitNode(root,visit);
}
const transformed=ts.transform(fn.body.statements[0],[originalPolicyTransformer]);
const mapped=printer.printNode(ts.EmitHint.Unspecified,transformed.transformed[0],owner);
transformed.dispose();
const wrap=t=>'async function originalPolicy() {\n'+t+'\n}\n';
const actualOwnerBody=compare(printer.printFile(parse(wrap(mapped))),printer.printFile(parse(wrap(edits.originalPolicy))),'actual complete moved policy');
// 反例改非首 child 的错误字面，确认强 walk 不会只看到首个节点。
const mutated=wrap(edits.originalPolicy).replace('order_prince_revote_stale','counterexample_stale');
check(JSON.stringify(tree(mutated).shape)!==JSON.stringify(tree(wrap(edits.originalPolicy)).shape),'nonfirst literal mutation detected');
const sf=parse(forward), klass=sf.statements.find(n=>ts.isClassDeclaration(n)&&n.name?.text==='VotingPipeline'), execute=klass.members.find(n=>ts.isMethodDeclaration(n)&&n.name.getText(sf)==='execute');
const collection=execute.body.statements.find(n=>ts.isVariableStatement(n)&&n.declarationList.declarations[0].name.getText(sf)==='revote').declarationList.declarations[0].initializer;
check(ts.isCallExpression(collection)&&collection.expression.getText(sf)==='recollectOrderPrinceVotes'&&collection.arguments.length===1&&ts.isObjectLiteralExpression(collection.arguments[0]),'actual narrow composition call');
const runtime=collection.arguments[0]; const routing=runtime.properties.map(n=>({name:n.name.getText(sf),body:n.body?.getText(sf)}));
const methods=runtime.properties.filter(ts.isMethodDeclaration);
check(methods.length===2,'only two generic voting method invocations');
check(methods.find(n=>n.name.getText(sf)==='collectVotes').body.statements[0].expression.getText(sf)==='revotePipeline.collectVotes(voters, requests, actionProvider, options)','actual callee receiver and collection parameters');
check(methods.find(n=>n.name.getText(sf)==='recordVotes').body.statements[0].expression.getText(sf)==='revotePipeline.recordVotesInSeatOrder(votes, options.day, true)','actual late day and strict record');
check(runtime.properties.find(n=>ts.isSetAccessor(n)&&n.name.getText(sf)==='options').body.statements[0].expression.getText(sf)==='options = next','caller same mutable options binding');
const loop=execute.body.statements.find(ts.isWhileStatement);
check(loop.expression.getText(sf)==='!revoteStep.done'&&loop.statement.statements.length===1&&loop.statement.statements[0].expression.getText(sf)==='revoteStep = revote.next(await revoteStep.value)','only yielded original Promise await driver');
function imports(t) {
  const s=parse(t), rows=[];
  for(const n of s.statements) if(ts.isImportDeclaration(n) && n.importClause?.namedBindings && ts.isNamedImports(n.importClause.namedBindings))
    for(const b of n.importClause.namedBindings.elements) rows.push({local:b.name.text,imported:b.propertyName?.text??b.name.text,specifier:n.moduleSpecifier.text,typeOnly:n.importClause.isTypeOnly||b.isTypeOnly});
  return rows;
}
const previous=imports(old.text),current=imports(forward), removed=previous.filter(p=>!current.some(c=>c.local===p.local)), added=current.filter(c=>!previous.some(p=>c.local===p.local));
check(removed.length===3&&removed.every(p=>['Role','assertOrderPrinceOriginalCurrent','runOrderPrinceChoice'].includes(p.local))&&added.length===1&&added[0].local==='recollectOrderPrinceVotes','exact import change');
const retained=previous.filter(p=>!removed.includes(p));check(retained.every(p=>current.some(c=>JSON.stringify(c)===JSON.stringify(p))),'all other imports binding/mode retained');
const opts=ts.parseJsonConfigFileContent(JSON.parse(read(prefix+'types-config.json')),ts.sys,process.cwd()).options;
const resolve=(specifier,file)=>{const r=ts.resolveModuleName(specifier,path.resolve(file),opts,ts.sys).resolvedModule;check(r,'actual endpoint '+specifier);return path.relative(process.cwd(),r.resolvedFileName);};
const facetPath='backend/src/game/mechanisms/roles/order_prince/voting-ports.ts',facet=parse(read(facetPath));
const contributionBindings=[];
for(const binding of ['runOrderPrinceChoice','assertOrderPrinceOriginalCurrent']) {
  const from=previous.find(n=>n.local===binding),exported=facet.statements.find(n=>ts.isExportDeclaration(n)&&n.exportClause&&ts.isNamedExports(n.exportClause)&&n.exportClause.elements.some(e=>e.name.text===binding));
  check(exported,'explicit original contribution binding');
  const previousEndpoint=resolve(from.specifier,old.path),currentEndpoint=resolve(exported.moduleSpecifier.text,facetPath);
  check(previousEndpoint===currentEndpoint,'actual same physical function owner');contributionBindings.push({binding,previousEndpoint,currentEndpoint});
}
const typeImport=imports(ownerText).find(n=>n.local==='VotingPipelineOptions');check(typeImport.typeOnly,'reverse engine contract erased');
const ownerES=emit(ownerText,ts.ModuleKind.ESNext),ownerCJS=emit(ownerText,ts.ModuleKind.CommonJS);check(!ownerES.includes('phase_pipeline')&&!ownerCJS.includes('phase_pipeline'),'no runtime return edge to Pipeline');
const controls=before.controls.map(c=>{check(read(c.path)===c.text&&sha(c.text)===c.sha256,'stable whole control '+c.path);return {path:c.path,sha256:c.sha256,wholeBytesSame:true};});
const report={baseCommit:before.baseCommit,source:JSON.parse(read(prefix+'paths.json')).map(p=>({path:p,sha256:sha(read(p))})),pipeline:{preciseEdits:edits.edits.length,fullRawForwardInverse:true,...pipeline},actualMovedPolicy:{originalPhysicalLines:edits.originalPolicy.split('\n').length-1,completeNewOwnerInverse:actualOwnerBody,nonfirstLiteralMutationDetected:true},actualRouting:routing,imports:{previousCount:previous.length,retainedCount:retained.length,retainedSame:true,removed,added,contributionBindings,typeOnlyEngineContract:typeImport,noEmittedReturnEdge:true},controls,limits:['完整29行业务（捕获含闭块30个物理行）逐实际新owner逆映射；helper新增返回协议和运行适配对象是明确内部API/布局差异。','原窗口、收票、PK、Animal、Noble及投票结果算法全文保留；不宣称整个旧新模块raw输出相同。','新增 ruleset/facet 改静态加载路径，erased type不会产生运行返回边；未证明任意CJS namespace替换或全部冷入口等价。']};
fs.writeFileSync(prefix+'proof.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({pipeline:report.pipeline,actualMovedPolicy:report.actualMovedPolicy,retainedBindings:retained.length,contributions:contributionBindings,controls:controls.length}));
