/** 本批实际源码增量取证：完整原稿正逆、语法树／叶／NodeArray 与逆路由输出，以及未改纯当前性／付款后程序。 */
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const ts = require(path.resolve('backend/node_modules/typescript'));
const prefix = 'docs/refactor/generated/learned-wolf-execution-retirement-';
const before = JSON.parse(fs.readFileSync(prefix + 'before-final-expanded.json', 'utf8'));
const ready = JSON.parse(fs.readFileSync(prefix + 'source-ready.json', 'utf8'));
const edits = JSON.parse(fs.readFileSync(prefix + 'edits.json', 'utf8'));
const hash = (text) => crypto.createHash('sha256').update(text).digest('hex');
const assert = (condition, detail) => { if (!condition) throw new Error(detail); };
const parse = (file, text) => ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
function tree(source) {
  const nodes = [], leaves = [], arrays = [];
  const visit = (node) => {
    nodes.push([node.kind, node.getText(source)]);
    const children = node.getChildren(source);
    if (!children.length) leaves.push([node.kind, node.getText(source)]);
    ts.forEachChild(node, () => undefined, (array) => { arrays.push([array.pos, array.end, array.length, Boolean(array.hasTrailingComma)]); return undefined; });
    children.forEach(visit);
  };
  visit(source);
  return { nodes, leaves, arrays };
}
function emit(file, text, module) {
  const result = ts.transpileModule(text, { fileName: file,
    compilerOptions: { target: ts.ScriptTarget.ES2022, module, removeComments: true }, reportDiagnostics: true });
  assert(!result.diagnostics?.some((entry) => entry.category === ts.DiagnosticCategory.Error), 'transpile_error:' + file);
  return result.outputText;
}
function found(source, select) {
  const result = [];
  const visit = (node) => { if (select(node)) result.push(node); ts.forEachChild(node, visit); };
  visit(source); return result;
}
const programs = [], protectedPrograms = [], actualOutputChanges = [], controlledBodies = [];
const retained = {
  'mechanical_wolf/night_scope.ts': ['bindMechanicalSkill','recordMechanicalModeScope','hasMechanicalNightCommit','recordMechanicalNightCommit','hasCurrentMechanicalMode','hasCurrentMechanicalKillMode'],
  'awakened_hidden_wolf/night_scope.ts': ['bindAwakenedSkill','captureAwakenedMirrorScope','currentAwakenedNight','recordAwakenedNightCommit','hasAwakenedNightCommit'],
  'mechanical_wolf/state.ts': ['freshMechanicalState','getMechanicalState','setMechanicalState','mechanicalLearning','recordMechanicalInheritance','canMechanicalMimic','advanceMechanicalNight','canSelectMechanicalMode','mechanicalSkillForNight','mechanicalKnifeSelected','canMechanicalExtraKnife','projectMechanicalState','consumeMechanicalPoison','closeMechanicalExtraKnife'],
  'awakened_hidden_wolf/state.ts': ['freshAwakenedState','getAwakenedState','setAwakenedState','awakenedLearning','canAwakenedMimic','awakenedSkillForNight','recordAwakenedInheritance','awakenedKnifeReady','canAwakenedExtraKnife','projectAwakenedState'],
  'native-death-gun-resources.ts': ['createHunterState','createWolfKingState','setHunterState','getHunterState','setWolfKingState','getWolfKingState','createLearnedNativeGun','armLearnedNativeGun','armMechanicalNativeGun','createMechanicalGunReader','createAwakenedGunReader','captureNativeGunStock','consumeNativeDeathGun'],
};
for (const old of before.source) {
  const current = fs.readFileSync(old.path, 'utf8');
  assert(hash(current) === ready.source.find((entry) => entry.path === old.path).sha256, 'ready_drift:' + old.path);
  const steps = edits.edits.filter((entry) => entry.path === old.path);
  let forward = old.text;
  const applied = [];
  for (const step of [...steps].sort((a,b) => b.beforeOffset-a.beforeOffset)) {
    assert(forward.slice(step.beforeOffset, step.beforeOffset + step.before.length) === step.before, 'forward_anchor:' + old.path);
    forward = forward.slice(0,step.beforeOffset) + step.after + forward.slice(step.beforeOffset + step.before.length);
  }
  assert(forward === current, 'whole_forward:' + old.path);
  let offsetDelta = 0;
  for (const step of [...steps].sort((a,b) => a.beforeOffset-b.beforeOffset)) {
    applied.push({...step, afterOffset: step.beforeOffset + offsetDelta});
    offsetDelta += step.after.length - step.before.length;
  }
  let inverse = current;
  for (const step of applied.reverse()) {
    assert(inverse.slice(step.afterOffset, step.afterOffset+step.after.length) === step.after, 'inverse_anchor:' + old.path);
    inverse = inverse.slice(0,step.afterOffset) + step.before + inverse.slice(step.afterOffset+step.after.length);
  }
  assert(inverse === old.text, 'whole_inverse:' + old.path);
  const a = parse(old.path,old.text), b = parse(old.path,inverse), c = parse(old.path,current);
  const ta = tree(a), tb = tree(b);
  assert(JSON.stringify(ta) === JSON.stringify(tb), 'whole_tree:' + old.path);
  const outputs = [];
  for (const [label,module] of [['ES',ts.ModuleKind.ESNext],['CJS',ts.ModuleKind.CommonJS]]) {
    const original = emit(old.path,old.text,module), restored = emit(old.path,inverse,module), actual = emit(old.path,current,module);
    assert(original === restored, 'whole_inverse_emit:' + old.path + ':' + label);
    outputs.push({ module: label, originalSHA256:hash(original), inverseSHA256:hash(restored), actualSHA256:hash(actual), inverseSame:true, actualSame:original===actual });
    if (original !== actual) actualOutputChanges.push({path:old.path,module:label});
  }
  programs.push({path:old.path,beforeSHA256:old.sha256,currentSHA256:hash(current),edits:steps.length,wholeForward:true,wholeInverse:true,typedTreeNodes:ta.nodes.length,allSyntaxLeaves:ta.leaves.length,nodeArrays:ta.arrays.length,outputs});
  for (const [suffix,names] of Object.entries(retained)) {
    if (!old.path.endsWith(suffix)) continue;
    for (const name of names) {
      const get = (source) => found(source,(node) => ts.isFunctionDeclaration(node) && node.name?.text===name && node.body);
      const fa=get(a), fc=get(c);
      assert(fa.length===1 && fc.length===1,'protected_declaration:' + name);
      assert(fa[0].getText(a)===fc[0].getText(c),'protected_complete_function:' + name);
      protectedPrograms.push({path:old.path,name,completeFunctionSame:true,sha256:hash(fa[0].getText(a))});
    }
  }
  if (old.path.endsWith('/night_scope.ts')) {
    const get = (source) => found(source,(node) => ts.isPropertyAssignment(node) && node.name.getText(source)==='isCurrent');
    const fa=get(a), fc=get(c);
    assert(fa.length===1 && fc.length===1 && fa[0].initializer.getText(a)===fc[0].initializer.getText(c),'pure_owner_isCurrent:' + old.path);
    protectedPrograms.push({path:old.path,name:'owner.isCurrent',fullExpressionSame:true,sha256:hash(fa[0].initializer.getText(a))});
  }
  if (old.path.endsWith('/night_stages.ts')) {
    const get = (source) => found(source,(node) => ts.isVariableDeclaration(node) && node.name.getText(source)==='effectCurrent');
    const fa=get(a), fc=get(c);
    assert(fa.length===1 && fc.length===1 && fa[0].initializer.getText(a)===fc[0].initializer.getText(c),'pure_effectCurrent:' + old.path);
    protectedPrograms.push({path:old.path,name:'effectCurrent',fullExpressionSame:true,sha256:hash(fa[0].initializer.getText(a))});
    // 实际已付 callback 表达式逐个比较，避免把新行动拒绝误接到已付条目。
    const getPaid = (source) => found(source,(node) => ts.isPropertyAssignment(node) && node.name.getText(source)==='isCurrent').map((node) => node.initializer.getText(source));
    const pa=getPaid(a), pc=getPaid(c);assert(JSON.stringify(pa)===JSON.stringify(pc),'paid_callbacks:' + old.path);
    protectedPrograms.push({path:old.path,name:'paid callback list',expressions:pa.length,allExpressionsSame:true,sha256:hash(JSON.stringify(pa))});
  }
  for (const node of found(c,(node) => ts.isFunctionDeclaration(node) && node.body && node.parameters.some((param) => param.name.getText(c)==='mayCommit'))) {
    controlledBodies.push({path:old.path,name:node.name.text,completeBodySHA256:hash(node.body.getText(c)),parameters:node.parameters.map((param)=>param.getText(c))});
  }
}
assert(fs.readFileSync(edits.newSource.path,'utf8')===edits.newSource.text,'new_unit_complete');
for (const control of before.controls) assert(hash(fs.readFileSync(control.path,'utf8'))===control.sha256,'control_drift:' + control.path);
const report={schema:1,programs,protectedPrograms,controlledBodies,newSource:ready.source.find((entry)=>entry.path===edits.newSource.path),controls:before.controls.map(({text,...entry})=>entry),totals:{programs:programs.length,edits:edits.edits.length,typedTreeNodes:programs.reduce((n,p)=>n+p.typedTreeNodes,0),allSyntaxLeaves:programs.reduce((n,p)=>n+p.allSyntaxLeaves,0),nodeArrays:programs.reduce((n,p)=>n+p.nodeArrays,0),inverseWholeOutputs:programs.length*2,actualOutputChanges:actualOutputChanges.length,protectedPrograms:protectedPrograms.length},limits:['完整正逆／AST／输出只证明真实原稿与显式增量归属；F05c 是有意的新拒绝政策，actual JS 变化不可宣称旧行为全等。','allSyntaxLeaves 包含完整 getChildren 语法叶及其中 JSDoc，不能当作 standard lexer token 计数或仅非注释叶。','纯当前性／已付 callback／保留函数逐实际完整声明比较；新增 tail 的内部首写、原 getter／receiver 和失败前缀仍需独立人工与手写风险审查。','默认旧调用返回面由重载保持；新增局部绑定／Reflect.apply／调用栈和函数对象形状不对任意全局 monkeypatch、外部强制写或 setter 内部回滚作等价保证。']};
fs.writeFileSync(prefix+'proof.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report.totals));
