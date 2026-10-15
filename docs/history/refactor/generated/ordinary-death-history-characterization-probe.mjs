/**
 * Q3 一次性公开档案输入实验；只由 Root 显式执行，不进入正常测试套件。
 * 原场景只生产合法同构建 Tape；以下枪／徽／来源拒绝预期为手写字面政策，绝不调用 DR 生成 oracle。
 * baseline 与所有变体保留原 metadata.engine 和 envelope 声明；解析接受不等于运行授权。
 */
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
const repo='/home/hby/dev/AI-Werewolf-Arena';
const out='/tmp/awa-q3-archive-guarantees/execution';
const load=async p=>import(pathToFileURL(path.join(repo,p)).href);
const {bootstrapGame}=await load('backend/src/app/bootstrap.ts');
const {createRandom,Role,Phase,WinCondition}=await load('backend/src/core/index.ts');
const {sixPlayerMvpConfig}=await load('backend/src/runtime/scenarios/six_player_mvp.ts');
const {SessionRecordManager}=await load('backend/src/recording/session_recorder.ts');
const {runWithSessionRecorder}=await load('backend/src/recording/recording_context.ts');
const {beginGameReproduction,captureCheckpoint,currentEngineVersion}=await load('backend/src/runtime/simulation/reproduction_context.ts');
const {GameEventRecorder}=await load('backend/src/runtime/game_event_recorder.ts');
const {parseReproductionRecord}=await load('backend/src/recording/reproduction.ts');
const {verifyReproductionMechanisms}=await load('backend/src/verification/reproduction/assembly.ts');
const {replayReproduction}=await load('backend/src/runtime/simulation/replay_reproduction.ts');
const {readReplayDocument}=await load('packages/replay-contract/src/index.ts');
const sha=b=>createHash('sha256').update(b).digest('hex');
const save=async(file,value)=>{const text=JSON.stringify(value,null,2)+'\n';await writeFile(path.join(out,file),text);return {file,bytes:Buffer.byteLength(text),sha256:sha(text)};};
const observe=async fn=>{try{const value=await fn();return {accepted:true,summary:value};}catch(error){return {accepted:false,name:error?.name??typeof error,message:String(error?.message??error)};}};
await mkdir(out,{recursive:true});
const expected={
 cupid:{roles:[Role.Cupid,Role.Hunter,Role.Wolf,Role.Villager,Role.Villager,Role.Villager],hunter:2,root:3,shotTarget:4},
 dream:{roles:[Role.Dreamer,Role.Wolf,Role.Witch,Role.Hunter,Role.Villager,Role.Villager],hunter:4,root:1,shotTarget:2},
 badge:{roles:[Role.Guard,Role.Wolf,Role.Wolf,Role.Villager,Role.Villager,Role.Seer]},
};
async function baseline(kind){
 const spec=expected[kind],roles=spec.roles;
 const config={...structuredClone(sixPlayerMvpConfig),enableSheriff:kind==='badge',
  roleSetups:[...new Set(roles)].map(role=>({role,count:roles.filter(x=>x===role).length})),
  selfDestruct:{enabledWindows:[]},winConditions:[WinCondition.SlaughterCity],
  ...(kind==='cupid'?{cupid:{policy:'netease_2017_cupid_follows_lovers_v1'}}:{}),
  ...(kind==='badge'?{initialSheriffSeat:4,sheriff:{voteWeight:2.25,badgePolicy:'awa_holder_choice_v1'}}:{}),
 };
 const game=bootstrapGame(config,{fixedRoles:roles,locale:'zh-CN',random:createRandom('q3-literal-'+kind)});
 const recordRoot=path.join(out,kind+'-baseline');
 const manager=await SessionRecordManager.create({sessionId:'q3-'+kind,board:'q3_'+kind,startedAtIso:'2026-10-15T00:00:00.000Z'},recordRoot);
 const engine=await currentEngineVersion();
 const trace=beginGameReproduction(manager,game,{engine,boardId:'q3_'+kind,locale:'zh-CN',maxDays:1});
 const calls=[];
 const actions={async getAction(r){
  calls.push([r.actorId,r.context.day,r.context.stage]);
  const tools=r.allowedTools;
  if(tools.includes('choose_lovers'))return {name:'choose_lovers',args:{first_id:2,second_id:3}};
  if(tools.includes('dream'))return {name:'dream',args:{target_id:4}};
  if(tools.includes('guard'))return {name:'guard',args:{target_id:6,abstain:false}};
  if(tools.includes('use_potion'))return {name:'use_potion',args:{target_id:3,potion_type:'none'}};
  if(tools.includes('check_identity'))return {name:'check_identity',args:{target_id:5}};
  if(tools.includes('speak_to_wolves'))return {name:'speak_to_wolves',args:{text:'Q3 literal end',end_chat:true}};
  if(tools.includes('kill_vote'))return {name:'kill_vote',args:{target_id:kind==='cupid'?3:kind==='dream'?1:4,abstain:false}};
  if(tools.includes('choose_badge_successor'))return {name:'choose_badge_successor',args:{target_id:5}};
  if(tools.includes('choose_direction'))return {name:'choose_direction',args:{direction:'clockwise'}};
  if(tools.includes('speak'))return {name:'speak',args:{text:'Q3 literal words'}};
  if(tools.includes('vote'))return {name:'vote',args:{target_id:kind==='dream'?2:null,abstain:kind!=='dream'}};
  throw new Error('q3_unexpected_request:'+kind+':'+r.context.stage);
 }};
 const provider={getAction:r=>trace.decide(r,actions)};
 const recorder=new GameEventRecorder({world:game.world,replayManager:manager},Phase.Night);
 await runWithSessionRecorder(manager,async()=>{
  await game.phaseManager.runSingleCycle(provider,1);
  trace.checkpoint(captureCheckpoint(game.world,game.phaseManager.getSnapshot(),1,true,game.phaseManager.getEvents().length),game.phaseManager.getEvents());
  recorder.flush(game.phaseManager.getEvents());
  const snapshot=game.phaseManager.getSnapshot();
  await manager.finalize({endedAtIso:'2026-10-15T00:01:00.000Z',winner:snapshot.result?.winner??null,
   ...(snapshot.result?{gameResult:snapshot.result}:{}),finishReason:snapshot.result?.reason??'runtime_timeout',
   players:captureCheckpoint(game.world,snapshot,1,true,0).players.map(p=>({player_id:p.id,role:p.role,camp:p.camp,alive:p.alive})),});
 });
 const archiveFile=path.join(manager.sessionDir,'reproduction.json'),publicFile=path.join(manager.sessionDir,'replay.json');
 const archive=JSON.parse(await readFile(archiveFile,'utf8')),pub=JSON.parse(await readFile(publicFile,'utf8'));
 const tape=archive.payload??archive,view=readReplayDocument(pub);
 // 手写独立的 baseline 准入条件；若达不到，这个场景不能被拿作 Q3 反例来源。
 assert.equal(tape.finalized,true);
 if(kind==='cupid'){
  assert.deepEqual(tape.events.filter(e=>e.type==='lovers_death').map(e=>e.payload),[{actorId:3,targetId:2}]);
  assert.equal(tape.checkpoints.at(-1).players.find(p=>p.id===2).alive,false);
  assert.equal(tape.events.some(e=>e.type==='hunter_shot'||e.type==='player_shot'),false);
 }else if(kind==='dream'){
  assert.deepEqual(tape.events.filter(e=>e.type==='dream_death').map(e=>[e.payload.actorId,e.payload.targetId,e.payload.reason]),[[1,4,'linked']]);
  assert.equal(tape.checkpoints.at(-1).players.find(p=>p.id===4).alive,false);
  assert.equal(tape.events.some(e=>e.type==='hunter_shot'||e.type==='player_shot'),false);
 }else{
  assert.deepEqual(tape.events.filter(e=>e.type==='sheriff_badge_transferred').map(e=>[e.payload.fromId,e.payload.toId]),[[4,5]]);
  assert.equal(tape.checkpoints.at(-1).players.find(p=>p.id===5).badge.isSheriff,true);
  assert.equal(tape.checkpoints.at(-1).players.find(p=>p.id===4).alive,false);
  assert(tape.decisions.some(d=>d.actorId===4&&d.stage==='last_words'&&d.request.context.death_phase===Phase.Night));
 }
 const artifact=await save(kind+'-original.json',archive),publicArtifact=await save(kind+'-public-original.json',pub);
 const reproduced=await observe(async()=>{const result=await replayReproduction(archive,path.join(out,kind+'-baseline-replayed'));return {eventCount:result.eventCount,decisionCount:result.decisionCount};});
 assert.equal(reproduced.accepted,true,JSON.stringify(reproduced));
 return {kind,archive,pub,view,artifact,publicArtifact,reproduced,calls,engine,archiveFile,publicFile};
}
function payload(archive){return archive.payload??archive;}
function appendForbiddenShot(base,kind){
 const archive=structuredClone(base.archive),t=payload(archive),publicArchive=structuredClone(base.pub),pub=payload(publicArchive),spec=expected[kind];
 const fact=kind==='cupid'?'lovers_death':'dream_death';
 const at=t.events.findIndex(e=>e.type===fact)+1;assert(at>0);
 const event={timestamp:t.events[at-1].timestamp,type:'hunter_shot',payload:{hunterId:spec.hunter,targetId:spec.shotTarget}};
 t.events.splice(at,0,event);for(const cp of t.checkpoints)if(cp.eventCount>at)cp.eventCount++;
 const pAt=pub.events.findIndex(e=>e.type===fact)+1;assert(pAt>0);
 const prior=pub.events[pAt-1];pub.events.splice(pAt,0,{seq:0,timestamp:prior.timestamp,phase:prior.phase,day:prior.day,stage:'hunter_shot',type:'hunter_shot',payload:structuredClone(event.payload)});
 pub.events.forEach((e,i)=>e.seq=i+1);
 return {id:kind+'-derived-hunter-shot',archive,publicView:publicArchive,edits:[{pointer:'/events',operation:'insert-after-'+fact,value:event},{pointer:'/checkpoints/*/eventCount',operation:'shift-only-included-event-cursors'}],publicEquivalent:true,
  literalPolicy:'Derived '+(kind==='cupid'?'Lovers':'Dream')+' cause does not authorize the ordinary native Hunter gun. No source/death permit is reconstructed from the forged fact.'};
}
function badgeMismatch(base){
 const archive=structuredClone(base.archive),t=payload(archive),publicArchive=structuredClone(base.pub),pub=payload(publicArchive);
 const e=t.events.find(e=>e.type==='sheriff_badge_transferred'&&e.payload.fromId===4);assert.equal(e.payload.toId,5);e.payload.toId=6;
 const p=pub.events.find(e=>e.type==='sheriff_badge_transferred'&&e.payload.fromId===4);assert.equal(p.payload.toId,5);p.payload.toId=6;
 assert.equal(t.checkpoints.at(-1).players.find(p=>p.id===5).badge.isSheriff,true);
 return {id:'badge-fact-vs-final-checkpoint',archive,publicView:publicArchive,edits:[{pointer:'/events/sheriff_badge_transferred/payload/toId',before:5,after:6}],publicEquivalent:true,
  literalPolicy:'A handoff fact claiming player 6 conflicts with the untouched final badge at player 5. Tape has no actual AliveComponent identity/version; this is not a serialized death-version experiment.'};
}
function illegalWordsSource(base){
 const archive=structuredClone(base.archive),t=payload(archive);
 const d=t.decisions.find(d=>d.actorId===4&&d.stage==='last_words');assert(d);assert.equal(d.request.context.death_phase,Phase.Night);
 d.request.context.death_phase=Phase.Day;d.request.context.death_sources=['wolf_kill'];
 return {id:'last-words-illegal-source-phase',archive,publicView:null,edits:[{pointer:'/decisions/actor4:last_words/request/context/death_phase',before:Phase.Night,after:Phase.Day},{pointer:'/decisions/actor4:last_words/request/context/death_sources',after:['wolf_kill']}],publicEquivalent:false,
  literalPolicy:'awa_initial_wave_v1 grants first-night WolfKill, not Day+WolfKill. Execution phase stays Day. Public grant/spoken facts do not serialize death_phase; do not invent a public-reader equivalent.'};
}
const report={kind:'q3-bounded-archive-characterization',notPolicyFix:true,baselines:[],variants:[],limits:[
 'Three new literal public no-model recording scenarios only; no old test case or transport/seed matrix is run.',
 'Baseline is produced by the actual engine solely as legal source. Handwritten mutations/policy notes are independent; no production resolver computes expected rejection.',
 'Direct mechanism verification and parseReproductionRecord(generic schema plus 18 verifiers) are separate observations; generic schema has no standalone exported API.',
 'Public replay intentionally checks data/sequence/terminal display consistency, not all runtime causal permissions. Acceptance is not an authorization vulnerability.',
 'Strict replay retains original source/lock/RNG/ruleset/envelope identity and actually re-executes. No sourceHash/identity mismatch is bypassed or rewritten.',
 'No archived life component ref/version or absent source-phase evidence is fabricated. Outputs are bounded to the actual mutated fields and actual refusal layer.',
]};
try{
 const sources={};
 for(const kind of ['cupid','dream','badge']){const b=await baseline(kind);sources[kind]=b;report.baselines.push({kind:b.kind,artifact:b.artifact,publicArtifact:b.publicArtifact,engine:b.engine,reproduced:b.reproduced,calls:b.calls,archiveFile:b.archiveFile,publicFile:b.publicFile});await save('result.json',report);}
 const {cupid,dream,badge}=sources;
 for(const v of [appendForbiddenShot(cupid,'cupid'),appendForbiddenShot(dream,'dream'),badgeMismatch(badge),illegalWordsSource(badge)]){
  const t=payload(v.archive),baselineEngine=report.baselines.find(b=>v.id.startsWith(b.kind)||v.id.startsWith('last-words')&&b.kind==='badge').engine;
  assert.deepEqual(t.metadata.engine,baselineEngine);
  const input=await save(v.id+'.json',v.archive);
  const publicInput=v.publicView?await save(v.id+'-public.json',v.publicView):null;
  const direct=await observe(()=>{verifyReproductionMechanisms(t);return '18 mechanism verifiers accepted';});
  const parse=await observe(()=>{parseReproductionRecord(v.archive);return 'generic structure plus assembly accepted';});
  const publicReader=v.publicView?await observe(()=>({events:readReplayDocument(v.publicView).events.length})): {notApplicable:true,reason:'Public view does not contain the mutated source-phase input.'};
  const exact=await observe(async()=>{const r=await replayReproduction(v.archive,path.join(out,v.id+'-replayed'));return {eventCount:r.eventCount,decisionCount:r.decisionCount};});
  report.variants.push({id:v.id,input,publicInput,edits:v.edits,literalPolicy:v.literalPolicy,directMechanismAssembly:direct,structuralPlusAssemblyReader:parse,publicReader,exactReplay:exact});
  await save('result.json',report);
 }
 report.completed=true;await save('result.json',report);console.log(JSON.stringify(report,null,2));
}catch(error){report.completed=false;report.preparationOrBaselineFailure={name:error?.name,message:String(error?.message??error),stack:error?.stack};await save('result.json',report);throw error;}
