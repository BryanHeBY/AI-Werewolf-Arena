/** 核对投票后准备的完整原程序与四个迁移正文；只证明明确映射，不执行游戏或放宽档案身份。 */
const fs = require('node:fs');
const cp = require('node:child_process');
const crypto = require('node:crypto');
const ts = require('../../../backend/node_modules/typescript');
const p = 'docs/refactor/generated/exile-death-preparation-';
const before = JSON.parse(fs.readFileSync(p+'before.json','utf8'));
const edits = JSON.parse(fs.readFileSync(p+'edits.json','utf8')).edits;
const sha = text => crypto.createHash('sha256').update(text).digest('hex');
const printer = ts.createPrinter({removeComments:true});
const parse = text => ts.createSourceFile('mapped.ts',text,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS);
const normalized = text => {const sf=parse(text);const out=[];const visit=n=>{if(n.kind>=ts.SyntaxKind.FirstJSDocNode&&n.kind<=ts.SyntaxKind.LastJSDocNode)return;const children=[];ts.forEachChild(n,c=>{children.push(c);});out.push([n.kind,children.length?null:n.getText(sf)]);for(const child of children)visit(child);};visit(sf);return JSON.stringify(out);};
let typedNodes=0,wholeMappedOutputs=0;
const whole=[];
for(const row of before.source){
 const actual=cp.execFileSync('git',['show',before.baseCommit+':'+row.path],{encoding:'utf8'});
 if(actual!==row.text || sha(actual)!==row.sha256)throw Error('before_git_mismatch:'+row.path);
 const current=fs.readFileSync(row.path,'utf8');let forward=actual;
 const changes=edits.filter(x=>x.path===row.path);
 for(const x of [...changes].sort((a,b)=>b.beforeStart-a.beforeStart)){
  if(forward.slice(x.beforeStart,x.beforeEnd)!==x.before)throw Error('forward_span');
  forward=forward.slice(0,x.beforeStart)+x.after+forward.slice(x.beforeEnd);
 }
 if(forward!==current)throw Error('complete_forward:'+row.path);
 let inverse=current;
 for(const x of [...changes].sort((a,b)=>b.afterStart-a.afterStart)){
  if(inverse.slice(x.afterStart,x.afterEnd)!==x.after)throw Error('inverse_span');
  inverse=inverse.slice(0,x.afterStart)+x.before+inverse.slice(x.afterEnd);
 }
 if(inverse!==actual)throw Error('complete_inverse:'+row.path);
 const sf=parse(actual);const visit=n=>{if(n.kind>=ts.SyntaxKind.FirstJSDocNode&&n.kind<=ts.SyntaxKind.LastJSDocNode)return;typedNodes++;ts.forEachChild(n,child=>{visit(child);});};visit(sf);
 const outputs=[];
 for(const [name,module] of [['ESNext',ts.ModuleKind.ESNext],['CommonJS',ts.ModuleKind.CommonJS]]){
  const emit=text=>ts.transpileModule(text,{fileName:row.path,compilerOptions:{target:ts.ScriptTarget.ES2022,module,removeComments:true}}).outputText;
  const oldEmit=emit(actual);if(oldEmit!==emit(inverse))throw Error('whole_emit:'+name);outputs.push({module:name,sha256:sha(oldEmit),same:true});wholeMappedOutputs++;
 }
 whole.push({path:row.path,actualGitSHA:row.sha256,currentSHA:sha(current),edits:changes.length,completeForward:true,completeInverse:true,outputs});
}
const pm=before.source[0].text;
const current=fs.readFileSync('backend/src/rulesets/exile-death-preparation.ts','utf8');
const sf=parse(current);
const body=name=>{const f=sf.statements.find(x=>ts.isFunctionDeclaration(x)&&x.name.text===name);if(!f)throw Error('function_missing');return f.body.statements.map(s=>s.getText(sf));};
const span=(start,end)=>{const a=pm.indexOf(start);if(a<0)throw Error('old_start');const z=pm.indexOf(end,a);if(z<0)throw Error('old_end');return pm.slice(a,z);};
const mapBody=text=>text.replace(/\bselection\b/g,'votingResult').replace(/\bworld\(\)/g,'this.world');
const oldAnimal=span('      const sources: DeathSources = {};\n      for (const id of votingResult.removed)','      await this.deathResolution.resolve(');
const oldOrdinary=span('      const sources: DeathSources = {};\n      for (const removedId of votingResult.removed)','      await this.deathResolution.resolve(');
const oldAnimalFeedback=span('      const target = votingResult.summary.target;','    } else if (votingResult.removed.length > 0)');
const ordinaryStart=pm.indexOf('    } else if (votingResult.removed.length > 0)');
const ordinaryFeedbackStart=pm.indexOf('      this.previousExile =',ordinaryStart);
const ordinaryFeedbackEnd=pm.indexOf('      const sources:',ordinaryFeedbackStart);
const programs=[
 ['animal_sources',mapBody(body('prepareAnimalExileDeaths').slice(0,-1).join('\n')),oldAnimal],
 ['ordinary_sources',mapBody(body('prepareOrdinaryExileDeaths').slice(0,-1).join('\n')),oldOrdinary],
 ['animal_feedback',mapBody(body('captureAnimalExileFeedback').join('\n').replace(/\breturn\b/,'this.previousExile =')),oldAnimalFeedback],
 ['ordinary_feedback',mapBody(body('captureOrdinaryExileFeedback').join('\n').replace(/\breturn\b/,'this.previousExile =')),pm.slice(ordinaryFeedbackStart,ordinaryFeedbackEnd)],
];
const moved=programs.map(([name,after,original])=>{if(normalized(after)!==normalized(original)){console.log(JSON.stringify({name,after,original,afterSyntax:JSON.parse(normalized(after)),originalSyntax:JSON.parse(normalized(original))}));throw Error('whole_moved_body:'+name)};return {name,wholeMappedSyntax:true,sha256:sha(normalized(original))};});
const controls=before.controls.map(row=>{const actual=cp.execFileSync('git',['show',before.baseCommit+':'+row.path],{encoding:'utf8'}),now=fs.readFileSync(row.path,'utf8');if(actual!==row.text||now!==actual)throw Error('control_changed');return {path:row.path,sha256:row.sha256,actualGitCurrentSame:true};});
const result={baseCommit:before.baseCommit,whole,moved,controls,summary:{wholePrograms:whole.length,typedNodes,wholeMappedOutputs,completeMovedBodies:moved.length},limits:['仅明确文本接线逆／四完整正文与旧原程序保持；新模块接口、方法边界、局部返回容器和加载图变化不声称raw二进制或任意反射等价。','运行行为与实际接线由另存定向测试和非作者审查补足，不由本证明生成oracle。']};
fs.writeFileSync(p+'proof.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result.summary));
