/** 完整核对五保留程序及实际复验函数／三个门控点的明确接线逆；不运行模型、规则或再跑类型／头。 */
const fs=require('node:fs'),cp=require('node:child_process'),crypto=require('node:crypto'),ts=require('../../../backend/node_modules/typescript');
const prefix='docs/refactor/generated/scholar-bonus-effect-validation-';
const before=JSON.parse(fs.readFileSync(prefix+'before.json','utf8')), edits=JSON.parse(fs.readFileSync(prefix+'edits.json','utf8')).edits;
const sha=x=>crypto.createHash('sha256').update(x).digest('hex');
const parse=x=>ts.createSourceFile('body.ts',x,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS);
function syntax(text){const sf=parse(text),out=[];function visit(n){if(n.kind>=ts.SyntaxKind.FirstJSDocNode&&n.kind<=ts.SyntaxKind.LastJSDocNode)return;const children=[];ts.forEachChild(n,c=>{children.push(c);});out.push([n.kind,children.length?null:n.getText(sf)]);for(const c of children)visit(c);}visit(sf);return out;}
const emit=(text,file,module)=>ts.transpileModule(text,{fileName:file,compilerOptions:{target:ts.ScriptTarget.ES2022,module,removeComments:true}}).outputText;
let typedNodes=0,wholeMappedOutputs=0;
const whole=before.source.map(row=>{
 const git=cp.execFileSync('git',['show',before.baseCommit+':'+row.path],{encoding:'utf8'});if(git!==row.text||sha(git)!==row.sha256)throw Error('actual_git_before');
 const now=fs.readFileSync(row.path,'utf8'),changes=edits.filter(e=>e.path===row.path);let forward=git;
 for(const e of [...changes].sort((a,b)=>b.beforeStart-a.beforeStart)){if(forward.slice(e.beforeStart,e.beforeEnd)!==e.before)throw Error('forward_span');forward=forward.slice(0,e.beforeStart)+e.after+forward.slice(e.beforeEnd);}
 if(forward!==now)throw Error('whole_forward');let inverse=now;
 for(const e of [...changes].sort((a,b)=>b.afterStart-a.afterStart)){if(inverse.slice(e.afterStart,e.afterEnd)!==e.after)throw Error('inverse_span');inverse=inverse.slice(0,e.afterStart)+e.before+inverse.slice(e.afterEnd);}
 if(inverse!==git)throw Error('whole_inverse');typedNodes+=syntax(git).length;
 const outputs=[['ESNext',ts.ModuleKind.ESNext],['CommonJS',ts.ModuleKind.CommonJS]].map(([name,module])=>{const a=emit(git,row.path,module);if(a!==emit(inverse,row.path,module))throw Error('whole_emit');wholeMappedOutputs++;return {module:name,sha256:sha(a),wholeMappedSame:true};});return {path:row.path,currentSHA256:sha(now),originalGitSHA256:row.sha256,completeForward:true,completeInverse:true,edits:changes.length,outputs};
});
const oldStage=before.source.find(x=>x.path.endsWith('/night_stages.ts')).text;
function declaration(text,name){const sf=parse(text),fn=sf.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text===name);if(!fn)throw Error('named_function_missing');return fn.getText(sf);}
const moved=declaration(fs.readFileSync('backend/src/game/mechanisms/roles/scholar_mentor/bonus-effect-validation.ts','utf8'),'assertScholarMentorBonusEffects');
const original=declaration(oldStage,'assertScholarMentorBonusEffects');if(JSON.stringify(syntax(moved))!==JSON.stringify(syntax(original)))throw Error('complete_validation_changed');
const currentRule=fs.readFileSync('backend/src/rulesets/night-damage-composition.ts','utf8'),gate=declaration(currentRule,'assertNightModifierBonusEffects');
const gateBody=parse(gate).statements[0].body.statements.map(x=>x.getText()).join('\n');
const oldRule=before.source.find(x=>x.path.endsWith('/night-damage-composition.ts')).text;
const originalGate='if (runtime.config().scholarMentor) assertScholarMentorBonusEffects(runtime.stageContext());';if(!oldRule.includes(originalGate)||JSON.stringify(syntax(gateBody))!==JSON.stringify(syntax(originalGate)))throw Error('complete_rule_gate_changed');
const originalNPGate='if (config.scholarMentor) assertScholarMentorBonusEffects(stageCtx);';
const mappedGate=gateBody.replace(/runtime\.config\(\)/g,'config').replace(/runtime\.stageContext\(\)/g,'stageCtx');
if(JSON.stringify(syntax(mappedGate))!==JSON.stringify(syntax(originalNPGate)))throw Error('pipeline_gate_changed');
if(before.source.find(x=>x.path.endsWith('/night_pipeline.ts')).text.split(originalNPGate).length!==3)throw Error('original_checkpoint_count');
const controls=before.controls.map(x=>{const git=cp.execFileSync('git',['show',before.baseCommit+':'+x.path],{encoding:'utf8'});if(git!==x.text||git!==fs.readFileSync(x.path,'utf8'))throw Error('control_changed');return {path:x.path,sha256:x.sha256,actualGitCurrentSame:true};});
const output={baseCommit:before.baseCommit,whole,completeValidation:{wholeNamedSyntaxSame:true,typedNodes:syntax(original).length,originalSHA256:sha(original)},completeRuleGate:{wholeNamedBodySame:true,pipelineCheckpointCount:2,compositionCheckpointCount:1},controls,summary:{wholePrograms:whole.length,typedNodes,wholeMappedOutputs,validationFunctions:1,ruleGateBodies:1,actualGuardCallSites:3},limits:['明确接线逆与完整正文保持，不声称新增出口／模块／闭包的raw二进制或任意命名空间重绑定相同。','编排位置人工核验，原精准effect顺序测试提供独立字面轨迹；没有全初始化或全规则矩阵证明。']};
fs.writeFileSync(prefix+'proof.json',JSON.stringify(output,null,2)+'\n');console.log(JSON.stringify(output.summary));
