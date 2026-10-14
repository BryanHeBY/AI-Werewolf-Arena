/** 仅核本批完整同步程序与原经理保留程序的明确逆；不执行对局、类型或门禁。 */
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),cp=require('node:child_process');
const ts=require('../../../backend/node_modules/typescript');
const prefix='docs/refactor/generated/special-night-damage-preparation-';
const hash=x=>crypto.createHash('sha256').update(x).digest('hex');
const assert=(x,m)=>{if(!x)throw Error(m);};
const before=JSON.parse(fs.readFileSync(prefix+'before.json','utf8'));
const edits=JSON.parse(fs.readFileSync(prefix+'edits.json','utf8'));
const current=fs.readFileSync(edits.source,'utf8'),owner=fs.readFileSync(edits.owner,'utf8');
const old=before.source.text,region=old.slice(before.movedRegion.start,before.movedRegion.end);
assert(cp.execFileSync('git',['show',before.baseCommit+':'+edits.source],{encoding:'utf8',maxBuffer:8e6})===old,'实际Git before 不符');
const source=ts.createSourceFile(edits.owner,owner,ts.ScriptTarget.Latest,true);
const fn=source.statements.find(x=>ts.isFunctionDeclaration(x)&&x.name?.text==='prepareSpecialNightDamage');
assert(fn?.body,'真实组合函数缺失');
let body=owner.slice(fn.body.getStart(source)+1,fn.body.end-1).replace(/^\n/,'');
assert(body.endsWith(edits.returnStatement),'新增返回点不符');body=body.slice(0,-edits.returnStatement.length);
for(const {comment}of edits.bodyComments){const text='  '+comment;assert(body.split(text).length===2,'具名注释逆不唯一');body=body.replace(text,'');}
for(const[a,b]of edits.bodySubstitutions)body=body.split(b).join(a);
body=body.split('\n').map(line=>line?line.slice(2):line).join('\n');
const restored=body.split('\n').map(line=>line?'        '+line:line).join('\n');
assert(restored===region,'完整117行同步程序逆不等于原Git区域');
assert(current.split(edits.callRegion).length===2,'真实调用点不是唯一');
let inverse=current.replace(edits.callRegion,restored);
const originalSF=ts.createSourceFile(edits.source,old,ts.ScriptTarget.Latest,true);
const originalImports=originalSF.statements.filter(ts.isImportDeclaration);
const importEnd=originalImports.at(-1).end;
const oldPrefix=old.slice(0,importEnd);
let expectedPrefix=oldPrefix;
for(const[a,b]of edits.importEdits){assert(expectedPrefix.split(a).length===2,'原 import 精确修改不是唯一:'+a);expectedPrefix=expectedPrefix.replace(a,b);}
assert(inverse.startsWith(expectedPrefix),'当前完整 imports 含映射之外变更');
inverse=oldPrefix+inverse.slice(expectedPrefix.length);
for(const[a,b]of edits.managerComments){assert(inverse.split(b).length===2,'经理说明逆不唯一');inverse=inverse.replace(b,a);}
assert(inverse===old,'完整经理程序逆未保持Git before字节');
function shape(text,file){const sf=ts.createSourceFile(file,text,ts.ScriptTarget.Latest,true);let all=[],leaves=[];const visit=n=>{all.push([n.kind,n.flags,typeof n.text==='string'?n.text:null]);const kids=n.getChildren(sf);if(!kids.length)leaves.push([n.kind,n.getText(sf)]);for(const k of kids)visit(k);};visit(sf);return{all,leaves};}
const a=shape(old,edits.source),b=shape(inverse,edits.source);assert(JSON.stringify(a)===JSON.stringify(b),'完整AST/非注释叶不同');
const outputs=[];for(const module of [ts.ModuleKind.ESNext,ts.ModuleKind.CommonJS]){const opts={target:ts.ScriptTarget.ES2022,module,esModuleInterop:true};const x=ts.transpileModule(old,{compilerOptions:opts,fileName:edits.source}).outputText,y=ts.transpileModule(inverse,{compilerOptions:opts,fileName:edits.source}).outputText;assert(x===y,'完整经理输出不同');outputs.push({module:ts.ModuleKind[module],same:true,sha256:hash(x)});}
const controls=before.controls.map(x=>({...x,currentSha256:hash(fs.readFileSync(x.path)),gitSha256:hash(cp.execFileSync('git',['show',before.baseCommit+':'+x.path])),same:hash(fs.readFileSync(x.path))===x.sha256}));assert(controls.every(x=>x.same&&x.gitSha256===x.sha256),'七原控制源漂移');
const fix=JSON.parse(fs.readFileSync(prefix+'type-fix.json','utf8'));
const now=fs.readFileSync(fix.path,'utf8');assert(fix.before.replace(fix.old,fix.new)===now,'新unit型修含其它变更');
const typeFixOutputs=[ts.ModuleKind.ESNext,ts.ModuleKind.CommonJS].map(module=>{const opts={target:ts.ScriptTarget.ES2022,module};const x=ts.transpileModule(fix.before,{compilerOptions:opts,fileName:fix.path}).outputText,y=ts.transpileModule(now,{compilerOptions:opts,fileName:fix.path}).outputText;assert(x===y,'新unit类型擦除不同');return{module:ts.ModuleKind[module],same:true,sha256:hash(x)};});
const report={baseCommit:before.baseCommit,source:[edits.source,edits.owner,fix.path].map(p=>({path:p,sha256:hash(fs.readFileSync(p))})),movedRegion:{lines:before.movedRegion.lines,sameWholeByte:true,sha256:hash(restored)},retainedManager:{sameWholeByte:true,typedNodes:a.all.length,nonCommentLeaves:a.leaves.length,wholeOutputs:outputs},controls,typeFix:{...fix,before:undefined,wholeOutputs:typeFixOutputs},limits:['仅按明确body/runtime映射、新增返回和import/comment逆核完整程序；真实新具名调用、查询对象与结果对象分配／堆栈变化不冒任意环境机械等价。','NP/Ghost NightKnife和后继Demonports/SelfDestruct不当全字节控制；两种type-only engine依赖不形成规则组运行边。']};
fs.writeFileSync(prefix+'proof.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({regionLines:report.movedRegion.lines,wholeByte:true,typedNodes:a.all.length,nonCommentLeaves:a.leaves.length,outputs:outputs.length,typeFixOutputs:typeFixOutputs.length,controls:controls.length}));
