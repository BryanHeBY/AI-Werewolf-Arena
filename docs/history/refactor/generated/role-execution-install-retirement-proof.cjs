/** 核初始身份原完整程序及声明的安装退休差分；输入冻结前稿和精确编辑，输出结构证据，不运行窗口或全门禁。 */
const fs = require('node:fs'), assert = require('node:assert/strict'), ts = require('../../../backend/node_modules/typescript'), {createHash} = require('node:crypto');
const prefix = 'docs/refactor/generated/role-execution-install-retirement-';
const read = name => JSON.parse(fs.readFileSync(prefix + name + '.json', 'utf8'));
const sha = text => createHash('sha256').update(text).digest('hex');
const before = read('before-expanded'), edits = read('edits'), paths = read('paths');
function parse(text, name) {
  const source = ts.createSourceFile(name, text, ts.ScriptTarget.Latest, true);
  assert.equal(source.parseDiagnostics.length, 0);
  return source;
}
function program(text, name) {
  const source = parse(text, name); let nodes = 0, arrays = 0, leaves = 0;
  function typed(node) {
    nodes++; const children = [];
    ts.forEachChild(node, child => { children.push(typed(child)); }, array => {
      arrays++; children.push(['NodeArray', array.length, !!array.hasTrailingComma, ...array.map(typed)]);
    });
    return [node.kind, children];
  }
  function tokens(node) {
    const children = node.getChildren(source).filter(n => n.kind < ts.SyntaxKind.FirstJSDocNode || n.kind > ts.SyntaxKind.LastJSDocNode);
    if (!children.length) { leaves++; return [node.kind, node.getText(source)]; }
    return [node.kind, children.map(tokens)];
  }
  const tree = typed(source), noncommentTree = tokens(source), tags = [];
  function docs(node) { for (const d of node.jsDoc ?? []) for (const t of d.tags ?? []) tags.push([t.kind,t.getText(source)]); ts.forEachChild(node,n => { docs(n); }); }
  docs(source); return {tree,noncommentTree,tags,nodes,arrays,leaves};
}
const old = before.source.find(x => !x.new), now = fs.readFileSync(old.path, 'utf8');
assert.equal(sha(old.text),old.sha256);
let forward = old.text; const applied = [];
for (const edit of edits) {
  assert.equal(edit.path,old.path); assert.equal(forward.split(edit.before).length,2);
  const offset = forward.indexOf(edit.before); applied.push({...edit,offset});
  forward = forward.slice(0,offset) + edit.after + forward.slice(offset+edit.before.length);
}
assert.equal(forward,now);
let inverse = now;
for (const edit of [...applied].reverse()) {
  assert.equal(inverse.slice(edit.offset,edit.offset+edit.after.length),edit.after);
  inverse = inverse.slice(0,edit.offset) + edit.before + inverse.slice(edit.offset+edit.after.length);
}
assert.equal(inverse,old.text);
const original = program(old.text,old.path), restored = program(inverse,old.path); assert.deepEqual(original,restored);
const current = parse(now,old.path); let core;
function locate(node) {
  if (ts.isTryStatement(node) && node.catchClause?.block.getText(current).includes('retireRoleExecution(newRole)')) {
    assert.equal(core,undefined); core = node;
  }
  ts.forEachChild(node,n => { locate(n); });
}
locate(current); assert.ok(core);
assert.deepEqual(core.tryBlock.statements.map(n=>n.getText(current)),[
  'this.world.addComponent(actorId, COMPONENT.Role, newRole);',
  'this.world.addComponent(actorId, COMPONENT.Camp, newCamp);',
  'this.world.addComponent(actorId, COMPONENT.Victory, newVictory);',
]);
assert.deepEqual(core.catchClause.block.statements.map(n=>n.getText(current)),['retireRoleExecution(newRole);','throw error;']);
const corePath = paths[1], coreText = fs.readFileSync(corePath,'utf8'), authority = parse(coreText,corePath);
const imports = authority.statements.filter(ts.isImportDeclaration); assert.equal(imports.length,1); assert.equal(imports[0].importClause.isTypeOnly,true);
assert.equal(imports[0].moduleSpecifier.text,'./components/role');
const declarations = authority.statements.filter(ts.isFunctionDeclaration);
assert.deepEqual(declarations.map(n=>n.name.text),['retireRoleExecution','isRoleExecutionRetired']);
assert.deepEqual(declarations.map(n=>n.body.statements.map(s=>s.getText(authority))),[['retiredExecutions.add(role);'],['return retiredExecutions.has(role);']]);
const variables = authority.statements.filter(ts.isVariableStatement); assert.equal(variables.length,1);
assert.equal(variables[0].declarationList.declarations[0].initializer.getText(authority),'new WeakSet<RoleComponent>()');
const outputs = [ts.ModuleKind.ESNext,ts.ModuleKind.CommonJS].map(module=>{
  const emit = text => ts.transpileModule(text,{fileName:old.path,compilerOptions:{target:ts.ScriptTarget.ES2022,module,removeComments:true}}).outputText;
  const a=emit(old.text),b=emit(inverse),c=emit(now);assert.equal(a,b);
  return {module:ts.ModuleKind[module],inverseWholeRawSame:true,actualWholeRawSame:a===c,beforeSha256:sha(a),afterSha256:sha(c)};
});
const controls=before.controls.map(({text,...c})=>{assert.equal(sha(fs.readFileSync(c.path)),c.sha256);return {...c,wholeByteSame:true};});
const result={approved:true,baseCommit:before.baseCommit,source:paths.map(path=>({path,sha256:sha(fs.readFileSync(path))})),deleted:[],controls,program:{path:old.path,beforeSha256:old.sha256,afterSha256:sha(now),wholeExactForwardInverse:true,outputs},authority:{typeOnlyImports:true,weakSetRoleIdentityOnly:true,noClearOrReset:true,functions:declarations.map(n=>n.name.text)},installation:{order:['Role','Camp','Victory'],capturedCandidateRetiredOnly:true,catchDoesNotQueryWorld:true,sameErrorRethrown:true},summary:{oldWholePrograms:1,exactEdits:edits.length,typedNodes:original.nodes,nodeArrays:original.arrays,noncommentLeaves:original.leaves,inverseWholeRawOutputs:2},limits:['F05a是显式失败行为政策，actual代码和JS不同；完整正逆只核原保留正文，不冒行为等价。','只在已准备候选开始Role安装至Victory安装核心内标记，早期准备和完整安装后的晚事实错误保原范围。','全组共享实际core/资格reader为当前联合树，不冒固定Git完整运行或全55专属行动闭包。','不改Role.camp、构造器、DTO、原体谓词、目标数据或已付效果的当前性。']};
fs.writeFileSync(prefix+'proof.json',JSON.stringify(result,null,2)+'\n'); console.log(JSON.stringify(result.summary));
