/** 核本批完整旧程序、新规则算法及精确绑定；输入真实 Git before/当前源码，输出有界迁移证据，不执行玩法或全门禁。 */
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const { createHash } = require('node:crypto'), { execFileSync } = require('node:child_process');
const ts = require('../../../backend/node_modules/typescript');
const prefix = 'docs/refactor/generated/beauty-exile-victory-';
const before = JSON.parse(fs.readFileSync(prefix + 'before.json', 'utf8'));
const edits = JSON.parse(fs.readFileSync(prefix + 'edits.json', 'utf8'));
const paths = JSON.parse(fs.readFileSync(prefix + 'paths.json', 'utf8')).source;
const sha = x => createHash('sha256').update(x).digest('hex');
function parse(text, p) {
  const f = ts.createSourceFile(p, text, ts.ScriptTarget.Latest, true);
  assert.deepEqual(f.parseDiagnostics, []); return f;
}
function signature(text, p) {
  const f = parse(text, p); let nodes = 0;
  function walk(n) {
    nodes++; const children = [];
    ts.forEachChild(n, c => { children.push(walk(c)); }, a => { children.push(['array', a.length, !!a.hasTrailingComma, ...a.map(walk)]); });
    return [n.kind, children];
  }
  const typed = walk(f), leaves = [];
  function tokens(n) {
    const children = n.getChildren(f).filter(c => c.kind < ts.SyntaxKind.FirstJSDocNode || c.kind > ts.SyntaxKind.LastJSDocNode);
    if (!children.length) { const leaf = [n.kind, n.getText(f)]; leaves.push(leaf); return leaf; }
    return [n.kind, children.map(tokens)];
  }
  return { typed, tokens: tokens(f), leaves, nodes };
}
function pair(a, b, p) {
  const x = signature(a, p), y = signature(b, p); assert.deepEqual(x, y);
  const outputs = [ts.ModuleKind.ESNext, ts.ModuleKind.CommonJS].map(module => {
    const emit = s => ts.transpileModule(s, { fileName: p, compilerOptions: { target: ts.ScriptTarget.ES2022, module, removeComments: true } }).outputText;
    const left = emit(a), right = emit(b);
    return { module: ts.ModuleKind[module], wholeRawSame: left === right, beforeSHA256: sha(left), afterSHA256: sha(right) };
  });
  return { typedNodes: x.nodes, noncommentLeaves: x.leaves.length, outputs };
}
const whole = before.source.map(x => {
  assert.equal(sha(x.text), x.sha256);
  assert.equal(execFileSync('git', ['show', before.baseCommit + ':' + x.path], { encoding: 'utf8' }), x.text);
  const current = fs.readFileSync(x.path, 'utf8'); let forward = x.text;
  const steps = edits.filter(e => e.path === x.path);
  for (const e of steps) { assert.equal(forward.indexOf(e.before), e.beforeOffset); assert.equal(forward.split(e.before).length, 2); forward = forward.replace(e.before, e.after); }
  assert.equal(forward, current); let inverse = current;
  for (const e of [...steps].reverse()) {
    assert.equal(inverse.slice(e.beforeOffset, e.beforeOffset + e.after.length), e.after);
    inverse = inverse.slice(0, e.beforeOffset) + e.before + inverse.slice(e.beforeOffset + e.after.length);
  }
  assert.equal(inverse, x.text);
  return { path: x.path, sourceSHA256: sha(current), edits: steps.length, exactForwardInverse: true, ...pair(inverse, x.text, x.path) };
});
const ownerPath = paths[3], ownerText = fs.readFileSync(ownerPath, 'utf8'), owner = parse(ownerText, ownerPath);
const oldRelation = before.source[1], oldFile = parse(oldRelation.text, oldRelation.path);
const find = (f, name) => { const n = f.statements.find(s => s.name?.text === name); assert(n, name); return n; };
const fullFunctions = ['captureBeautyExile', 'resolveBeautyExileVictory'].map(name => {
  let actual = find(owner, name).getText(owner), original = find(oldFile, name).getText(oldFile);
  if (name === 'captureBeautyExile') { assert(original.startsWith('export ')); original = original.slice(7); }
  if (name === 'resolveBeautyExileVictory') {
    assert.equal(actual.split('isCharmBindingCurrent(world, candidate.binding)').length, 2);
    actual = actual.replace('isCharmBindingCurrent(world, candidate.binding)', 'current(world, candidate.binding)');
  }
  return { name, mapping: name === 'captureBeautyExile' ? '旧 export 退休，完整函数保持' : '同函数 alias 名精确逆', ...pair(actual, original, ownerPath) };
});
const candidate = pair(find(owner, 'BeautyExileCandidate').getText(owner), find(oldFile, 'BeautyExileCandidate').getText(oldFile), ownerPath);
// 整个 prepare 必须仅包含目标声明、原条件的候选三元式、两个同名值的返回；不忽略额外语句。
const prep = find(owner, 'prepareBeautyExileVictory'), statements = prep.body.statements;
assert.equal(statements.length, 3);
const declaration = statements[1]; assert(ts.isVariableStatement(declaration));
assert.equal(declaration.declarationList.declarations.length, 1);
const candidateDecl = declaration.declarationList.declarations[0]; assert.equal(candidateDecl.name.getText(owner), 'candidate');
const choice = candidateDecl.initializer; assert(ts.isConditionalExpression(choice)); assert.equal(choice.whenFalse.kind, ts.SyntaxKind.NullKeyword);
assert.equal(statements[2].getText(owner), 'return { target, candidate };');
let prepareInverse = statements[0].getText(owner) + '\nif (' + choice.condition.getText(owner) + ')\n  beautyCandidate = ' + choice.whenTrue.getText(owner) + ';';
assert.equal(prepareInverse.split('world()').length, 2);
prepareInverse = prepareInverse.replaceAll('selection.', 'votingResult.').replace('world()', 'this.world');
const oldPrepare = edits.find(e => e.kind === 'complete-target-candidate-preparation').before;
const wrap = x => 'function originalPreparation() {\n' + x + '\n}';
const preparation = { statements: statements.length, explicitNullOnlyUnselected: true, returnedFields: ['target', 'candidate'], ...pair(wrap(prepareInverse), wrap(oldPrepare), ownerPath) };
const override = find(owner, 'beautyExileVictoryOverrides'); assert.equal(override.body.statements.length, 1);
let overrideInverse = override.body.statements[0].getText(owner); assert.equal(overrideInverse.split('result').length - 1, 2);
overrideInverse = overrideInverse.replaceAll('result', 'beautyResult');
const oldOverride = edits.find(e => e.kind === 'late-override-argument').before.trim().replace(/,$/, '');
const overrides = pair('function overrideData() { ' + overrideInverse + ' }', 'function overrideData() { return ' + oldOverride + '; }', ownerPath);
// 原体函数仅新增 export alias，声明/正文仍在 relation；公开端口和 new owner 都直达它。
const relationCurrent = fs.readFileSync(paths[1], 'utf8'), relationAst = parse(relationCurrent, paths[1]);
const currentFunction = pair(find(relationAst, 'current').getText(relationAst), find(oldFile, 'current').getText(oldFile), paths[1]);
assert(relationCurrent.includes('export { current as isCharmBindingCurrent };'));
const publicAst = parse(fs.readFileSync(paths[2], 'utf8'), paths[2]);
const exportedQueries = publicAst.statements.filter(ts.isExportDeclaration).flatMap(n => ts.isNamedExports(n.exportClause) ? n.exportClause.elements.filter(e => ['activeCharm', 'isCharmBindingCurrent'].includes(e.name.text)).map(e => ({ name: e.name.text, importedName: e.propertyName?.text ?? e.name.text, module: n.moduleSpecifier.text })) : []);
assert.deepEqual(exportedQueries, ['activeCharm', 'isCharmBindingCurrent'].map(name => ({ name, importedName: name, module: './relation' })));
const imports = owner.statements.filter(ts.isImportDeclaration).map(n => ({ module: n.moduleSpecifier.text, typeOnly: !!n.importClause?.isTypeOnly, names: n.importClause?.namedBindings?.elements.map(e => ({ name: e.name.text, typeOnly: !!e.isTypeOnly })) ?? [] }));
assert.deepEqual(imports.map(x => x.module), ['../core/domain/model', '../core/domain/components/names', '../core/domain/world', '../game/mechanisms/roles/wolf_beauty/ports', '../game/mechanisms/roles/role-catalog-assembly', '../game/mechanisms/win_conditions/results']);
const physicalBindings = [
  { name: 'activeCharm', path: paths[1], declaration: 'activeCharm', via: paths[2] },
  { name: 'isCharmBindingCurrent', path: paths[1], declaration: 'current', via: paths[2], sameBindingAlias: true },
  { name: 'CharmBinding', path: paths[1], declaration: 'CharmBinding', via: paths[2], typeOnly: true },
  { name: 'getDefaultRoleCatalog', path: 'backend/src/game/mechanisms/roles/role-catalog-assembly.ts', declaration: 'getDefaultRoleCatalog' },
  { name: 'victoryDecision', path: 'backend/src/game/mechanisms/win_conditions/results.ts', declaration: 'victoryDecision' },
];
for (const b of physicalBindings) find(parse(fs.readFileSync(b.path, 'utf8'), b.path), b.declaration);
// 有界后端值图只检查实际 literal import/export 与 literal require；纯类型边和外部包不计。
function resolveRelative(from, spec) {
  if (!spec.startsWith('.')) return null;
  const base = path.posix.normalize(path.posix.join(path.posix.dirname(from), spec));
  return [base, base + '.ts', base + '.mts', base + '.cts', base + '/index.ts'].find(p => fs.existsSync(p) && fs.statSync(p).isFile()) ?? null;
}
function valueEdges(p) {
  const f = parse(fs.readFileSync(p, 'utf8'), p), result = new Set();
  function visit(n) {
    if (ts.isImportDeclaration(n) && !n.importClause?.isTypeOnly && (!n.importClause?.namedBindings || !ts.isNamedImports(n.importClause.namedBindings) || n.importClause.namedBindings.elements.some(e => !e.isTypeOnly))) {
      const target = resolveRelative(p, n.moduleSpecifier.text); if (target) result.add(target);
    }
    if (ts.isExportDeclaration(n) && n.moduleSpecifier && !n.isTypeOnly && (!n.exportClause || !ts.isNamedExports(n.exportClause) || n.exportClause.elements.some(e => !e.isTypeOnly))) {
      const target = resolveRelative(p, n.moduleSpecifier.text); if (target) result.add(target);
    }
    if (ts.isCallExpression(n) && (n.expression.kind === ts.SyntaxKind.ImportKeyword || ts.isIdentifier(n.expression) && n.expression.text === 'require') && n.arguments.length === 1 && ts.isStringLiteralLike(n.arguments[0])) {
      const target = resolveRelative(p, n.arguments[0].text); if (target) result.add(target);
    }
    ts.forEachChild(n, c => { visit(c); });
  }
  visit(f); return [...result];
}
const graph = new Map(), queue = [ownerPath];
while (queue.length) { const p = queue.shift(); if (graph.has(p)) continue; const edges = valueEdges(p); graph.set(p, edges); queue.push(...edges.filter(x => !graph.has(x))); }
const backEdges = [...graph].flatMap(([from, to]) => to.filter(x => x === ownerPath).map(to => ({ from, to })));
assert.deepEqual(backEdges, []);
const sourceRoots = ['backend/src', 'backend/tests', 'backend/scripts', 'frontend/src', 'frontend/tests', 'packages', 'tooling'];
const files = execFileSync('rg', ['--files', ...sourceRoots], { encoding: 'utf8' }).trim().split('\n').filter(p => /\.(?:[cm]?[jt]sx?)$/.test(p));
const retiredReferences = [], relevantModuleImports = [];
for (const p of files) {
  const text = fs.readFileSync(p, 'utf8'); if (!text.includes('wolf_beauty/relation') && !text.includes('captureBeautyExile') && !text.includes('BeautyExileCandidate') && !text.includes('resolveBeautyExileVictory')) continue;
  const f = parse(text, p);
  function visit(n) {
    if (ts.isImportDeclaration(n) || ts.isExportDeclaration(n)) {
      if (n.moduleSpecifier && ts.isStringLiteralLike(n.moduleSpecifier)) {
        const spec = n.moduleSpecifier.text, target = resolveRelative(p, spec);
        if (target === paths[1]) {
          const clause = ts.isImportDeclaration(n) ? n.importClause?.namedBindings : n.exportClause;
          const names = clause && (ts.isNamedImports(clause) || ts.isNamedExports(clause)) ? clause.elements.map(e => e.propertyName?.text ?? e.name.text) : [];
          relevantModuleImports.push({ path: p, syntax: ts.SyntaxKind[n.kind], module: spec, names });
          if (names.some(name => ['captureBeautyExile', 'resolveBeautyExileVictory', 'BeautyExileCandidate'].includes(name))) retiredReferences.push(p);
          if (clause && ts.isNamespaceImport(clause) || ts.isExportDeclaration(n) && !n.exportClause) retiredReferences.push(p);
        }
      }
    }
    if ((ts.isImportTypeNode(n) && ts.isLiteralTypeNode(n.argument) && ts.isStringLiteralLike(n.argument.literal) && resolveRelative(p, n.argument.literal.text) === paths[1]) ||
        (ts.isCallExpression(n) && n.arguments.length === 1 && ts.isStringLiteralLike(n.arguments[0]) && resolveRelative(p, n.arguments[0].text) === paths[1]) ||
        (ts.isImportEqualsDeclaration(n) && ts.isExternalModuleReference(n.moduleReference) && ts.isStringLiteralLike(n.moduleReference.expression) && resolveRelative(p, n.moduleReference.expression.text) === paths[1])) retiredReferences.push(p);
    ts.forEachChild(n, c => { visit(c); });
  }
  visit(f);
}
assert.deepEqual(retiredReferences, []);
const typefix = JSON.parse(fs.readFileSync(prefix + 'test-typefix-before.json', 'utf8'));
let fixed = typefix.text; for (const e of typefix.edits) { assert.equal(fixed.split(e.before).length - 1, e.count); fixed = fixed.replaceAll(e.before, e.after); }
assert.equal(fixed, fs.readFileSync(typefix.path, 'utf8'));
const testOutputs = [ts.ModuleKind.ESNext, ts.ModuleKind.CommonJS].map(module => {
  const emit = s => ts.transpileModule(s, { fileName: typefix.path, compilerOptions: { target: ts.ScriptTarget.ES2022, module, removeComments: true } }).outputText;
  assert.equal(emit(fixed), emit(typefix.text)); return { module: ts.ModuleKind[module], wholeRawSame: true, sha256: sha(emit(fixed)) };
});
const controls = before.controls.map(x => { assert.equal(execFileSync('git', ['show', before.baseCommit + ':' + x.path], { encoding: 'utf8' }), x.text); assert.equal(fs.readFileSync(x.path, 'utf8'), x.text); return { path: x.path, sha256: x.sha256, wholeGitBytesSame: true }; });
const pairs = [...whole, ...fullFunctions, candidate, preparation, overrides, currentFunction];
const report = {
  approved: true, baseCommit: before.baseCommit,
  source: paths.map(p => ({ path: p, sha256: sha(fs.readFileSync(p)) })), wholeOriginalPrograms: whole,
  completeMovedFunctions: fullFunctions, candidateDeclaration: candidate, completePreparation: preparation, completeOverrideExpression: overrides, originalCurrentFunction: currentFunction,
  bindings: { exportedQueries, physicalBindings, ownerImports: imports },
  inventory: { roots: sourceRoots, extensions: 'TS/MTS/CTS/TSX/JS/MJS/CJS/JSX', literalFiles: files.length, forms: ['import', 'export', 'importType', 'literal dynamic/require', 'importEquals'], relevantModuleImports, retiredReferences },
  graph: { root: ownerPath, backendModules: graph.size, backendRelativeValueEdges: [...graph.values()].reduce((n, x) => n + x.length, 0), backEdges, kind: '当前相对 literal 后端值依赖；外部包／非字面入口及完整冷执行不计' },
  testTypeOnlyDelta: { path: typefix.path, beforeSHA256: typefix.sha256, finalSHA256: sha(fixed), outputs: testOutputs }, controls,
  summary: { wholeOriginalPrograms: whole.length, completeMovedFunctions: fullFunctions.length, otherCompletePrograms: 4, typedNodes: pairs.reduce((n, p) => n + p.typedNodes, 0), noncommentLeaves: pairs.reduce((n, p) => n + p.noncommentLeaves, 0), wholeMappedOutputs: pairs.length * 2, rawSame: pairs.flatMap(p => p.outputs).filter(x => x.wholeRawSame).length, typeOnlyTestOutputs: testOutputs.length },
  limits: ['whole PM/relation/ports 精准逆不证明无映射当前 JS 恒同；完整新 owner 函数、prepare 三语句和覆盖表达式分别从当前源码核。', '原 relation 三个候选 API 物理退休，新组合 API 和公开同绑定查询会改变模块初始化路径／来源指纹；不承诺任意 namespace 改写或完整冷图相等。', 'prepare 新返回容器不冻结原候选；relation 保唯一 binding/current/resolved/applied，运行 World/引用不授死亡或封盘许可。', '仅本批五源与五真实 controls；其它并行工作树和当前传递依赖不声明与 baseline 全字节相同。'],
};
fs.writeFileSync(prefix + 'proof.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ summary: report.summary, graph: report.graph, retiredReferences }));
