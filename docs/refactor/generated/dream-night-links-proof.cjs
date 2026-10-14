/**
 * 负责本批真实源码映射的完整语法／输出对照。输入为固定 Git before、实际当前源及具名精确编辑；
 * 输出区分迁移逆接线、全数组引用所有者与真实控制源，不把新存储 API 宣称成旧外部接受面等价。
 * 所有子节点／数组和语法叶都参与比较；不恢复整个旧实现来遮盖新 owner 的程序或测试断言。
 */
const fs = require('node:fs');
const crypto = require('node:crypto');
const ts = require(process.cwd() + '/backend/node_modules/typescript');
const prefix = 'docs/refactor/generated/dream-night-links-';
const read = p => fs.readFileSync(p, 'utf8');
const sha = s => crypto.createHash('sha256').update(s).digest('hex');
const before = JSON.parse(read(prefix + 'before.json'));
const edits = JSON.parse(read(prefix + 'edits.json')).edits;
const gitProof = JSON.parse(read(prefix + 'git-before-proof.json'));
if (gitProof.baseCommit !== before.baseCommit) throw Error('false_git_proof_commit');
function parse(s, name = 'program.ts') {
  const f = ts.createSourceFile(name, s, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  if (f.parseDiagnostics.length) throw Error('invalid_program:' + name);
  return f;
}
function tree(s) {
  let count = 0;
  function walk(n) {
    count++;
    const children = [];
    ts.forEachChild(n, c => { children.push(walk(c)); }, a => {
      children.push(['array', a.length, !!a.hasTrailingComma, ...a.map(walk)]);
    });
    return [n.kind, ...children];
  }
  const value = walk(parse(s));
  return { count, sha256: sha(JSON.stringify(value)) };
}
function leaves(s) {
  const f = parse(s), out = [];
  function walk(n) {
    if (n.kind >= ts.SyntaxKind.FirstJSDocNode && n.kind <= ts.SyntaxKind.LastJSDocNode) return;
    const children = n.getChildren(f);
    if (!children.length) out.push([n.kind, n.getText(f)]);
    else for (const c of children) walk(c);
  }
  walk(f);
  return out;
}
function compare(a, b) {
  const A = tree(a), B = tree(b);
  return {
    nodes: A.count,
    typedTreeSame: A.sha256 === B.sha256,
    fullNoncommentLeavesSame: JSON.stringify(leaves(a)) === JSON.stringify(leaves(b)),
    wholeOutputs: [ts.ModuleKind.ESNext, ts.ModuleKind.CommonJS].map(module => {
      const opts = { module, target: ts.ScriptTarget.ES2022, removeComments: true };
      const x = ts.transpileModule(a, { compilerOptions: opts }).outputText;
      const y = ts.transpileModule(b, { compilerOptions: opts }).outputText;
      return { module: ts.ModuleKind[module], wholeRawSame: x === y, beforeSHA: sha(x), inverseSHA: sha(y) };
    }),
  };
}
// start 为生成映射时的 Unicode code point 位置，不能拿它冒 UTF-16 偏移。
function inverse(path, source) {
  let value = source;
  for (const e of edits.filter(e => e.path === path).reverse()) {
    const chars = Array.from(value), start = e.start, count = Array.from(e.new).length;
    if (chars.slice(start, start + count).join('') !== e.new) throw Error('actual_delta_mismatch:' + path + ':' + e.label);
    chars.splice(start, count, ...Array.from(e.old));
    value = chars.join('');
  }
  return value;
}
const source = before.sourceScope.map(path => ({ path, sha256: sha(read(path)) }));
const programs = before.before.map(file => {
  const fixed = gitProof.before.find(x => x.path === file.path);
  const git = file.text;
  if (!fixed?.wholeBytesSameCaptured || fixed.sha256 !== file.sha256 || sha(git) !== fixed.sha256) throw Error('false_git_before:' + file.path);
  const current = read(file.path), mapped = inverse(file.path, current);
  return { path: file.path, inverseWholeSourceBytesSame: mapped === git, edits: edits.filter(e => e.path === file.path).map(e => e.label), ...compare(git, mapped) };
});
const ownerPath = 'backend/src/game/mechanisms/roles/dreamer/night-links.ts';
const owner = read(ownerPath);
const expectedOwner = `import type { DreamNightLink } from "./night_frame";
const linksByState = new WeakMap<object, DreamNightLink[]>();
function ownedLinks(state: object): DreamNightLink[] {
  let links = linksByState.get(state);
  if (!links) {
    links = [];
    linksByState.set(state, links);
  }
  return links;
}
export function dreamNightLinksForAppend(state: object): DreamNightLink[] {
  return ownedLinks(state);
}
export function readDreamNightLinks(state: object): readonly DreamNightLink[] {
  return ownedLinks(state);
}
export function installDreamNightLinks(state: object, links: DreamNightLink[]): void {
  linksByState.set(state, links);
}
`;
const ownerProgram = compare(expectedOwner, owner);
const facetPath = 'backend/src/game/mechanisms/roles/dreamer/night-ports.ts';
const facetProgram = compare('export { readDreamNightLinks } from "./night-links";\n', read(facetPath));
const ownerFile = parse(owner), facetFile = parse(read(facetPath));
const ownerRuntime = ts.transpileModule(owner, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, removeComments: true } }).outputText;
const runtimeFile = parse(ownerRuntime), ownerValueEdges = runtimeFile.statements.filter(n => (ts.isImportDeclaration(n) || ts.isExportDeclaration(n)) && n.moduleSpecifier).length;
if (ownerFile.statements.filter(ts.isVariableStatement).length !== 1 || ownerFile.statements.filter(ts.isFunctionDeclaration).length !== 4 || ownerValueEdges !== 0) throw Error('unexpected_new_owner_state_or_dependency');
if (facetFile.statements.length !== 1 || !ts.isExportDeclaration(facetFile.statements[0]) || facetFile.statements[0].moduleSpecifier.text !== './night-links') throw Error('facet_became_aggregation');
const controls = before.controls.map(c => {
  const fixed = gitProof.controls.find(x => x.path === c.path);
  return { ...c, capturedSameGit: !!fixed?.wholeBytesSameCaptured && fixed.sha256 === c.sha256, currentWholeBytesSame: sha(read(c.path)) === c.sha256 };
});
const typeBefore = JSON.parse(read(prefix + 'test-typefix-before.json'));
const typeOnlyTestFix = { path: typeBefore.path, beforeSHA: typeBefore.sha256, sourceSHA: sha(read(typeBefore.path)), ...compare(typeBefore.text, read(typeBefore.path)) };
// 该型断言允许 AST 不同，只有完整擦除后的两种输出必须相同，不把型节点差异伪称同程序。
const same = x => x.typedTreeSame && x.fullNoncommentLeavesSame && x.wholeOutputs.every(o => o.wholeRawSame);
const result = {
  baseCommit: before.baseCommit, source, existingPrograms: programs,
  newOwner: { path: ownerPath, wholeLiteralProgram: ownerProgram, valueDependencies: ownerValueEdges, uniqueWeakMap: true, originalArrayReference: true, functions: 4 },
  publicNightFacet: { path: facetPath, wholeProgram: facetProgram, actualEdge: ownerPath, noOwnerReturnValueEdges: true },
  controls, typeOnlyTestFix,
  inputAPIMigrations: [
    '29 empty literal fields retire; generic required field/import and Pick view retire without adding runtime state getter.',
    'Producer only takes owned same array at original push lookup; history/use/commit/link fields/event body and await policies remain.',
    'Composition original constructor stays; first argument family lookup consumes original claims identity before original shelters argument.',
    'Two actual getter traces retire explicitly; original failure assertions and other prefix trace entries remain, old sample/log preserved.',
    'Nonempty fixture installs same original array; all frame-after-append, death/reason/effect/receiver oracles remain.',
    'Paid-radiant sample query captures same owned array; original actions/error/oracles unchanged, known preset-invalid case remains red in actual baseline and current.'
  ],
  limits: ['33 whole programs are an exact declared-source inverse, not new storage/API/external property acceptance equivalence.', 'New owner hand literal is complete actual storage program, not a replacement of a hidden old implementation.', 'Local runtime dependency argument only new owner/facet; no full historical load graph, gate, model or archive compatibility claim.'],
};
result.approved = programs.every(p => p.inverseWholeSourceBytesSame && same(p)) && same(ownerProgram) && same(facetProgram) && controls.every(c => c.capturedSameGit && c.currentWholeBytesSame) && typeOnlyTestFix.wholeOutputs.every(o => o.wholeRawSame);
fs.writeFileSync(prefix + 'proof.json', JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify({ approved: result.approved, existingPrograms: programs.length, existingNodes: programs.reduce((s, p) => s + p.nodes, 0), existingWholeOutputs: programs.length * 2, newOwnerNodes: ownerProgram.nodes, facetNodes: facetProgram.nodes, controls: controls.length, typeFixRaw: typeOnlyTestFix.wholeOutputs.map(o => o.wholeRawSame), ownerValueEdges }));
if (!result.approved) process.exitCode = 1;
