/**
 * 负责本次夜间组合迁移的完整算法与流水线程序比对，输入为实际Git before和当前源码。
 * 输出为逐叶AST及完整打印运行程序证据；只逆明确路由／接口，不替换待测业务主体。
 * 不执行对局、改变源码或宣称新增模块初始化与任意反射等价。
 */
const fs = require('fs'), cp = require('child_process'), crypto = require('crypto');
const ts = require('../../../backend/node_modules/typescript');
const sha = s => crypto.createHash('sha256').update(s).digest('hex');
const parse = s => ts.createSourceFile('input.ts', s, ts.ScriptTarget.Latest, true);
function signature(s) {
  const sf = parse(s), nodes = [];
  function visit(n) {
    if (n.kind >= ts.SyntaxKind.FirstJSDocNode && n.kind <= ts.SyntaxKind.LastJSDocNode || n.kind === ts.SyntaxKind.EndOfFileToken) return;
    const children = n.getChildren(sf).filter(c => !(c.kind >= ts.SyntaxKind.FirstJSDocNode && c.kind <= ts.SyntaxKind.LastJSDocNode) && c.kind !== ts.SyntaxKind.EndOfFileToken);
    nodes.push([n.kind, children.length ? null : n.getText(sf)]);
    for (const c of children) visit(c);
  }
  visit(sf);return nodes;
}
const rows = [];
function same(label, old, current) {
  const a = signature(old), b = signature(current), equal = JSON.stringify(a) === JSON.stringify(b);
  rows.push({ label, nodes:a.length, same:equal, beforeSHA256:sha(JSON.stringify(a)), mappedSHA256:sha(JSON.stringify(b)) });
  if (!equal) throw Error('whole_program_mismatch:'+label);
}
const before = JSON.parse(fs.readFileSync('docs/refactor/generated/night-readability-before.json'));
for (const row of before.source) if (sha(cp.execFileSync('git',['show',before.base+':'+row.path]))!==row.sha256 || sha(row.text)!==row.sha256) throw Error('before_bytes_mismatch:'+row.path);
const blocks = JSON.parse(fs.readFileSync('docs/refactor/generated/night-readability-original-blocks.json'));
const owner = fs.readFileSync('backend/src/rulesets/night-readability.ts','utf8'), sf = parse(owner);
function body(name) { const n=sf.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name.text===name);if(!n)throw Error('missing_actual_owner');return n.body.getText(sf); }
const setup = body('assertNightSetupReady').replaceAll('runtime.world()','this.world');
let readable = body('assertNightReadable').replaceAll('runtime.world()','this.world').replaceAll('runtime.config()','config');
for (const key of ['ownsAnimal','ownsFragrant','ownsNoble','ownsRadiant','ownsMist','ownsDemon']) readable=readable.replaceAll('runtime.'+key+'()',key);
same('完整四设置判断来自actual新owner', 'function p(){'+blocks.setup+'}', 'function p()'+setup);
same('完整逐名单和marks算法来自actual新owner', blocks.readability, 'const assertReadable = () => '+readable+';');
const path=before.source[0].path, pipeline=fs.readFileSync(path,'utf8'), psf=parse(pipeline), classDecl=psf.statements.find(ts.isClassDeclaration), execute=classDecl.members.find(n=>ts.isMethodDeclaration(n)&&n.name.getText(psf)==='execute');
const stmts=execute.body.statements;
if(stmts[0].getText(psf)!=='assertNightSetupReady({ world: () => this.world });')throw Error('setup_caller_changed');
const tryStatement=stmts.find(ts.isTryStatement), tryStatements=tryStatement.tryBlock.statements;
const runtimeStatement=tryStatements[1], actualExpected='const readability = {world:()=>this.world,config:()=>config,ownsAnimal:()=>ownsAnimal,ownsFragrant:()=>ownsFragrant,ownsNoble:()=>ownsNoble,ownsRadiant:()=>ownsRadiant,ownsMist:()=>ownsMist,ownsDemon:()=>ownsDemon,};';
same('八现场查询完整无早读',actualExpected,runtimeStatement.getText(psf));
if(tryStatements[2].getText(psf)!=='const assertReadable = () => assertNightReadable(readability);')throw Error('readability_caller_changed');
let inverse=pipeline.replace(stmts[0].getText(psf),setup.slice(1,-1)).replace(runtimeStatement.getText(psf),'').replace(tryStatements[2].getText(psf),'const assertReadable = () => '+readable+';');
const old=before.source[0].text;
function nonImports(s) { const sf=parse(s);return sf.statements.filter(n=>!ts.isImportDeclaration(n)).map(n=>n.getText(sf)).join('\n'); }
same('完整pipeline去掉明确imports后的程序',nonImports(old),nonImports(inverse));
// 新port仅加原同binding query，既有声明和其它runtime函数完整不改。
for(const row of before.source.slice(1)) {
  const current=fs.readFileSync(row.path,'utf8'), name=row.path.includes('nightmare')?'assertNightmareRosterCurrent':'assertEvilKnightRosterCurrent';
  same('完整publicport只逆新增同binding:'+name,row.text,current.replace(', '+name+' }',' }'));
}
const output=[];
for(const module of [ts.ModuleKind.ESNext,ts.ModuleKind.CommonJS]) {
  const emit=s=>ts.transpileModule(nonImports(s),{compilerOptions:{target:ts.ScriptTarget.ES2022,module,removeComments:true}}).outputText;
  const a=emit(old),b=emit(inverse); if(a!==b)throw Error('full_nonimport_emit_mismatch');output.push({module:ts.ModuleKind[module],wholeNonimportRawSame:true,sha256:sha(a)});
}
const paths=[...before.source.map(s=>s.path),'backend/src/rulesets/night-readability.ts','backend/tests/unit/rulesets/night-readability.test.ts'];
const scope={base:before.base,source:paths.map(path=>({path,sha256:sha(fs.readFileSync(path))}))};
fs.writeFileSync('docs/refactor/generated/night-readability-program-proof.json',JSON.stringify({base:before.base,rows,outputs:output,approved:true,limits:'当前新owner完整业务段精确接口逆与完整流水线非import程序；新增imports/moduleinit/callbackdispatch/stack是明确差异，非全binary等价。'},null,2)+'\n');
fs.writeFileSync('docs/refactor/generated/night-readability-scope-final.json',JSON.stringify(scope,null,2)+'\n');
console.log(JSON.stringify({regions:rows.length,nodes:rows.reduce((n,r)=>n+r.nodes,0),outputs:output.length,sources:paths.length}));
