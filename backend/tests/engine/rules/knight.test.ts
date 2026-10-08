import {expect,test} from "bun:test";
import {bootstrapGame} from "../../../src/app/bootstrap";
import {Role,Camp,Phase,KnightDuelWindow,ActionWindow,WinCondition,COMPONENT,DeathCause,type RoleComponent,type GameEvent,type ActionRequest} from "../../../src/core";
import {sixPlayerMvpConfig} from "../../../src/runtime/scenarios/six_player_mvp";
import {getKnightState,setKnightState} from "../../../src/game/mechanisms/roles/private_state";
import {commitKnightDuel} from "../../../src/game/mechanisms/roles/knight/commit";
import {KnightDuelWindow as DuelCollector} from "../../../src/game/engine/knight_duel_window";
import {GameActionRequestFactory} from "../../../src/game/engine/action_request_factory";
import {ToolGateway} from "../../../src/game/gateway/tool_gateway";
import {ActionReception} from "../../../src/ai/agents/player/action_reception";
import {RoleCatalog,getDefaultRoleCatalog} from "../../../src/game/mechanisms/roles/catalog";
import {resolveInspection} from "../../../src/game/mechanisms/roles/inspection";
import {setIdiotState} from "../../../src/game/mechanisms/roles/private_state";
import {DefaultTargetHintRegistry} from "../../../src/game/mechanisms/llm/target_hint_registry";

const deck=[Role.Knight,Role.Wolf,Role.WolfKing,Role.Hunter,Role.Villager,Role.Villager];
const board=(window:KnightDuelWindow)=>({...sixPlayerMvpConfig,winConditions:[WinCondition.SlaughterSide],roleSetups:[{role:Role.Knight,count:1},{role:Role.Wolf,count:1},{role:Role.WolfKing,count:1},{role:Role.Hunter,count:1},{role:Role.Villager,count:2}],knight:{enabledWindows:[window]}});
const role=(world:ReturnType<typeof bootstrapGame>["world"],id:number)=>world.getComponent<RoleComponent>(id,COMPONENT.Role)!;
const duel=(target_id:number)=>({name:"duel" as const,args:{target_id,confirm:true}});
const req:ActionRequest={actorId:1,phase:Phase.Day,allowedTools:["duel"],context:{day:1,stage:KnightDuelWindow.AfterSpeeches,duel_window:KnightDuelWindow.AfterSpeeches,visible_events:[],turn_constraints:{}}};

for (const locale of ["zh-CN", "en"] as const) test(`${locale}: inspection disguise and revealed Idiot immunity neither alter true-camp duels nor leak through target hints`, () => {
 const {world}=bootstrapGame({...board(KnightDuelWindow.AfterSpeeches),roleSetups:[{role:Role.Knight,count:1},{role:Role.Wolf,count:1},{role:Role.Seer,count:1},{role:Role.Idiot,count:1},{role:Role.Villager,count:2}]},{locale,fixedRoles:[Role.Knight,Role.Wolf,Role.Seer,Role.Idiot,Role.Villager,Role.Villager]});
 const defaultCatalog=getDefaultRoleCatalog(), catalog=new RoleCatalog(defaultCatalog.all().map(profile=>profile.role===Role.Wolf?{...profile,inspectionLabels:{camp:Camp.Good}}:profile));
 expect(resolveInspection(world,2,"camp",catalog)).toEqual({kind:"camp",camp:Camp.Good});
 setIdiotState(role(world,4),{revealed:true});expect(catalog.participation(role(world,4)).canBeExiled).toBe(false);
 const hint=new DefaultTargetHintRegistry().buildActionableIdsHint({actorId:1,actorRole:Role.Knight,allowedTools:["duel"],world,roleCatalog:catalog});
 expect(hint).toContain("2, 3, 4, 5, 6");expect(new ActionReception(world).validate(req,"duel",duel(4).args).ok).toBe(true);
 const events:GameEvent[]=[];expect(commitKnightDuel(world,{actorId:1,targetId:2},Phase.Day,events)).toEqual({deaths:[2],sources:{2:[DeathCause.Duel]},endsDay:true});
 expect(events[0].payload).toEqual({actorId:1,targetId:2,result:"wolf"});
 const other=bootstrapGame({...board(KnightDuelWindow.AfterSpeeches),roleSetups:[{role:Role.Knight,count:1},{role:Role.Wolf,count:1},{role:Role.Seer,count:1},{role:Role.Idiot,count:1},{role:Role.Villager,count:2}]},{locale,fixedRoles:[Role.Knight,Role.Wolf,Role.Seer,Role.Idiot,Role.Villager,Role.Villager]});
 setIdiotState(role(other.world,4),{revealed:true});expect(commitKnightDuel(other.world,{actorId:1,targetId:4},Phase.Day,[])).toEqual({deaths:[1],sources:{1:[DeathCause.DuelFailure]},endsDay:false});
});

for (const locale of ["zh-CN", "en"] as const) test(`${locale}: the last speech gap and after-speeches are separate windows; disabled windows issue no requests`, async () => {
 for(const enabled of [true,false]){
  const config={...board(KnightDuelWindow.AfterSpeeches),roleSetups:[{role:Role.Knight,count:2},{role:Role.Wolf,count:1},{role:Role.Seer,count:1},{role:Role.Villager,count:2}],knight:{enabledWindows:enabled?[KnightDuelWindow.BetweenSpeeches,KnightDuelWindow.AfterSpeeches]:[]}};
  const game=bootstrapGame(config,{locale,fixedRoles:[Role.Knight,Role.Knight,Role.Wolf,Role.Seer,Role.Villager,Role.Villager]});let spoken=0;const choices:Array<[number,string]>=[];
  await game.phaseManager.runSingleCycle({async getAction(request){
   if(request.allowedTools.includes("speak_to_wolves"))return{name:"speak_to_wolves",args:{text:"End",end_chat:true}};
   if(request.allowedTools.includes("kill_vote"))return{name:"kill_vote",args:{target_id:5,abstain:false}};
   if(request.allowedTools.includes("check_identity"))return{name:"check_identity",args:{target_id:3}};
   if(request.allowedTools.includes("speak")){if(request.context.stage==="day_speech")spoken++;return{name:"speak",args:{text:"Raw"}};}
   if(request.allowedTools.includes("duel")){
    if(request.actorId===1&&request.context.stage===KnightDuelWindow.BetweenSpeeches&&spoken===5){choices.push([1,request.context.stage]);return duel(6);}
    if(request.actorId===2&&request.context.stage===KnightDuelWindow.AfterSpeeches){choices.push([2,request.context.stage]);return duel(3);}
    return null;
   }
   if(request.allowedTools.includes("vote"))return{name:"vote",args:{target_id:3,abstain:false}};
   throw new Error(`unexpected:${request.context.stage}`);
  }});
  expect(choices).toEqual(enabled?[[1,"between_speeches"],[2,"after_speeches"]]:[]);
  expect(game.phaseManager.getEvents().filter(event=>event.type==="knight_duel").map(event=>event.payload)).toEqual(enabled?[{actorId:1,targetId:6,result:"not_wolf"},{actorId:2,targetId:3,result:"wolf"}]:[]);
  expect(getKnightState(role(game.world,1))?.canDuel).toBe(!enabled);expect(getKnightState(role(game.world,2))?.canDuel).toBe(!enabled);
 }
});

for (const [window,blast] of [[KnightDuelWindow.BeforeSpeeches,ActionWindow.OnDaybreak],[KnightDuelWindow.BetweenSpeeches,ActionWindow.OnPerSpeechGap]] as const) test(`${window}: an actual earlier public blast interrupts the day before the corresponding duel request`, async () => {
 const config=board(window),game=bootstrapGame({...config,hooks:{...config.hooks,onDaybreak:true,onPerSpeechGap:true},selfDestruct:{enabledWindows:[blast]}},{fixedRoles:deck});let duels=0;
 const snapshot=await game.phaseManager.runSingleCycle({async getAction(request){
  if(request.allowedTools.includes("speak_to_wolves"))return{name:"speak_to_wolves",args:{text:"End",end_chat:true}};
  if(request.allowedTools.includes("kill_vote"))return{name:"kill_vote",args:{target_id:5,abstain:false}};
  if(request.allowedTools.includes("self_destruct"))return request.actorId===2?{name:"self_destruct",args:{reason:"Public blast",confirm:true}}:null;
  if(request.allowedTools.includes("speak"))return{name:"speak",args:{text:"Raw"}};
  if(request.allowedTools.includes("duel")){duels++;throw new Error("blast_must_precede_duel");}
  throw new Error(`unexpected:${request.context.stage}`);
 }});
 expect(duels).toBe(0);expect(getKnightState(role(game.world,1))?.canDuel).toBe(true);expect(snapshot).toEqual({day:2,phase:Phase.Night,gameOver:false,result:null});
 expect(game.phaseManager.getEvents().filter(event=>event.type==="day_speech")).toHaveLength(window===KnightDuelWindow.BeforeSpeeches?0:1);
});

test("an optional duel provider failure propagates unchanged and consumes no resource or public fact",async()=>{
 const config=board(KnightDuelWindow.AfterSpeeches),{world}=bootstrapGame(config,{fixedRoles:deck}),events:GameEvent[]=[],fault=new Error("original_duel_failure");let commits=0;
 await expect(new DuelCollector(world,new ToolGateway()).execute(config,new GameActionRequestFactory(world,events,1),{async getAction(){throw fault;}},KnightDuelWindow.AfterSpeeches,()=>true,async()=>{commits++;return"night";})).rejects.toBe(fault);
 expect(commits).toBe(0);expect(getKnightState(role(world,1))?.canDuel).toBe(true);expect(events).toEqual([]);
});

for(const locale of ["zh-CN","en"] as const)test(`${locale}: strict readonly duel receipt and true-camp commit hide non-wolf third-party identity`,()=>{
 const {world}=bootstrapGame(board(KnightDuelWindow.AfterSpeeches),{locale,fixedRoles:deck}),receive=new ActionReception(world);
 expect(receive.validate(req,"duel",duel(2).args).ok).toBe(true);
 for(const target of [1,999,3.5])expect(receive.validate(req,"duel",duel(target).args)).toMatchObject({ok:false,error:"knight_duel_target"});
 expect(receive.validate(req,"duel",{target_id:2,confirm:"true"}).ok).toBe(false);expect(receive.validate(req,"duel",{target_id:null,confirm:true}).ok).toBe(false);
 expect(receive.validate({...req,phase:Phase.Night},"duel",duel(2).args)).toMatchObject({ok:false,error:"knight_duel_window"});
 expect(receive.validate({...req,context:{...req.context,duel_window:undefined}},"duel",duel(2).args).ok).toBe(false);
 expect(receive.validate({...req,context:{...req.context,stage:"day_speech"}},"duel",duel(2).args).ok).toBe(false);
 expect(receive.validate({...req,actorId:4},"duel",duel(2).args).ok).toBe(false);expect(getKnightState(role(world,1))).toEqual({canDuel:true});
 role(world,4).camp=Camp.ThirdParty;const events:GameEvent[]=[];
 expect(commitKnightDuel(world,{actorId:1,targetId:4},Phase.Day,events)).toEqual({deaths:[1],sources:{1:[DeathCause.DuelFailure]},endsDay:false});
 expect(events.map(event=>[event.type,event.payload])).toEqual([["knight_duel",{actorId:1,targetId:4,result:"not_wolf"}]]);
 expect(JSON.stringify(events)).not.toContain("third_party");expect(getKnightState(role(world,1))).toEqual({canDuel:false});expect(world.getAliveEntityIds()).toHaveLength(6);
 expect(commitKnightDuel(world,{actorId:1,targetId:2},Phase.Day,events)).toBeNull();
});

for(const locale of ["zh-CN","en"] as const)for(const window of Object.values(KnightDuelWindow))test(`${locale}/${window}: hitting Wolf King spends one duel, forbids its gun and stops before voting`,async()=>{
 const game=bootstrapGame(board(window),{locale,fixedRoles:deck});let votes=0,guns=0;
 const snapshot=await game.phaseManager.runSingleCycle({async getAction(request){
  if(request.allowedTools.includes("speak_to_wolves"))return{name:"speak_to_wolves",args:{text:"End",end_chat:true}};
  if(request.allowedTools.includes("kill_vote"))return{name:"kill_vote",args:{target_id:5,abstain:false}};
  if(request.allowedTools.includes("duel"))return duel(3);
  if(request.allowedTools.includes("speak"))return{name:"speak",args:{text:"Raw"}};
  if(request.allowedTools.includes("shoot")){guns++;throw new Error("duel_blocks_gun");}
  if(request.allowedTools.includes("vote")){votes++;throw new Error("hit_stops_voting");}
  throw new Error(`unexpected:${request.context.stage}`);
 }});
 expect(guns).toBe(0);expect(votes).toBe(0);expect(snapshot).toEqual({day:2,phase:Phase.Night,gameOver:false,result:null});
 expect(game.world.getAliveEntityIds()).toEqual([1,2,4,6]);expect(getKnightState(role(game.world,1))?.canDuel).toBe(false);
 const events=game.phaseManager.getEvents();expect(events.filter(event=>event.type==="knight_duel").map(event=>event.payload)).toEqual([{actorId:1,targetId:3,result:"wolf"}]);
 expect(events.filter(event=>event.type==="last_words_spoken").map(event=>event.payload.playerId)).toEqual([5]);
 expect(events.filter(event=>event.type==="day_speech").length).toBe(window===KnightDuelWindow.BeforeSpeeches?0:window===KnightDuelWindow.BetweenSpeeches?1:5);
});

for(const locale of ["zh-CN","en"] as const)test(`${locale}: a missed Knight sheriff receives authorized last words and transfers its badge before surviving players speak and vote`,async()=>{
 const game=bootstrapGame({...board(KnightDuelWindow.BeforeSpeeches),enableSheriff:true,initialSheriffSeat:1,sheriff:{voteWeight:2.25}},{locale,fixedRoles:deck});const normal:number[]=[],voters:number[]=[];
 await game.phaseManager.runSingleCycle({async getAction(request){
  if(request.allowedTools.includes("speak_to_wolves"))return{name:"speak_to_wolves",args:{text:"End",end_chat:true}};
  if(request.allowedTools.includes("kill_vote"))return{name:"kill_vote",args:{target_id:5,abstain:false}};
  if(request.allowedTools.includes("duel"))return duel(4);
  if(request.allowedTools.includes("choose_direction")){expect(request.actorId).toBe(2);return{name:"choose_direction",args:{direction:"clockwise"}};}
  if(request.allowedTools.includes("speak")){
   if(request.context.stage==="day_speech")normal.push(request.actorId);
   if(request.actorId===1){expect(request.context.stage).toBe("last_words");expect(game.world.hasDeathAction(1,"speak",Phase.Day,1,request.context.death_action_id)).toBe(true);}
   return{name:"speak",args:{text:"Raw"}};
  }
  if(request.allowedTools.includes("vote")){voters.push(request.actorId);return{name:"vote",args:{target_id:2,abstain:false}};}
  throw new Error(`unexpected:${request.context.stage}`);
 }});
 expect(normal).not.toContain(1);expect(voters.sort()).toEqual([2,3,4,6]);expect(game.world.getAliveEntityIds()).toEqual([3,4,6]);expect(game.world.activeDeathActionCount).toBe(0);
 const events=game.phaseManager.getEvents();expect(events.filter(event=>event.type==="last_words_spoken").map(event=>event.payload.playerId)).toEqual([5,1,2]);
 expect(events.filter(event=>event.type==="sheriff_badge_transferred").map(event=>[event.payload.fromId,event.payload.toId])).toEqual([[1,2],[2,3]]);
 const word=events.findIndex(event=>event.type==="last_words_spoken"&&event.payload.playerId===1),badge=events.findIndex(event=>event.type==="sheriff_badge_transferred");expect(word).toBeLessThan(badge);expect(badge).toBeLessThan(events.findIndex(event=>event.type==="day_speech"));
});

for(const locale of ["zh-CN","en"] as const)test(`${locale}: multiple Knights use the smallest eligible actor and discard role/resource/target-life changes without spending others`,async()=>{
 const fixed=[Role.Knight,Role.Knight,Role.Wolf,Role.Seer,Role.Villager,Role.Villager],config={...board(KnightDuelWindow.AfterSpeeches),roleSetups:[{role:Role.Knight,count:2},{role:Role.Wolf,count:1},{role:Role.Seer,count:1},{role:Role.Villager,count:2}]};
 for(const mode of ["normal","resource","target","role","phase"] as const){
  const {world}=bootstrapGame(config,{locale,fixedRoles:fixed}),events:GameEvent[]=[],original=getKnightState(role(world,1))!;let current=true,commits=0;
  const result=await new DuelCollector(world,new ToolGateway()).execute(config,new GameActionRequestFactory(world,events,1),{async getAction(request){
   if(request.actorId===2){if(mode==="resource")setKnightState(role(world,1),{canDuel:true});if(mode==="target"){const life=world.getComponent<{alive:boolean}>(3,COMPONENT.Alive)!;life.alive=false;life.alive=true;}if(mode==="role")role(world,1).role=Role.Villager;if(mode==="phase")current=false;}
   return duel(3);
  }},KnightDuelWindow.AfterSpeeches,()=>current,async choice=>{commits++;expect(commitKnightDuel(world,choice,Phase.Day,events)).not.toBeNull();return"night";});
  expect(commits).toBe(mode==="target"||mode==="phase"?0:1);expect(result.selection?.actorId??null).toBe(mode==="target"||mode==="phase"?null:mode==="normal"?1:2);
  expect(original.canDuel).toBe(mode!=="normal");if(mode==="normal")expect(getKnightState(role(world,2))?.canDuel).toBe(true);
 }
});

for(const locale of ["zh-CN","en"] as const)test(`${locale}: the last wolf duel seals one exact victory after settlement without any later action`,async()=>{
 const config={...board(KnightDuelWindow.AfterSpeeches),roleSetups:[{role:Role.Knight,count:1},{role:Role.Seer,count:1},{role:Role.Wolf,count:1},{role:Role.Villager,count:3}]},game=bootstrapGame(config,{locale,fixedRoles:[Role.Knight,Role.Wolf,Role.Seer,Role.Villager,Role.Villager,Role.Villager]});
 const snapshot=await game.phaseManager.runSingleCycle({async getAction(request){
  if(request.allowedTools.includes("speak_to_wolves"))return{name:"speak_to_wolves",args:{text:"End",end_chat:true}};
  if(request.allowedTools.includes("kill_vote"))return{name:"kill_vote",args:{target_id:5,abstain:false}};
  if(request.allowedTools.includes("check_identity"))return{name:"check_identity",args:{target_id:2}};
  if(request.allowedTools.includes("speak"))return{name:"speak",args:{text:"Raw"}};
  if(request.allowedTools.includes("duel"))return duel(2);
  throw new Error(`post_duel_action:${request.context.stage}`);
 }});
 expect(snapshot.result).toEqual({winner:"good",reason:"all_wolves_eliminated",outcome:{kind:"victory",primary:{kind:"faction",faction:"good",winningPlayerIds:[1,3,4,5,6]},additional:[],winningPlayerIds:[1,3,4,5,6]},decidedAt:{day:1,phase:Phase.Day,checkpoint:"day_interrupted"}});
 expect(game.world.getAliveEntityIds()).toEqual([1,3,4,6]);expect(game.phaseManager.getEvents().filter(event=>event.type==="game_over")).toHaveLength(1);
});

for(const locale of ["zh-CN","en"] as const)test(`${locale}: the last good special role misses, receives its authorized words and badge settlement, then seals Wolf victory with no later speech/vote`,async()=>{
 const config={...board(KnightDuelWindow.BeforeSpeeches),enableSheriff:true,initialSheriffSeat:1,sheriff:{voteWeight:2.25},roleSetups:[{role:Role.Knight,count:1},{role:Role.Wolf,count:1},{role:Role.Villager,count:4}]},game=bootstrapGame(config,{locale,fixedRoles:[Role.Knight,Role.Wolf,Role.Villager,Role.Villager,Role.Villager,Role.Villager]});
 const snapshot=await game.phaseManager.runSingleCycle({async getAction(request){
  if(request.allowedTools.includes("speak_to_wolves"))return{name:"speak_to_wolves",args:{text:"End",end_chat:true}};
  if(request.allowedTools.includes("kill_vote"))return{name:"kill_vote",args:{target_id:5,abstain:false}};
  if(request.allowedTools.includes("duel"))return duel(3);
  if(request.allowedTools.includes("speak")){expect(request.context.stage).toBe("last_words");return{name:"speak",args:{text:"Authorized words"}};}
  throw new Error(`no_later_action:${request.context.stage}`);
 }});
 expect(snapshot.result).toEqual({winner:"wolf",reason:"slaughter_side_completed",outcome:{kind:"victory",primary:{kind:"faction",faction:"wolf",winningPlayerIds:[2]},additional:[],winningPlayerIds:[2]},decidedAt:{day:1,phase:Phase.Day,checkpoint:"day_interrupted"}});
 const events=game.phaseManager.getEvents();expect(events.filter(event=>event.type==="last_words_spoken").map(event=>event.payload.playerId)).toEqual([5,1]);
 expect(events.filter(event=>event.type==="sheriff_badge_transferred").map(event=>[event.payload.fromId,event.payload.toId])).toEqual([[1,2]]);
 expect(events.findIndex(event=>event.type==="sheriff_badge_transferred")).toBeLessThan(events.findIndex(event=>event.type==="game_over"));expect(game.world.getAliveEntityIds()).toEqual([2,3,4,6]);
});
