/**
 * 负责核对死亡贡献的完整实际领取／发布程序、通用接线与已保留程序。
 * 输入为真实 Git before 和当前八源；输出记录完整树与双模块输出、具体 API 反演范围和当前 SHA。
 * 原具体算法从现 owner 提取；接口新增、数组描述接线和私有布局变化明列，不用旧方法体掩盖候选。
 */
const fs=require('fs'),crypto=require('crypto'),ts=require(process.cwd()+'/backend/node_modules/typescript');
const prefix='docs/refactor/generated/typed-death-contribution-',before=JSON.parse(fs.readFileSync(prefix+'before.json','utf8'));
const sha=x=>crypto.createHash('sha256').update(x).digest('hex');
const old=p=>before.files.find(x=>x.path===p).text,read=p=>fs.readFileSync(p,'utf8');
const parse=text=>ts.createSourceFile('proof.ts',text,ts.ScriptTarget.Latest,true);
function tree(text){const sf=parse(text);let nodes=0;function v(n){if(n.kind===ts.SyntaxKind.EndOfFileToken||n.kind>=ts.SyntaxKind.FirstJSDocNode&&n.kind<=ts.SyntaxKind.LastJSDocNode)return null;nodes++;const c=[];for(const x of n.getChildren(sf)){const k=v(x);if(k!==null)c.push(k);}return c.length?[n.kind,c]:[n.kind,n.getText(sf)];}return {tree:v(sf),nodes};}
function mismatch(a,b,path=[]){if(JSON.stringify(a)===JSON.stringify(b))return null;if(Array.isArray(a)&&Array.isArray(b)){for(let i=0;i<Math.max(a.length,b.length);i++){const d=mismatch(a[i],b[i],[...path,i]);if(d)return d;}}return {path,a,b};}
function compare(label,a,b){const left=tree(a),right=tree(b);const emit=(text,module)=>ts.transpileModule(text,{compilerOptions:{target:ts.ScriptTarget.ES2022,module,removeComments:true}}).outputText;return {label,typedSame:JSON.stringify(left.tree)===JSON.stringify(right.tree),firstMismatch:mismatch(left.tree,right.tree),nodes:left.nodes,outputs:[ts.ModuleKind.ESNext,ts.ModuleKind.CommonJS].map(m=>({module:ts.ModuleKind[m],same:emit(a,m)===emit(b,m),wholeEmittedTreeSame:JSON.stringify(tree(emit(a,m)).tree)===JSON.stringify(tree(emit(b,m)).tree),beforeSHA:sha(emit(a,m)),mappedSHA:sha(emit(b,m))}))};}
function nodes(text,predicate){const sf=parse(text),out=[];function v(n){if(predicate(n))out.push(n);ts.forEachChild(n,c=>{v(c);});}v(sf);return {sf,out};}
function namedMethod(text,name){const {out}=nodes(text,n=>ts.isMethodDeclaration(n)&&n.name.getText()===name);if(out.length!==1)throw new Error('method_count:'+name);return out[0];}
function statements(text,method){return method.body.statements.map(n=>text.slice(n.pos,n.end)).join('\n');}
const ownerPath='backend/src/game/mechanisms/roles/wolf_beauty/death-wave-publication.ts',owner=read(ownerPath),ownerOld=old(ownerPath),prepare=namedMethod(owner,'prepare'),oldPrepare=namedMethod(ownerOld,'prepare'),pub=namedMethod(owner,'publishAfterDeaths'),oldPub=namedMethod(ownerOld,'publish');
const rows=[];
let actualPrepare=prepare.body.statements.slice(0,2).map(n=>owner.slice(n.pos,n.end)).join('\n');
let expectedPrepare=oldPrepare.body.statements.slice(0,-1).map(n=>ownerOld.slice(n.pos,n.end)).join('\n');
const runtimeMap=[['commands.attemptCharmTrigger','this.runtime.attemptCharmTrigger'],['commands.commitCharmDeath','this.runtime.commitCharmDeath'],['runtime.world','this.runtime.world'],['runtime.events','this.runtime.events']];
for(const [a,b]of runtimeMap)actualPrepare=actualPrepare.replaceAll(a,b);
actualPrepare=actualPrepare.replace('for (const proposal of proposals)','for (const proposal of result.charmLinks ?? [])').replace('runtime.blocksNightLinkedDeath(() => binding.targetId)','nightEffects?.dreams?.blocksNightCharm(this.runtime.world, binding.targetId, seen)');
rows.push(compare('实际完整领取/阻断/原容器写前缀（不含新增描述返回接口）',`function p(){${expectedPrepare}}`,`function p(){${actualPrepare}}`));
let actualPub=statements(owner,pub);for(const[a,b]of runtimeMap)actualPub=actualPub.replaceAll(a,b);rows.push(compare('实际完整 applied/事实发布程序',`function p(){${statements(ownerOld,oldPub)}}`,`function p(){${actualPub}}`));
const metadata=prepare.body.statements[2].getText(parse(owner));
const expectedMetadata='const linkedDeaths = charmTriggers.map(({ binding }) => ({ targetId: binding.targetId, addedCauses: [DeathCause.Charm], publicAdditionalDeath: true, }));';
rows.push(compare('完整后置元数据构造的独立字面契约',expectedMetadata,metadata));
const drPath='backend/src/game/engine/death_resolution.ts',dr=read(drPath),drOld=old(drPath);
const arrow=nodes(dr,n=>ts.isPropertyAssignment(n)&&n.name.getText()==='blocksNightLinkedDeath').out;
if(arrow.length!==1)throw new Error('one_protection_query');
rows.push(compare('实际保护 query 的 callee/World/惰性target/seen完整次序','const x = (target) => nightEffects?.dreams?.blocksNightCharm(this.world, target(), seen);','const x = '+arrow[0].initializer.getText()+';'));
// 此程序是新的通用接线，不声称多贡献算法原本存在。完整核其所有语句后，才映射当前单一真实生产者。
const driverStart=dr.indexOf('                const resolution = this;\n                const preparedContributions'),driverEnd=dr.indexOf('                for (const id of nightTargets)',driverStart),driver=dr.slice(driverStart,driverEnd);
const driverExpected=`const resolution = this;
const preparedContributions = (result.deathWaveContributions ?? []).map((contribution) => contribution.prepare({
get world() { return resolution.world; }, get events() { return resolution.events; },
blocksNightLinkedDeath: (target) => nightEffects?.dreams?.blocksNightCharm(this.world, target(), seen),
}, proposed, proposedSources, nightTargets, allSources, nativeHunterShotTargets, seen,),);
const contributedCauses = new Map<EntityId, readonly DeathCause[]>();
const publicContributionTargets = new Set<EntityId>();
for (const contribution of preparedContributions)
for (const linkedDeath of contribution.linkedDeaths) {
contributedCauses.set(linkedDeath.targetId, [
...new Set([
...(contributedCauses.get(linkedDeath.targetId) ?? []),
...linkedDeath.addedCauses,
]),
]);
if (linkedDeath.publicAdditionalDeath) publicContributionTargets.add(linkedDeath.targetId);
}`;
rows.push(compare('通用接线完整现体：准备与描述读前缀',driverExpected,driver));
let drMapped=dr.slice(0,driverStart)+drOld.slice(drOld.indexOf('                const charmTriggers ='),drOld.indexOf('                for (const id of nightTargets)',drOld.indexOf('                const charmTriggers =')))+dr.slice(driverEnd);
drMapped=drMapped.replace('if (contributedCauses.has(id))','if (charmTargets.has(id))').replace('...new Set([...(allSources[id] ?? []), ...contributedCauses.get(id)!]),','...new Set([...(allSources[id] ?? []), DeathCause.Charm]),').replace('publicContributionTargets.has(id) ||','charmTargets.has(id) ||').replace('for (const contribution of preparedContributions)\n                    contribution.publishAfterDeaths();','this.wolfBeautyDeathWave.publish(charmTriggers);');
const oldFieldStart=drOld.indexOf('  // 仅捕获结算器；关系领取／标死后发布'),oldFieldEnd=drOld.indexOf('  private readonly lastWordsMechanism',oldFieldStart),newFieldAt=drMapped.indexOf('  private readonly lastWordsMechanism');drMapped=drMapped.slice(0,newFieldAt)+drOld.slice(oldFieldStart,oldFieldEnd)+drMapped.slice(newFieldAt);
const oldImport=drOld.slice(drOld.indexOf('import {\n  attemptCharmTrigger,'),drOld.indexOf('import {\n  captureDeathShotEligibility,'));drMapped=drMapped.replace('import {\n  captureDeathShotEligibility,',oldImport+'import {\n  captureDeathShotEligibility,');
rows.push(compare('完整结算器经已核单生产者接口逆后的程序（不是当前多贡献运行二进制）',drOld,drMapped));
const hookPath='backend/src/game/mechanisms/roles/wolf_beauty/death_hook.ts',hook=read(hookPath),hookOld=old(hookPath);let hookMapped=hook;
const declStart=hookMapped.indexOf('  let proposals:'),declEnd=hookMapped.indexOf('\n  for (const actorId',declStart);hookMapped=hookMapped.slice(0,declStart)+hookMapped.slice(declEnd+1);const newBlockStart=hookMapped.indexOf('  if (proposals) {'),newBlockEnd=hookMapped.indexOf('  return result;',newBlockStart);const factoryBlock=hookMapped.slice(newBlockStart,newBlockEnd);rows.push(compare('生产者新增闭包/late命令装配完整体',`if (proposals) { result.deathWaveContributions = [createWolfBeautyDeathContribution(proposals, {get attemptCharmTrigger() { return attemptCharmTrigger; }, get commitCharmDeath() { return commitCharmDeath; },}),]; }`,factoryBlock));hookMapped=hookMapped.slice(0,newBlockStart)+hookMapped.slice(newBlockEnd);hookMapped=hookMapped.replace('(proposals ??= []).push','(result.charmLinks ??= []).push');hookMapped=hookMapped.replace('import { activeCharm, permitsCharm, attemptCharmTrigger, commitCharmDeath } from "./relation";\nimport { createWolfBeautyDeathContribution } from "./death-wave-publication";','import { activeCharm, permitsCharm } from "./relation";');rows.push(compare('完整真实 producer 原条件/绑定/旗标读序',hookOld,hookMapped));
const registryPath='backend/src/game/mechanisms/hooks/hook_registry.ts',registry=read(registryPath),registryOld=old(registryPath);let regMapped=registry.replace('import type { DeathWaveContribution } from "./death-wave-contribution";','import type { CharmBinding } from "../roles/wolf_beauty/relation";').replace('deathWaveContributions?: DeathWaveContribution[];','charmLinks?: Array<{ binding: CharmBinding; nightEffect: boolean }>;').replaceAll('deathWaveContributions','charmLinks');rows.push(compare('完整 Registry 仅结果字段/类型接口逆；每hook提交和聚合未屏蔽',registryOld,regMapped));
const comment=JSON.parse(read(prefix+'contract-before-comment.json'));rows.push(compare('契约职责时点末中文说明：完整非注释/双输出',comment.text,read(comment.path)));
const controls=before.controls.map(x=>({...x,currentSHA:sha(read(x.path)),same:sha(read(x.path))===x.sha256}));
const source=before.scope.map(path=>({path,sha256:sha(read(path))}));
const result={outputMethod:"记录双模块原始字节（保布局差异false），另核完整擦除后AST/全部非注释叶；无移除callback/数组/分支。不虚称布局字节相同。",base:before.base,source,rows,controls,counts:{regions:rows.length,nodes:rows.reduce((a,x)=>a+x.nodes,0),outputs:rows.reduce((a,x)=>a+x.outputs.length,0)},limits:['新增通用运行描述、生命周期callback及私有布局是显式API变化；完整现体验证之后的单一真实Wolf生产者逆，不代表任意外部多贡献行为原本存在。','每hook同步准备/实际mark/publication/aggregate原位，原机制资格/付款/夜flag规则不迁；literal metadata与完整保护query另强核。','旧class、CharmDeathWaveTrigger publictype、DeathHookResult.charmLinks退休；旧3case实际API输入/2退休字段断言变化明列，不把它们声称全程序相同。']};
fs.writeFileSync(prefix+'proof.json',JSON.stringify(result,null,2)+'\n');if(rows.some(x=>!x.typedSame||x.outputs.some(y=>!y.wholeEmittedTreeSame))||controls.some(x=>!x.same))throw new Error('complete_program_mapping_mismatch');console.log(JSON.stringify(result.counts));
