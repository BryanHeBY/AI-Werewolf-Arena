/** 核对真实新刀口组合、完整保留狼阶段及公开绑定；不执行玩法、类型或架构门禁。 */
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict'), crypto = require('node:crypto');
const ts = require('../../../backend/node_modules/typescript');
const pre = 'docs/refactor/generated/ordinary-wolf-knife-routing-', read = p => fs.readFileSync(p, 'utf8');
const sha = t => crypto.createHash('sha256').update(t).digest('hex');
const before = JSON.parse(read(pre + 'before.json')), edits = JSON.parse(read(pre + 'edits.json'));
function parse(text, file = 'program.ts') { const s = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true); assert.equal(s.parseDiagnostics.length, 0); return s; }
function program(text) {
  const s = parse(text); let nodes = 0, leaves = 0;
  function tree(n) { nodes++; const children = []; ts.forEachChild(n, c => { children.push(tree(c)); }, a => { children.push(['array', a.length, !!a.hasTrailingComma, ...a.map(tree)]); }); return [n.kind, children]; }
  function tokens(n) { const children = n.getChildren(s).filter(c => c.kind < ts.SyntaxKind.FirstJSDocNode || c.kind > ts.SyntaxKind.LastJSDocNode); if (!children.length) { leaves++; return [n.kind, n.getText(s)]; } return [n.kind, children.map(tokens)]; }
  return { tree: tree(s), tokens: tokens(s), nodes, leaves };
}
const emit = (text, module) => ts.transpileModule(text, { compilerOptions: { target: ts.ScriptTarget.ES2022, module, removeComments: true } }).outputText;
function same(a, b, label) { const x = program(a), y = program(b); assert.deepEqual(y, x, label); const outputs = [ts.ModuleKind.ESNext, ts.ModuleKind.CommonJS].map(module => { const rawSame = emit(a, module) === emit(b, module); assert.ok(rawSame, label + ' full output'); return { module: ts.ModuleKind[module], rawSame }; }); return { typedNodes: x.nodes, noncommentLeaves: x.leaves, completeTypedAndTokenSame: true, outputs }; }
const old = before.source[0], current = read(old.path); assert.equal(sha(old.text), old.sha256);
let forward = old.text; const steps = [];
for (const e of edits.sourceEdits[old.path]) { assert.equal(forward.split(e.before).length, e.count + 1); const pos = forward.indexOf(e.before), next = forward.replace(e.before, e.after); steps.push({ pos, e, previous: forward, next }); forward = next; }
assert.equal(forward, current);
let inverse = current;
for (const s of [...steps].reverse()) { assert.equal(inverse, s.next); assert.equal(inverse.slice(s.pos, s.pos + s.e.after.length), s.e.after); inverse = inverse.slice(0, s.pos) + s.e.before + inverse.slice(s.pos + s.e.after.length); assert.equal(inverse, s.previous); }
assert.equal(inverse, old.text);
const retainedWolf = same(old.text, inverse, 'complete retained Wolf with precise five edits inverted');

// 比较真实新 owner 的完整函数体；仅剥离新增返回协议并规范化唯一类型路径，不换回旧业务体。
const ownerText = read(edits.newOwner), owner = parse(ownerText, edits.newOwner);
const fn = owner.statements.find(n => ts.isFunctionDeclaration(n) && n.name?.text === 'resolveOrdinaryWolfKnife'); assert.ok(fn);
const tail = fn.body.statements.at(-1); assert.ok(ts.isReturnStatement(tail)); assert.equal(tail.getText(owner), edits.addedProtocol);
const body = ownerText.slice(fn.body.getStart(owner), tail.getStart(owner)) + '}';
const originalWrapper = 'function route(ctx, acceptedTargets, voteOrder, explicitPasses) {\n' + edits.originalRouting + '}';
const actualWrapper = 'function route(ctx, acceptedTargets, voteOrder, explicitPasses) ' + body.replace('import("../core/domain/night_effects")', 'import("../../../../core/domain/night_effects")');
const actualRouting = same(originalWrapper, actualWrapper, 'actual complete moved routing body');
assert.equal(edits.originalRouting.split('\n').filter((_, i, a) => i < a.length - 1).length, 67);
assert.equal(fn.parameters.length, 4); assert.deepEqual(fn.parameters.map(p => p.name.getText(owner)), ['ctx', 'acceptedTargets', 'voteOrder', 'explicitPasses']);
const call = current.match(/const wolfTarget = resolveOrdinaryWolfKnife\(([^;]+)\);/); assert.equal(call[1], 'ctx, acceptedTargets, voteOrder, explicitPasses');
assert.ok(current.includes('publishNobleNightKnife(() => ctx, wolfTarget);'));
assert.notDeepEqual(program(actualWrapper.replace('mist_knife_rng_missing', 'counterexample_rng_missing')).tokens, program(actualWrapper).tokens);
assert.notDeepEqual(program(actualWrapper.replace('marks.add(StatusMark.WolfKillMark)', 'marks.add(StatusMark.WolfPoisonMark)')).tokens, program(actualWrapper).tokens);

const config = ts.readConfigFile(pre + 'types-config.json', ts.sys.readFile), options = ts.parseJsonConfigFileContent(config.config, ts.sys, process.cwd()).options;
function endpoint(spec, file) { const r = ts.resolveModuleName(spec, path.resolve(file), options, ts.sys).resolvedModule; assert.ok(r, file + ':' + spec); return path.relative(process.cwd(), r.resolvedFileName); }
function named(text) { const s = parse(text); return s.statements.filter(ts.isImportDeclaration).flatMap(n => { const b = n.importClause?.namedBindings; return b && ts.isNamedImports(b) ? b.elements.map(e => ({ local: e.name.text, imported: e.propertyName?.text ?? e.name.text, specifier: n.moduleSpecifier.text, typeOnly: n.importClause.isTypeOnly || e.isTypeOnly })) : []; }); }
function symbolEndpoint(file, name, seen = new Set()) { const key = file + ':' + name; assert.ok(!seen.has(key)); seen.add(key); const s = parse(read(file), file); for (const e of s.statements.filter(ts.isExportDeclaration)) if (e.moduleSpecifier && e.exportClause && ts.isNamedExports(e.exportClause)) for (const b of e.exportClause.elements) if (b.name.text === name) return symbolEndpoint(endpoint(e.moduleSpecifier.text, file), b.propertyName?.text ?? b.name.text, seen); assert.ok(s.statements.some(n => ts.isFunctionDeclaration(n) && n.name?.text === name)); return { file, declaration: name }; }
const originalImports = named(old.text), currentImports = named(current), ownerImports = named(ownerText);
const movedNames = ['EntityId', 'Phase', 'StatusMark', 'COMPONENT', 'aliveLifeVersion', 'safeRecordLogicOp', 'wolfTeamEvent', 'bindWolfKnifeTargetQuery', 'isMistRavenBoard', 'mistKnifeTargets', 'originalMistTarget', 'NightStageContext'];
const movedBindings = movedNames.map(local => { const a = originalImports.find(x => x.local === local), b = ownerImports.find(x => x.local === local); assert.ok(a && b); const oldEndpoint = endpoint(a.specifier, old.path), route = endpoint(b.specifier, edits.newOwner); const actualEndpoint = ['isMistRavenBoard', 'mistKnifeTargets', 'originalMistTarget'].includes(local) ? symbolEndpoint(route, b.imported).file : route; assert.equal(actualEndpoint, oldEndpoint); assert.equal(a.imported, b.imported); return { local, oldEndpoint, currentRoute: route, actualEndpoint, samePhysicalOwner: true }; });
const remaining = currentImports.filter(i => !['resolveOrdinaryWolfKnife', 'AcceptedWolfKnifeTarget'].includes(i.local));
const priorRemaining = originalImports.filter(i => !['StatusMark', 'mistKnifeTargets', 'originalMistTarget'].includes(i.local));
assert.equal(remaining.length, priorRemaining.length);
const retainedBindings = priorRemaining.map(a => { const b = remaining.find(x => x.local === a.local); assert.ok(b); assert.equal(b.imported, a.imported); assert.equal(b.typeOnly, a.typeOnly); const originalEndpoint = endpoint(a.specifier, old.path), actualEndpoint = a.local === 'isMistRavenBoard' ? symbolEndpoint(endpoint(b.specifier, old.path), b.imported).file : endpoint(b.specifier, old.path); assert.equal(actualEndpoint, originalEndpoint); return { local: a.local, physicalEndpoint: actualEndpoint, typeOnly: b.typeOnly, same: true }; });
const facet = parse(read(edits.publicFacet), edits.publicFacet); assert.equal(facet.statements.length, 1); const exported = facet.statements[0]; assert.ok(ts.isExportDeclaration(exported) && ts.isNamedExports(exported.exportClause)); assert.deepEqual(exported.exportClause.elements.map(e => e.name.text), ['isMistRavenBoard', 'mistKnifeTargets', 'originalMistTarget']); assert.equal(endpoint(exported.moduleSpecifier.text, edits.publicFacet), 'backend/src/game/mechanisms/roles/mist_raven/night_frame.ts');
// 票载体直接复用既有生命契约的三字段；原 actorId 是同一个 EntityId，原生命组件未转只读或复制。
const alias = owner.statements.find(n => ts.isTypeAliasDeclaration(n) && n.name.text === 'AcceptedWolfKnifeTarget'); assert.ok(ts.isIntersectionTypeNode(alias.type)); assert.equal(alias.type.types[0].getText(owner), 'Pick<WolfKnifeTargetScope, "targetId" | "life" | "version">'); assert.equal(alias.type.types[1].members[0].getText(owner), 'actorId: EntityId;');

const roots = ['backend/src', 'backend/tests', 'backend/scripts', 'frontend/src', 'frontend/tests', 'packages', 'tooling'], files = [];
function walk(dir) { if (!fs.existsSync(dir)) return; for (const d of fs.readdirSync(dir, { withFileTypes: true })) { const p = path.join(dir, d.name); if (d.isDirectory()) { if (!['node_modules', 'dist', '.git'].includes(d.name)) walk(p); } else if (/\.(?:[cm]?[jt]s|[jt]sx)$/.test(d.name)) files.push(p); } }
roots.forEach(walk); const relevant = [];
for (const file of files.sort()) { const text = read(file), s = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true); function visit(n) { let spec, form; if (ts.isImportDeclaration(n) || ts.isExportDeclaration(n)) { if (n.moduleSpecifier && ts.isStringLiteralLike(n.moduleSpecifier)) { spec = n.moduleSpecifier.text; form = ts.isImportDeclaration(n) ? 'import' : 'export'; } } else if (ts.isImportTypeNode(n) && ts.isLiteralTypeNode(n.argument) && ts.isStringLiteralLike(n.argument.literal)) { spec = n.argument.literal.text; form = 'importType'; } else if (ts.isImportEqualsDeclaration(n) && ts.isExternalModuleReference(n.moduleReference) && n.moduleReference.expression && ts.isStringLiteralLike(n.moduleReference.expression)) { spec = n.moduleReference.expression.text; form = 'importEquals'; } else if (ts.isCallExpression(n) && (n.expression.kind === ts.SyntaxKind.ImportKeyword || ts.isIdentifier(n.expression) && n.expression.text === 'require') && n.arguments.length && ts.isStringLiteralLike(n.arguments[0])) { spec = n.arguments[0].text; form = n.expression.kind === ts.SyntaxKind.ImportKeyword ? 'dynamicImport' : 'require'; } if (spec) { const r = ts.resolveModuleName(spec, path.resolve(file), options, ts.sys).resolvedModule; const target = r && path.relative(process.cwd(), r.resolvedFileName); if (['backend/src/game/mechanisms/roles/mist_raven/night_frame.ts', edits.publicFacet, edits.newOwner].includes(target)) relevant.push({ file, form, specifier: spec, target, line: s.getLineAndCharacterOfPosition(n.getStart(s)).line + 1, text: n.getText(s) }); } ts.forEachChild(n, c => { visit(c); }); } visit(s); }
assert.ok(!relevant.some(r => r.file === old.path && r.target.endsWith('/mist_raven/night_frame.ts')));
const controls = before.controls.map(c => { assert.equal(sha(c.text), c.sha256); assert.equal(read(c.path), c.text); return { path: c.path, sha256: c.sha256, currentWholeSame: true }; });
const report = { baseCommit: before.baseCommit, source: edits.paths.map(p => ({ path: p, sha256: sha(read(p)) })), retainedWolf: { path: old.path, preciseEdits: steps.length, completeForwardInverse: true, ...retainedWolf }, actualRouting: { originalPhysicalLines: 67, addedReturn: edits.addedProtocol, originalInlineTypeSameEndpoint: true, actualNewBodyCompared: true, ...actualRouting }, movedBindings, retainedBindings, facet: { path: edits.publicFacet, exactDirectBindings: 3, noWrapper: true }, acceptedTargets: { fields: ['actorId', 'targetId', 'life', 'version'], sharedOriginalLifeContract: true }, inventory: { roots, files: files.length, relevant, limits: '当前七源码根的字面模块入口；不覆盖计算路径、eval、仓外代码或历史 generated。' }, controls, nonfirstLiteralCounterexamplesDetected: 2, limits: ['全模块输出相同仅属于五项完整逆向；真实新 owner 的完整原业务体另经实际函数比较，不声称新旧模块整体原始 JS 相同。', '新增具名组合调用栈、函数作用域及公开 knife facet；不承诺任意私有反射、namespace 重赋或 prototype monkeypatch 等价。', '直接传原 ctx，不新增读取快照或 await；生命、目标政策、付款和关闭仍由原 feature owner 管理。', '新组合的所有值依赖端点在原 Wolf 源已存在；这不是完整冷图／任意初始化副作用验收。'] };
fs.writeFileSync(pre + 'proof.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ completeWolf: report.retainedWolf, actualRouting: report.actualRouting, movedBindings: movedBindings.length, retainedBindings: retainedBindings.length, inventoryFiles: files.length, moduleSites: relevant.length, controls: controls.length }));
