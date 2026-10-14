/**
 * 负责测试装配的精确来源／断言对照。输入为真实before和四处具名配置／导入／中文说明变更，
 * 输出完整旧程序逆、全部oracle及fixture方法保持；新配置API和模块I/O差异单列，不称运行全等价。
 */
const fs = require('node:fs'), crypto = require('node:crypto');
const ts = require(process.cwd() + '/backend/node_modules/typescript');
const prefix = 'docs/refactor/generated/paid-dream-fixture-';
const read = p => fs.readFileSync(p, 'utf8'), sha = s => crypto.createHash('sha256').update(s).digest('hex');
const before = JSON.parse(read(prefix + 'before.json'));
const edits = JSON.parse(read(prefix + 'edits.json')).edits;
const parse = (s, name = 'program.ts') => {
  const f = ts.createSourceFile(name, s, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  if (f.parseDiagnostics.length) throw Error('invalid_program');
  return f;
};
function tree(s) {
  let count = 0;
  function visit(n) {
    count++;
    const c = [];
    ts.forEachChild(n, child => { c.push(visit(child)); }, a => { c.push(['array', a.length, !!a.hasTrailingComma, ...a.map(visit)]); });
    return [n.kind, ...c];
  }
  return { value: visit(parse(s)), nodes: count };
}
function leaves(s) {
  const f = parse(s), result = [];
  function visit(n) {
    if (n.kind >= ts.SyntaxKind.FirstJSDocNode && n.kind <= ts.SyntaxKind.LastJSDocNode) return;
    const c = n.getChildren(f);
    if (!c.length) result.push([n.kind, n.getText(f)]);
    else for (const child of c) visit(child);
  }
  visit(f);
  return result;
}
function compare(a, b) {
  const A = tree(a), B = tree(b);
  return { nodes: A.nodes, typedASTSame: JSON.stringify(A.value) === JSON.stringify(B.value), allNoncommentLeavesSame: JSON.stringify(leaves(a)) === JSON.stringify(leaves(b)), wholeOutputs: [ts.ModuleKind.ESNext, ts.ModuleKind.CommonJS].map(module => {
    const options = { module, target: ts.ScriptTarget.ES2022, removeComments: true };
    const A = ts.transpileModule(a, { compilerOptions: options }).outputText, B = ts.transpileModule(b, { compilerOptions: options }).outputText;
    return { module: ts.ModuleKind[module], wholeRawSame: A === B, beforeSHA: sha(A), inverseSHA: sha(B) };
  }) };
}
const current = read(before.source.path);
let inverse = current;
for (const e of [...edits].reverse()) {
  const chars = Array.from(inverse), n = Array.from(e.new).length;
  if (chars.slice(e.start, e.start + n).join('') !== e.new) throw Error('actual_delta:' + e.label);
  chars.splice(e.start, n, ...Array.from(e.old));
  inverse = chars.join('');
}
const whole = compare(before.source.text, inverse);
// 所有原expected完整链／标题／fixture和provider方法都由实际AST取出，不删掉失败oracle。
function observables(s) {
  const f = parse(s), expectations = [], titles = [], methods = [];
  function visit(n) {
    if (ts.isCallExpression(n)) {
      if (n.expression.getText(f) === 'expect') {
        let chain = n;
        while (chain.parent && ((ts.isPropertyAccessExpression(chain.parent) && chain.parent.expression === chain) || (ts.isCallExpression(chain.parent) && chain.parent.expression === chain))) chain = chain.parent;
        expectations.push(leaves(chain.getText(f)));
      }
      if (n.expression.getText(f) === 'test') titles.push(leaves(n.arguments[0].getText(f)));
    }
    if (ts.isFunctionDeclaration(n) && n.name?.text === 'fixture') methods.push(['fixture', leaves(n.getText(f))]);
    if (ts.isMethodDeclaration(n)) methods.push([n.name.getText(f), leaves('class Fixture { ' + n.getText(f) + ' }')]);
    ts.forEachChild(n, c => { visit(c); });
  }
  visit(f);
  return { expectations, titles, methods };
}
const original = observables(before.source.text), next = observables(current);
const controls = before.controls.map(c => ({ ...c, currentWholeBytesSame: sha(read(c.path)) === c.sha256 }));
const actual = parse(current), config = actual.statements.filter(ts.isVariableStatement).flatMap(n => [...n.declarationList.declarations]).find(n => n.name.getText(actual) === 'config');
const configSource = config.initializer.getText(actual);
const expected = 'parseBoardDefinition(JSON.parse(readFileSync(new URL("../../../../../configs.example/boards/awa_radiant_eclipse_12_v1.json", import.meta.url), "utf8",),),).config';
// 有效尾逗号单列，不能遮其它字段／callback；实际初始化式必须全部token同。
const removeTrailingCommas = text => leaves(text).filter((v, i, all) => !(v[1] === ',' && [')', ']'].includes(all[i + 1]?.[1])));
const configFullyMatches = JSON.stringify(removeTrailingCommas(configSource)) === JSON.stringify(removeTrailingCommas(expected));
const result = { baseCommit: before.baseCommit, source: { path: before.source.path, sha256: sha(current) }, exactDeclaredEdits: edits.length, inverseWholeSourceBytesSame: inverse === before.source.text, wholeProgram: whole, allOriginalOracleChainsSame: JSON.stringify(original.expectations) === JSON.stringify(next.expectations), staticOracleChainCount: original.expectations.length, testTitleDeclarationsSame: JSON.stringify(original.titles) === JSON.stringify(next.titles), testTitleDeclarations: original.titles.length, allOriginalFixtureAndStageMethodsSame: JSON.stringify(original.methods) === JSON.stringify(next.methods), fixtureAndMethodCount: original.methods.length, actualConfigurationInitializerFullyMatchesPublicParser: configFullyMatches, controls, limits: ['原3cases中2为参数化同title声明；静态oracle链数不是运行assert计数，实际3/30按独立收据。', '这是配置输入合法化与新增公开文件读取/解析I/O；完整逆与不变oracle不宣称旧无效输入和新合法输入行为等价。', '只改这个测试文件，生产六控制源／公开JSON原字节不改；不放宽谓词、绕过stock/owned配置。'] };
result.approved = result.inverseWholeSourceBytesSame && whole.typedASTSame && whole.allNoncommentLeavesSame && whole.wholeOutputs.every(o => o.wholeRawSame) && result.allOriginalOracleChainsSame && result.testTitleDeclarationsSame && result.allOriginalFixtureAndStageMethodsSame && configFullyMatches && controls.every(c => c.currentWholeBytesSame);
fs.writeFileSync(prefix + 'proof.json', JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify({ approved: result.approved, nodes: whole.nodes, wholeOutputs: 2, staticOracleChains: original.expectations.length, titleDeclarations: original.titles.length, fixtureAndMethods: original.methods.length, controls: controls.length }));
if (!result.approved) process.exitCode = 1;
