/** 保留两条 CLI 的完整参数与渲染流程，只把遗漏的语言判定导入接到唯一机器契约 owner。 */
const fs=require('node:fs'),cp=require('node:child_process'),assert=require('node:assert/strict'),{createHash}=require('node:crypto'),ts=require(process.cwd()+'/backend/node_modules/typescript');
const sha=b=>createHash('sha256').update(b).digest('hex'),base=cp.execFileSync('git',['rev-parse','HEAD']).toString().trim(),rows=[];
for(const p of ['frontend/scripts/render-replay.ts','frontend/scripts/replay-dev.ts']){
 const before=fs.readFileSync(p,'utf8'),git=cp.execFileSync('git',['show',base+':'+p]).toString();assert.equal(before,git,p);
 const old='import { isLocale } from "@ai-werewolf-arena/game-catalog";',next='import { isLocale } from "@ai-werewolf-arena/game-contract";';assert.equal(before.split(old).length,2);
 const after=before.replace(old,next);assert.equal(after.replace(next,old),before);
 const emitted=[ts.ModuleKind.ESNext,ts.ModuleKind.CommonJS].map(module=>{const emit=text=>ts.transpileModule(text,{fileName:p,compilerOptions:{target:ts.ScriptTarget.ES2022,module,removeComments:true}}).outputText;return{module:ts.ModuleKind[module],beforeSHA256:sha(emit(before)),actualSHA256:sha(emit(after)),inverseWholeOutputSame:emit(after.replace(next,old))===emit(before)};});assert(emitted.every(r=>r.inverseWholeOutputSame));
 rows.push({path:p,gitCommit:base,beforeSHA256:sha(before),afterSHA256:sha(after),before,after,exactSingleImportChange:true,emitted});
}
for(const r of rows)fs.writeFileSync(r.path,r.after);
fs.writeFileSync('docs/refactor/generated/owned-source-layout-frontend-public-route.json',JSON.stringify({reason:'首轮8类型项目发现两真实CLI仍引用已于694a2593退休的catalog转发；这两文件本轮此前未改变。只补导入到game-contract，不恢复转发层、不改参数与语言接受面。',rows,limits:['这是已退休公共导出遗漏消费者的显式修复，不冒新旧当前包raw运行等价。','类型复查只重跑失败的frontend项目，其余7绿不重复。']},null,2)+'\n');console.log(JSON.stringify({files:rows.length,imports:2,inverseWholeOutputs:4}));
