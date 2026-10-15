/** 本工具核实际完整规则正文与保留 profile，不用恢复旧 callback 来伪造迁移等价。 */
const fs=require('node:fs'),crypto=require('node:crypto'),ts=require(process.cwd()+'/backend/node_modules/typescript');
const prefix='docs/refactor/generated/seer-tool-admission-',read=p=>fs.readFileSync(p,'utf8'),sha=s=>crypto.createHash('sha256').update(s).digest('hex');
const before=JSON.parse(read(prefix+'before.json')), edits=JSON.parse(read(prefix+'edits.json'));
const current=read(before.source.path), owner=read(edits.owner);
function parse(s){const f=ts.createSourceFile('program.ts',s,99,true,ts.ScriptKind.TS);if(f.parseDiagnostics.length)throw Error('invalid_program');return f;}
function program(s){const f=parse(s);let nodes=0;function visit(n){nodes++;const children=[];ts.forEachChild(n,c=>{children.push(visit(c));},a=>{children.push(['array',a.length,!!a.hasTrailingComma,...a.map(visit)]);});return[n.kind,...children];}const tree=visit(f),leaves=[];function walk(n){if(n.kind>=ts.SyntaxKind.FirstJSDocNode&&n.kind<=ts.SyntaxKind.LastJSDocNode)return;const children=n.getChildren(f);if(children.length)for(const c of children)walk(c);else leaves.push([n.kind,n.getText(f)]);}walk(f);return{nodes,tree,leaves};}
function compare(A,B){const a=program(A),b=program(B);return{originalNodes:a.nodes,candidateNodes:b.nodes,completeTypedTreeSame:JSON.stringify(a.tree)===JSON.stringify(b.tree),originalNoncommentLeaves:a.leaves.length,completeNoncommentLeavesSame:JSON.stringify(a.leaves)===JSON.stringify(b.leaves),wholeOutputs:[ts.ModuleKind.ESNext,ts.ModuleKind.CommonJS].map(module=>{const options={module,target:ts.ScriptTarget.ES2022,removeComments:true};const oldOut=ts.transpileModule(A,{compilerOptions:options}).outputText,nextOut=ts.transpileModule(B,{compilerOptions:options}).outputText;return{module:ts.ModuleKind[module],wholeRawSame:oldOut===nextOut,originalSHA:sha(oldOut),candidateSHA:sha(nextOut)};})};}
const f=parse(owner), declaration=f.statements.filter(ts.isVariableStatement).flatMap(n=>[...n.declarationList.declarations]).find(d=>d.name.getText(f)==='SEER_VALIDATION_RULES');
if(!declaration||!ts.isObjectLiteralExpression(declaration.initializer))throw Error('actual_owner_missing');
const actualMap=declaration.initializer.getText(f), originalMap=before.originalMap.text;
const mapProof=compare('const actualTable = '+originalMap+';','const actualTable = '+actualMap+';');
// 声明／import 精确逆只处理其余五处，完整算法另由真实新 initializer 与真实 old literal 比。
let retained=current;
for(const e of [...edits.profileEdits].reverse()){
 if(e.label==='owned_complete_rule_table')continue;
 const i=retained.indexOf(e.new);
 if(e.new===''){
  // 空删除按其它逆完成后复用原来源邻接点，不能依空字符串替换掉整个程序。
  continue;
 }
 if(i<0||retained.indexOf(e.new,i+e.new.length)>=0)throw Error('nonunique_exact_edit:'+e.label);
 retained=retained.slice(0,i)+e.old+retained.slice(i+e.new.length);
}
// 两个删除的 import 使用明确旧邻接绑定，保其原位置，不恢复业务正文。
retained=retained.replace('import { roleName, text, term }','import { RuleError } from "@ai-werewolf-arena/game-contract";\nimport { roleName, text, term }');
retained=retained.replace('import { activeNightAbility }','import { isAliveTarget } from "../../validation/contracts";\nimport { activeNightAbility }');
const expectedRetained=before.source.text.replace(originalMap,'SEER_VALIDATION_RULES');
const retainedProof=compare(expectedRetained,retained);
// 实际新 initializer 放回原 property 的作用域，只做声明／import 逆，保真实迁出的算法。
const integrated=retained.replace('validationRules: SEER_VALIDATION_RULES','validationRules: '+actualMap);
const integratedProof=compare(before.source.text,integrated);
const controls=before.controls.map(c=>({...c,currentSame:sha(read(c.path))===c.sha256}));
const canaries=[
 ['non-first policy target argument',actualMap.replace('seerTargetAllowed(ability.state, actorId, toolCall.args.target_id)','seerTargetAllowed(ability.state, actorId, actorId)')],
 ['last history day default',actualMap.replace('day ?? 1, "check", toolCall.args.target_id','day ?? 2, "check", toolCall.args.target_id')],
].map(([name,changed])=>({name,actualBodyMutation:changed!==actualMap,rejected:!compare('const actualTable = '+originalMap+';','const actualTable = '+changed+';').completeNoncommentLeavesSame}));
const result={baseCommit:before.baseCommit,source:[{path:before.source.path,sha256:sha(current)},{path:edits.owner,sha256:sha(owner)}],originalMapSHA:before.originalMap.sha256,actualNewMapSHA:sha(actualMap),actualCompleteTable:mapProof,retainedProfile:{exactFiveDeclarationEditsInverseWithAlgorithmInSeparateProof:true,wholeRetainedSourceBytesSame:retained===expectedRetained,...retainedProof},integratedProfileWithActualNewInitializer:integratedProof,controls,negativeNonfirstChildChecks:canaries,limits:['实际完整 table 正文来自新 owner initializer；没有用旧 whole callback 恢复来替代该正文比较。','保留程序的 symbolized 表位点只是将已独立完整核对的本体分区；另以真实新本体放回 property 比完整 profile。','所有 mapped 输出保源码程序，不声称真实模块位置／加载图／新出口布局全等价。']};
result.approved=mapProof.completeTypedTreeSame&&mapProof.completeNoncommentLeavesSame&&mapProof.wholeOutputs.every(o=>o.wholeRawSame)&&retained===expectedRetained&&retainedProof.completeTypedTreeSame&&retainedProof.completeNoncommentLeavesSame&&integratedProof.completeTypedTreeSame&&integratedProof.completeNoncommentLeavesSame&&integratedProof.wholeOutputs.every(o=>o.wholeRawSame)&&controls.every(c=>c.currentSame)&&canaries.every(c=>c.actualBodyMutation&&c.rejected);
fs.writeFileSync(prefix+'proof.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({approved:result.approved,mapNodes:mapProof.originalNodes,retainedNodes:retainedProof.originalNodes,integratedNodes:integratedProof.originalNodes,wholeOutputs:6,controls:controls.length,canaries}));if(!result.approved)process.exitCode=1;
