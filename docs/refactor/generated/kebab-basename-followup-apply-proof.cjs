/**
 * 负责九个已审 basename 的后继实际应用和有限整程序证明。
 * 输入必须是 Root 明确指定的 full Git、仓库 cwd、独立证据 prefix 和已审 proposal；本文件仅准备，未执行。
 * 只有显式 --apply 才可调用；先核原 SHA/mode/目标 absence，再证明，最后移动并逐项核末字节。
 * JSON 两脚本值和真实 child checker 路径单独核对，不把业务字符串／历史 probe 模板归一化掉。
 */
const fs = require('node:fs');
const cp = require('node:child_process');
const path = require('node:path');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');

const argv = process.argv.slice(2);
function option(name) {
  const at = argv.indexOf(name);
  assert(at >= 0 && at + 1 < argv.length && !argv[at + 1].startsWith('--'), `${name} required`);
  return argv[at + 1];
}
const requestedRepo = option('--repo');
const repo = fs.realpathSync(requestedRepo);
assert.equal(fs.realpathSync(process.cwd()), repo, 'run from the actual repository cwd');
const base = option('--base');
assert(/^[a-f0-9]{40}$/.test(base), 'explicit full --base required; no guessed future HEAD');
const prefix = option('--prefix');
assert(/^docs\/refactor\/generated\/[a-z0-9-]+-$/.test(prefix), 'one exact current generated prefix required');
assert(argv.includes('--apply'), 'Root must explicitly choose --apply; preparing this file executes nothing');
const proposalPath = path.resolve(option('--proposal'));
const proposalBytes = fs.readFileSync(proposalPath);
const sha = b => createHash('sha256').update(b).digest('hex');
const expectedProposal = 'ad90e9813f9e0b8977593faaabb14a5600ed06ad1a4b79c36576e3dffcaf64d2';
assert.equal(sha(proposalBytes), expectedProposal, 'use the exact cc70-reviewed 18-program/17-fragment proposal');
const proposal = JSON.parse(proposalBytes);
const ts = require(path.join(repo, 'backend/node_modules/typescript'));
const git = args => cp.execFileSync('git', args, { cwd: repo, maxBuffer: 64 * 1024 * 1024 });
assert.equal(git(['rev-parse', 'HEAD']).toString().trim(), base, 'capture the actual selected current Git');

function relative(p) {
  assert(p && !path.posix.isAbsolute(p) && !p.includes('\\') && !p.split('/').includes('..'));
  assert.equal(path.posix.normalize(p), p);
  return p;
}
function noSymlinkAncestors(p) {
  let at = repo;
  for (const part of relative(p).split('/').slice(0, -1)) {
    at = path.join(at, part);
    if (fs.existsSync(at)) assert(!fs.lstatSync(at).isSymbolicLink(), `symlink ancestor: ${p}`);
  }
}
function disk(p) {
  noSymlinkAncestors(p);
  const abs = path.join(repo, relative(p)), st = fs.lstatSync(abs);
  assert(st.isFile() && !st.isSymbolicLink(), `ordinary current file required: ${p}`);
  return { bytes: fs.readFileSync(abs), mode: st.mode & 0o100 ? '100755' : '100644' };
}
function exists(p) {
  noSymlinkAncestors(p);
  try { fs.lstatSync(path.join(repo, p)); return true; }
  catch (error) { if (error.code === 'ENOENT') return false; throw error; }
}
const tree = new Map(git(['ls-tree', '-rz', '--full-tree', base]).toString().split('\0').filter(Boolean).map(row => {
  const i = row.indexOf('\t'), [mode, kind, oid] = row.slice(0, i).split(' ');
  return [row.slice(i + 1), { mode, kind, oid }];
}));
const moves = new Map(proposal.mapping.map(r => [relative(r.from), relative(r.to)]));
assert.equal(moves.size, 9);
assert.equal(new Set(moves.values()).size, 9);
for (const [from, to] of moves) {
  assert.equal(path.posix.dirname(from), path.posix.dirname(to), 'basename-only move preserves dirname');
  assert.equal(path.posix.basename(to), path.posix.basename(from).replaceAll('_', '-'));
  assert(!tree.has(to) && !exists(to), `rename target must be absent in Git/current: ${to}`);
}
const route = p => moves.get(p) || p;
const beforeFiles = new Set(tree.keys());
const afterFiles = new Set([...beforeFiles].map(route));
let fragments = 0, moduleFragments = 0, nonmoduleFragments = 0;
const programs = proposal.files.map(r => {
  const entry = tree.get(r.path);
  assert(entry && entry.kind === 'blob' && ['100644', '100755'].includes(entry.mode));
  const original = git(['cat-file', 'blob', entry.oid]);
  const current = disk(r.path);
  assert.equal(current.mode, entry.mode, `current/Git mode mismatch: ${r.path}`);
  assert(current.bytes.equals(original), `current/Git full bytes mismatch: ${r.path}`);
  const before = original.toString('utf8');
  assert(Buffer.from(before).equals(original), 'UTF8 source required');
  let after = before;
  const exact = r.edits.map(e => {
    const offset = after.indexOf(e.before);
    assert(offset >= 0 && after.indexOf(e.before, offset + 1) < 0, `exact unique edit: ${r.path}`);
    assert.equal(e.count, 1);
    const step = { ...e, offsetAtApplication: offset };
    after = after.slice(0, offset) + e.after + after.slice(offset + e.before.length);
    fragments++;
    if (['ImportDeclaration', 'ExportDeclaration', 'require literal'].includes(e.kind)) moduleFragments++;
    else { assert(['package scripts value', 'child argv path.resolve'].includes(e.kind)); nonmoduleFragments++; }
    return step;
  });
  let inverse = after;
  for (const e of [...exact].reverse()) {
    assert.equal(inverse.slice(e.offsetAtApplication, e.offsetAtApplication + e.after.length), e.after);
    inverse = inverse.slice(0, e.offsetAtApplication) + e.before + inverse.slice(e.offsetAtApplication + e.after.length);
  }
  assert.equal(inverse, before, `whole inverse ${r.path}`);
  return { from: r.path, to: route(r.path), before, after, inverse, exact,
    mode: entry.mode, gitBlob: entry.oid, beforeSha256: sha(original), afterSha256: sha(after),
    preparedBeforeSameAsActualGit: r.beforeSha256 === sha(original) };
});
assert.equal(programs.length, 18);
assert.equal(fragments, 17); assert.equal(moduleFragments, 14); assert.equal(nonmoduleFragments, 3);
const outputs = ['before.json', 'proof.json', 'journal.jsonl'].map(suffix => prefix + suffix);
for (const p of outputs) assert(!exists(p), `never overwrite an earlier run: ${p}`);
const controlPaths = ['bun.lock', 'package.json', 'backend/tsconfig.json', 'backend/tsconfig.tests.json',
  'frontend/tsconfig.json', 'packages/replay-contract/package.json',
  'backend/tests/support/seer_baseline_request.json', 'tooling/refactor/fixtures/manifest.json'];
const controls = controlPaths.map(p => {
  const t = tree.get(p); assert(t && t.kind === 'blob'); const actual = disk(p);
  const original = git(['cat-file', 'blob', t.oid]);
  assert.equal(actual.mode, t.mode); assert(actual.bytes.equals(original), `control/Git drift: ${p}`);
  return { path: p, mode: t.mode, gitBlob: t.oid, sha256: sha(original) };
});
const replayPackage = JSON.parse(disk('packages/replay-contract/package.json').bytes);
assert.deepEqual(replayPackage.exports, { '.': './src/index.ts' });
assert.equal(replayPackage.types, './src/index.ts');

function writeFresh(p, value) {
  noSymlinkAncestors(p); fs.mkdirSync(path.dirname(path.join(repo, p)), { recursive: true });
  fs.writeFileSync(path.join(repo, p), JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
}
const before = { baseCommit: base, cwd: repo, prefix, proposalSha256: sha(proposalBytes), mapping: proposal.mapping,
  source: programs.map(r => ({ path: r.from, mode: r.mode, gitBlob: r.gitBlob, sha256: r.beforeSha256,
    text: r.before, preparedBeforeSameAsActualGit: r.preparedBeforeSameAsActualGit })),
  edits: programs.flatMap(r => r.exact.map(e => ({ path: r.from, targetPath: r.to, ...e }))), controls,
  policy: 'Actual selected Git/current is authoritative; use exact snippets, never overwrite with old prepared fullfiles.' };
writeFresh(prefix + 'before.json', before);

function parse(file, text) {
  const kind = /\.[cm]?js$/.test(file) ? ts.ScriptKind.JS : /\.tsx$/.test(file) ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, kind);
  assert.equal(sf.parseDiagnostics.length, 0, `syntax: ${file}`);
  return sf;
}
function references(sf) {
  const refs = [];
  function visit(n) {
    let expression;
    if (ts.isImportDeclaration(n) || ts.isExportDeclaration(n)) expression = n.moduleSpecifier;
    else if (ts.isExternalModuleReference(n)) expression = n.expression;
    else if (ts.isImportTypeNode(n) && ts.isLiteralTypeNode(n.argument)) expression = n.argument.literal;
    else if (ts.isCallExpression(n) && (n.expression.kind === ts.SyntaxKind.ImportKeyword ||
      ts.isIdentifier(n.expression) && n.expression.text === 'require' ||
      ts.isPropertyAccessExpression(n.expression) && n.expression.name.text === 'require')) expression = n.arguments[0];
    if (expression && ts.isStringLiteralLike(expression)) refs.push(expression);
    ts.forEachChild(n, visit);
  }
  visit(sf); return refs.sort((a, b) => a.getStart(sf) - b.getStart(sf));
}
function resolve(file, specifier, files) {
  const p = path.posix.normalize(path.posix.join(path.posix.dirname(file), specifier));
  const possibilities = [p, ...['.ts', '.tsx', '.mts', '.cts', '.js', '.jsx', '.mjs', '.cjs', '.json'].map(e => p + e),
    ...['index.ts', 'index.tsx', 'index.js', 'index.mjs', 'index.cjs'].map(e => p + '/' + e)];
  return possibilities.find(p => files.has(p));
}
const childFrom = 'backend/tests/architecture/engine-import-boundaries.test.ts';
function childNode(sf) {
  let result;
  function visit(n) {
    if (ts.isCallExpression(n) && n.expression.getText(sf) === 'path.resolve' && n.arguments.length === 2 &&
      n.arguments[0].getText(sf) === 'import.meta.dir' && ts.isStringLiteralLike(n.arguments[1]) &&
      /check[-_]import[-_]boundaries\.mjs$/.test(n.arguments[1].text)) {
      assert(!result, 'one exact actual child checker argument'); result = n.arguments[1];
    }
    ts.forEachChild(n, visit);
  }
  visit(sf); assert(result, 'actual child path.resolve/import.meta.dir site required'); return result;
}
function normalize(sf, file, files, isOld) {
  let text = sf.text;
  const replacements = references(sf).filter(n => n.text.startsWith('.')).map(n => {
    const resolved = resolve(file, n.text, files); assert(resolved, `unresolved relative module: ${file} ${n.text}`);
    return { start: n.getStart(sf), end: n.end, text: JSON.stringify('@module/' + (isOld ? route(resolved) : resolved)) };
  });
  if (file === childFrom) {
    const n = childNode(sf), resolved = resolve(file, n.text, files); assert(resolved);
    replacements.push({ start: n.getStart(sf), end: n.end,
      text: JSON.stringify('@actual-child-checker/' + (isOld ? route(resolved) : resolved)) });
  }
  for (const r of replacements.sort((a, b) => b.start - a.start)) text = text.slice(0, r.start) + r.text + text.slice(r.end);
  return text;
}
function shape(sf) {
  let nodes = 0, arrays = 0, leaves = 0;
  function typed(n) {
    nodes++; const children = [];
    ts.forEachChild(n, x => { children.push(typed(x)); }, a => {
      arrays++; children.push(['NodeArray', a.length, !!a.hasTrailingComma, ...a.map(typed)]);
    });
    return [n.kind, children];
  }
  function leaf(n) {
    const children = n.getChildren(sf).filter(x => x.kind < ts.SyntaxKind.FirstJSDocNode || x.kind > ts.SyntaxKind.LastJSDocNode);
    if (!children.length) { leaves++; return [n.kind, n.getText(sf)]; }
    return [n.kind, children.map(leaf)];
  }
  return { typed: typed(sf), tokens: leaf(sf), nodes, arrays, leaves };
}
function emit(text, file, module) {
  const result = ts.transpileModule(text, { fileName: file, reportDiagnostics: true,
    compilerOptions: { target: ts.ScriptTarget.ES2022, module, removeComments: true, allowJs: true } });
  // Transpile diagnostics are local emit/config facts, not a project type check.
  assert(!(result.diagnostics || []).some(d => d.category === ts.DiagnosticCategory.Error), `transpile: ${file}`);
  return result.outputText;
}
const proofPrograms = [], moduleTargets = [], nonmodule = [];
for (const r of programs) {
  if (r.from === 'backend/package.json') {
    assert.equal(r.exact.length, 2); const a = JSON.parse(r.before), b = JSON.parse(r.after);
    const expected = structuredClone(a);
    for (const [key, from, to] of [
      ['lint:boundaries', 'backend/scripts/check_import_boundaries.mjs', 'backend/scripts/check-import-boundaries.mjs'],
      ['lint:i18n', 'backend/scripts/check_i18n_literals.mjs', 'backend/scripts/check-i18n-literals.mjs'],
    ]) {
      assert.equal(a.scripts[key], 'bun ' + path.posix.relative('backend', from));
      assert.equal(b.scripts[key], 'bun ' + path.posix.relative('backend', to));
      assert.equal(route(from), to); expected.scripts[key] = b.scripts[key];
      nonmodule.push({ kind: 'package_script_value', file: r.from, key, cwd: 'backend', executable: 'bun',
        originalProgram: from, actualProgram: to, originalValue: a.scripts[key], actualValue: b.scripts[key] });
    }
    assert.deepEqual(b, expected); assert.equal(r.inverse, r.before);
    proofPrograms.push({ from: r.from, to: r.to, kind: 'JSON', beforeSHA256: r.beforeSha256, actualSHA256: r.afterSha256,
      exactWholeInverse: true, parsedDataOnlyTwoScriptValuesChanged: true, emittedOutputs: 0 });
    continue;
  }
  const old = parse(r.from, r.before), next = parse(r.to, r.after), aRefs = references(old), bRefs = references(next);
  assert.equal(aRefs.length, bRefs.length);
  for (let i = 0; i < aRefs.length; i++) {
    const a = aRefs[i], b = bRefs[i];
    assert.equal(a.kind, b.kind);
    if (a.text.startsWith('.')) {
      const original = resolve(r.from, a.text, beforeFiles), actual = resolve(r.to, b.text, afterFiles);
      assert(original && actual); assert.equal(route(original), actual);
      moduleTargets.push({ fromFile: r.from, actualFile: r.to, ordinal: i,
        originalSpecifier: a.text, actualSpecifier: b.text, originalTarget: original, actualTarget: actual });
    } else assert.equal(a.text, b.text, 'unchanged bare package/builtin module string');
  }
  // Every module edit must be at an actual module-syntax literal, not a matching comment/string.
  for (const e of r.exact.filter(e => ['ImportDeclaration', 'ExportDeclaration', 'require literal'].includes(e.kind))) {
    const at = r.before.indexOf(e.before);
    assert.equal(aRefs.filter(n => n.getStart(old) >= at && n.end <= at + e.before.length).length, 1);
  }
  if (r.from === childFrom) {
    const a = childNode(old), b = childNode(next), oldTarget = resolve(r.from, a.text, beforeFiles), newTarget = resolve(r.to, b.text, afterFiles);
    assert.equal(route(oldTarget), newTarget);
    nonmodule.push({ kind: 'actual_child_program_argument', file: r.from, callee: 'path.resolve',
      firstArgument: 'import.meta.dir', argumentIndex: 1, originalProgram: oldTarget, actualProgram: newTarget });
  }
  const a = normalize(old, r.from, beforeFiles, true), b = normalize(next, r.to, afterFiles, false);
  const sa = shape(parse(r.from, a)), sb = shape(parse(r.to, b)); assert.deepEqual(sa, sb);
  const emissions = [ts.ModuleKind.ESNext, ts.ModuleKind.CommonJS].map(module => {
    const original = emit(r.before, r.from, module), restored = emit(r.inverse, r.from, module);
    assert.equal(original, restored);
    let normalizedESNextSame = null;
    if (module === ts.ModuleKind.ESNext) { assert.equal(emit(a, r.from, module), emit(b, r.to, module)); normalizedESNextSame = true; }
    return { module: ts.ModuleKind[module], wholeInverseSame: true, normalizedESNextSame,
      originalSHA256: sha(original), actualSHA256: sha(emit(r.after, r.to, module)), inverseSHA256: sha(restored) };
  });
  proofPrograms.push({ from: r.from, to: r.to, kind: 'program', beforeSHA256: r.beforeSha256, actualSHA256: r.afterSha256,
    wholeInverse: true, normalizedTypedTokenNodeArraysSame: true, nodes: sa.nodes, arrays: sa.arrays, leaves: sa.leaves, outputs: emissions });
}
assert.equal(proofPrograms.filter(r => r.kind === 'program').length, 17);
assert.equal(nonmodule.length, 3);
const historicSeer = programs.find(r => r.from === 'backend/scripts/check_seer_baseline.mjs');
assert.equal(historicSeer.after, historicSeer.before, 'historical tool body is byte-preserved');
for (const value of proposal.protected.find(r => r.path === historicSeer.from).values)
  assert(historicSeer.before.includes(value) && historicSeer.after.includes(value), `historical template/fixture value: ${value}`);
const aliasTable = programs.find(r => r.from === 'packages/replay-contract/src/legacy_role_aliases.ts');
assert.equal(aliasTable.before, aliasTable.after, 'all frozen historical aliases remain exact bytes');
const sourcePrefix = s => s.startsWith('#!') ? s.slice(0, s.indexOf('\n')) : null;
for (const r of programs) assert.equal(sourcePrefix(r.before), sourcePrefix(r.after), 'executable source prefix preserved');

// Recheck all input bytes/modes and target absence immediately before the first source mutation.
for (const r of programs) { const current = disk(r.from); assert.equal(current.mode, r.mode); assert.equal(sha(current.bytes), r.beforeSha256); }
for (const to of moves.values()) assert(!exists(to));
for (const c of controls) { const current = disk(c.path); assert.equal(current.mode, c.mode); assert.equal(sha(current.bytes), c.sha256); }
const journal = event => fs.appendFileSync(path.join(repo, prefix + 'journal.jsonl'), JSON.stringify(event) + '\n');
fs.writeFileSync(path.join(repo, prefix + 'journal.jsonl'), '', { flag: 'wx' });
journal({ stage: 'all_static_proofs_and_preconditions_passed', baseCommit: base });
// Root owns this exclusive application window. Per-file operations are journalled, not a multi-file transaction.
for (const [from, to] of moves) {
  fs.renameSync(path.join(repo, from), path.join(repo, to)); journal({ renamed: from, to });
}
for (const r of programs) {
  fs.writeFileSync(path.join(repo, r.to), r.after);
  fs.chmodSync(path.join(repo, r.to), r.mode === '100755' ? 0o755 : 0o644);
  journal({ written: r.to, sha256: r.afterSha256, mode: r.mode });
}
for (const r of programs) { const actual = disk(r.to); assert.equal(actual.mode, r.mode); assert.equal(sha(actual.bytes), r.afterSha256); }
for (const from of moves.keys()) assert(!exists(from));
for (const c of controls) { const actual = disk(c.path); assert.equal(actual.mode, c.mode); assert.equal(sha(actual.bytes), c.sha256); }

const proof = { baseCommit: base, cwd: repo, prefix, applied: true,
  source: programs.map(r => ({ path: r.to, sha256: r.afterSha256, mode: r.mode })),
  deleted: [...moves].map(([from]) => ({ path: from, sha256: programs.find(r => r.from === from).beforeSha256, expectedAbsent: true })),
  controls, programs: proofPrograms, moduleTargets, nonmoduleReferences: nonmodule,
  publicAPI: { package: '@ai-werewolf-arena/replay-contract', exports: replayPackage.exports, types: replayPackage.types,
    sourceImportExportClauseAndNameOrderPreservedByNormalizedWholeProgram: true,
    physicalPrivatePathsRetired: true, wrappersAdded: false },
  protected: { seerFixedBaseline: 'eb4f026a38205d420cc2172b32fe23a29cb00da0', seerWholeBodySame: true,
    seerFixturePath: 'backend/tests/support/seer_baseline_request.json', frozenAliasTableWholeSame: true,
    sourceShebangPrefixesSame: true, beforeCurrentModeAndGitSame: true },
  summary: { physicalRenames: 9, completeInputs: 18, codePrograms: 17, packageJSON: 1,
    exactEdits: 17, moduleEdits: 14, nonModuleEdits: 3,
    relativeModuleTargetCorrespondences: moduleTargets.length, wholeInverseOutputs: 34, normalizedESNextOutputs: 17,
    packageJSONWholeInverse: true },
  limits: [
    '相对模块实际物理目标＋完整 import/export 名字/顺序由整程序归一化核对；不是最终 named declaration 或任意外部动态解析库存。',
    'JSON两script值与child checker路径单独列证；只有声明的精确非module位置归一化，历史嵌入probe和其它业务/fixture字符串原样。',
    '生命周期commentCategory正则/新增声明属于Root独立政策批，本helper不改它、不把其结果混入本17片段证明。',
    '未执行工程类型、业务测试、架构或i18n门禁/模型；编译仅whole transpile与AST比较。',
    '未知外部deep path、模块URL/缓存/堆栈/sourceHash变化不能冒任意JS反射或whole-cold等价。',
    '逐文件rename/write非多文件事务；首失败和journal/before保留，由Root按实际状态恢复，不自动覆盖重试。'
  ] };
writeFresh(prefix + 'proof.json', proof);
journal({ stage: 'application_and_whole_program_proofs_complete', summary: proof.summary });
console.log(JSON.stringify({ applied: true, baseCommit: base, ...proof.summary }));
