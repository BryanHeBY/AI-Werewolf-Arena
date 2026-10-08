import {expect,test} from "bun:test";
import {bootstrapGame} from "../../../src/app/bootstrap";
import {Camp,Role,Phase,COMPONENT,WinCondition,ActionWindow,KnightDuelWindow,type RoleComponent,type GameEvent,type BoardConfig,type ActionRequest} from "../../../src/core";
import {sixPlayerMvpConfig} from "../../../src/runtime/scenarios/six_player_mvp";
import {captureExileFeedback,GRAVEKEEPER_FEEDBACK_STAGE} from "../../../src/game/mechanisms/roles/gravekeeper/feedback";
import {getGravekeeperState,setGravekeeperState} from "../../../src/game/mechanisms/roles/private_state";
import {readGravekeeperReport,readGravekeeperFeedback} from "@ai-werewolf-arena/replay-contract";
import {RoleCatalog,getDefaultRoleCatalog,getDefaultToolSpecRegistry,getDefaultTargetHintRegistry,getDefaultPhaseStageLocalizationRegistry,getDefaultConfigRenderRegistry} from "../../../src/game/mechanisms";
import {NightStageRegistry} from "../../../src/game/mechanisms/stages/night/night_stage_registry";
import {NightPipeline} from "../../../src/game/engine/phase_pipeline/night_pipeline";
import {DamageResolutionSystem} from "../../../src/core/domain/systems/damage_resolution_system";
import {ToolGateway} from "../../../src/game/gateway/tool_gateway";
import {buildAgentVisibleEventFeed} from "../../../src/game/engine/agent_visible_event_feed";
import {PlayerPromptPolicy} from "../../../src/ai/agents/player/player_prompt_policy";
import type {NightStageContext} from "../../../src/game/mechanisms/stages/night/contracts";
import {getDefaultScriptEventRenderRegistry} from "../../../src/game/mechanisms/script/event_render_registry";
import {grantNightAbility} from "../../../src/game/mechanisms/roles/ability_changes";

for(const mode of ["leave_night","leave_and_restore","same_phase_jump"] as const)test(`${mode}: phase revision interrupts the real second night before feedback, damage or subsequent turns, and a fresh run can still deliver once`,async()=>{
 const game=bootstrapGame(board,{fixedRoles:deck});let cycle=1,cancel=true;
 const provider={async getAction(req:ActionRequest){
  if(req.allowedTools.includes("speak_to_wolves"))return{name:"speak_to_wolves" as const,args:{text:"End",end_chat:true}};
  if(req.allowedTools.includes("kill_vote")){
   if(cycle===2&&cancel){cancel=false;if(mode!=="same_phase_jump")game.phaseManager.jumpTo(Phase.Voting);if(mode!=="leave_night")game.phaseManager.jumpTo(Phase.Night);return{name:"kill_vote" as const,args:{target_id:3,abstain:false}};}
   return{name:"kill_vote" as const,args:{target_id:null,abstain:true}};
  }
  if(req.allowedTools.includes("check_identity"))return{name:"check_identity" as const,args:{target_id:cycle===1?1:2}};
  if(req.allowedTools.includes("speak"))return{name:"speak" as const,args:{text:"Raw"}};
  if(req.allowedTools.includes("vote"))return{name:"vote" as const,args:{target_id:cycle===1?1:2,abstain:false}};
  throw new Error(`unexpected:${req.context.stage}`);
 }};
 await game.phaseManager.runSingleCycle(provider);cycle=2;const prefix=game.phaseManager.getEvents().length;
 const cancelled=await game.phaseManager.runSingleCycle(provider);expect(cancelled).toEqual({day:2,phase:mode==="leave_night"?Phase.Voting:Phase.Night,gameOver:false,result:null});
 expect(state(game.world)).toEqual({history:[]});expect(game.world.getAliveEntityIds()).toEqual([2,3,4,5,6]);
 expect(game.phaseManager.getEvents().slice(prefix).map(event=>event.type)).not.toContain("wolf_kill_vote_cast");
 for(const type of ["gravekeeper_reported","night_resolved","seer_checked","day_speech","vote_cast"])expect(game.phaseManager.getEvents().slice(prefix).some(event=>event.type===type)).toBe(false);
 expect(cancelled).not.toHaveProperty("previousExile");
 await game.phaseManager.runSingleCycle(provider);expect(state(game.world).history).toEqual([{exileDay:1,receivedDay:2,targetId:1,result:{kind:"camp",camp:"wolf"}}]);expect(game.phaseManager.getSnapshot().result?.winner).toBe("good");
});

for(const locale of ["zh-CN","en"] as const)test(`${locale}: strict feedback readers and private rendering reject role/combined labels, bad IDs/dates, extra fields and accessors without exposing an exact role`,()=>{
 const {world}=bootstrapGame(board,{fixedRoles:deck,locale});let reads=0;
 const good={exileDay:1,receivedDay:2,targetId:1,result:{kind:"camp",camp:"wolf"}},accessor={...good};Object.defineProperty(accessor,"result",{enumerable:true,get(){reads++;return{kind:"role",role:"wolf_king"};}});
 const bad=[{...good,result:{kind:"role",role:"wolf_king"}},{...good,result:{kind:"combined",camp:"wolf",role:"wolf_king"}},{...good,result:{kind:"camp",camp:"unknown"}},{...good,targetId:0},{...good,targetId:1.5},{...good,exileDay:0},{...good,receivedDay:3},{...good,receivedDay:Infinity},{...good,role:"wolf_king"},accessor];
 for(const item of bad){
  expect(readGravekeeperReport(item)).toBeNull();
  setGravekeeperState(role(world,3),{history:[item as never]});const prompt=role(world,3).renderPrompt(locale);
  expect(prompt).toContain(locale==="en"?"Unknown":"未知");expect(prompt).not.toContain("Wolf King");expect(policy(world).buildObservation(request(3,2,[])).ownState.gravekeeper).toEqual({history:[]});
 }
 expect(reads).toBe(0);const parsed=readGravekeeperReport(good)!;parsed.result.camp="good";expect(good.result.camp).toBe("wolf");
 expect(readGravekeeperFeedback({...good,actorId:3})).toEqual({...good,actorId:3});expect(readGravekeeperFeedback({...good,actorId:-1})).toBeNull();
 const event={timestamp:1,type:"gravekeeper_reported",payload:{...good,actorId:3,result:{kind:"role",role:"wolf_king"}}} as unknown as GameEvent;
 expect(getDefaultScriptEventRenderRegistry().toJudgeLine(event,locale)).toBe(locale==="en"?"Unknown":"未知");
});

const deck=[Role.Wolf,Role.Wolf,Role.Gravekeeper,Role.Seer,Role.Villager,Role.Villager];
const board:BoardConfig={...sixPlayerMvpConfig,winConditions:[WinCondition.SlaughterSide],roleSetups:[{role:Role.Wolf,count:2},{role:Role.Gravekeeper,count:1},{role:Role.Seer,count:1},{role:Role.Villager,count:2}]};
const role=(world:ReturnType<typeof bootstrapGame>["world"],id:number)=>world.getComponent<RoleComponent>(id,COMPONENT.Role)!;
const state=(world:ReturnType<typeof bootstrapGame>["world"],id=3)=>getGravekeeperState(role(world,id))!;
function policy(world:ReturnType<typeof bootstrapGame>["world"],config:BoardConfig=board){return new PlayerPromptPolicy(world,{roleCatalog:getDefaultRoleCatalog(),toolSpecRegistry:getDefaultToolSpecRegistry(),targetHintRegistry:getDefaultTargetHintRegistry(),phaseStageLocalizationRegistry:getDefaultPhaseStageLocalizationRegistry(),configRenderRegistry:getDefaultConfigRenderRegistry(),boardConfig:config});}
const request=(actorId:number,day:number,events:ActionRequest["context"]["visible_events"]):ActionRequest=>({actorId,phase:Phase.Day,allowedTools:["speak"],context:{day,stage:"day_speech",visible_events:events,turn_constraints:{}}});

for(const mode of ["knight","white_wolf_king"] as const)test(`${mode}: a public kill interrupts the day without becoming a next-night exile feedback`,async()=>{
 const fixed=mode==="knight"?[Role.Knight,Role.Wolf,Role.Gravekeeper,Role.Seer,Role.Villager,Role.Wolf]:[Role.WhiteWolfKing,Role.Wolf,Role.Gravekeeper,Role.Seer,Role.Villager,Role.Villager];
 const config={...board,roleSetups:[...new Set(fixed)].map(role=>({role,count:fixed.filter(item=>item===role).length})),hooks:{...board.hooks,onPreVote:true},knight:{enabledWindows:[KnightDuelWindow.AfterSpeeches]},selfDestruct:{enabledWindows:mode==="white_wolf_king"?[ActionWindow.OnPreVote]:[]}},game=bootstrapGame(config,{fixedRoles:fixed});let cycle=1;
 const provider={async getAction(req:ActionRequest){
  if(req.allowedTools.includes("speak_to_wolves"))return{name:"speak_to_wolves" as const,args:{text:"End",end_chat:true}};
  if(req.allowedTools.includes("kill_vote"))return{name:"kill_vote" as const,args:{target_id:null,abstain:true}};
  if(req.allowedTools.includes("check_identity"))return{name:"check_identity" as const,args:{target_id:cycle===1?2:mode==="knight"?6:2}};
  if(req.allowedTools.includes("speak"))return{name:"speak" as const,args:{text:"Raw"}};
  if(req.allowedTools.includes("duel"))return{name:"duel" as const,args:{target_id:2,confirm:true}};
  if(req.allowedTools.includes("self_destruct_with_target"))return{name:"self_destruct_with_target" as const,args:{target_id:5,confirm:true,reason:"Public blast"}};
  if(req.allowedTools.includes("self_destruct"))return null;
  if(req.allowedTools.includes("vote"))return{name:"vote" as const,args:{target_id:mode==="knight"?6:2,abstain:false}};
  throw new Error(`unexpected:${req.context.stage}`);
 }};
 await game.phaseManager.runSingleCycle(provider);cycle=2;await game.phaseManager.runSingleCycle(provider);
 expect(game.phaseManager.getEvents().some(event=>event.type==="gravekeeper_reported")).toBe(false);expect(state(game.world)).toEqual({history:[]});expect(game.phaseManager.getSnapshot().result?.winner).toBe("good");
});

for(const locale of ["zh-CN","en"] as const)test(`${locale}: frozen camp labels are delivered after Witch/before Seer, remain actor-private and expose no pending fact or exact role`,async()=>{
 const config={...board,roleSetups:[{role:Role.Wolf,count:2},{role:Role.Gravekeeper,count:1},{role:Role.Seer,count:1},{role:Role.Witch,count:1},{role:Role.Villager,count:1}]},{world}=bootstrapGame(config,{fixedRoles:[Role.Wolf,Role.Wolf,Role.Gravekeeper,Role.Seer,Role.Witch,Role.Villager],locale}),events:GameEvent[]=[];
 const catalog=new RoleCatalog(getDefaultRoleCatalog().all().map(profile=>profile.role===Role.Wolf?{...profile,inspectionLabels:{camp:Camp.Good}}:profile));
 const fact=captureExileFeedback(world,1,1,catalog)!;expect(fact).toEqual({exileDay:1,targetId:1,result:{kind:"camp",camp:"good"}});
 role(world,1).camp=Camp.ThirdParty;world.getComponent<{alive:boolean}>(1,COMPONENT.Alive)!.alive=false;
 expect(state(world)).toEqual({history:[]});expect(policy(world).buildObservation(request(3,1,[])).ownState.gravekeeper).toEqual({history:[]});
 const stages=new NightStageRegistry();expect(stages.getStages(board).map(stage=>stage.id)).toContain("gravekeeper_feedback");
 const executionOrder:string[]=[];
 const instrumented=new RoleCatalog(getDefaultRoleCatalog().all().map(profile=>profile.role!==Role.Gravekeeper?profile:{...profile,nightStages:[{...GRAVEKEEPER_FEEDBACK_STAGE,async execute(ctx){executionOrder.push("feedback");await GRAVEKEEPER_FEEDBACK_STAGE.execute(ctx);}}]}));
 const pipeline=new NightPipeline({world,events,toolGateway:new ToolGateway(),damageResolutionSystem:new DamageResolutionSystem(),stageRegistry:new NightStageRegistry(instrumented)});
 await pipeline.execute(config,{async getAction(req){executionOrder.push(req.context.stage);if(req.allowedTools.includes("speak_to_wolves"))return{name:"speak_to_wolves",args:{text:"End",end_chat:true}};if(req.allowedTools.includes("kill_vote"))return{name:"kill_vote",args:{target_id:null,abstain:true}};if(req.allowedTools.includes("use_potion"))return{name:"use_potion",args:{target_id:5,potion_type:"none"}};if(req.allowedTools.includes("check_identity"))return{name:"check_identity",args:{target_id:2}};throw new Error("no_gravekeeper_action");}},2,{previousExile:fact});
 expect(executionOrder.indexOf("witch")).toBeLessThan(executionOrder.indexOf("feedback"));
 expect(executionOrder.indexOf("feedback")).toBeLessThan(executionOrder.indexOf("seer"));
 const report=events.find(event=>event.type==="gravekeeper_reported")!;expect(report.payload).toEqual({actorId:3,targetId:1,exileDay:1,receivedDay:2,result:{kind:"camp",camp:"good"}});
 expect(state(world).history).toEqual([{targetId:1,exileDay:1,receivedDay:2,result:{kind:"camp",camp:"good"}}]);
 expect(state(world).history[0].result).not.toBe(report.payload.result);expect(state(world).history[0].result).not.toBe(fact.result);
 for(const actorId of world.entityIds())expect(buildAgentVisibleEventFeed(world,events,actorId).some(event=>event.type==="gravekeeper_reported")).toBe(actorId===3);
 const feed=buildAgentVisibleEventFeed(world,events,3),own=policy(world).buildObservation(request(3,2,feed));expect(own.ownState.gravekeeper?.history[0].result).toEqual({kind:"camp",camp:"good"});
 expect(Object.isFrozen(own.ownState.gravekeeper!.history)).toBe(true);expect(policy(world).buildObservation(request(4,2,buildAgentVisibleEventFeed(world,events,4))).ownState.gravekeeper).toBeUndefined();
 (feed.find(event=>event.type==="gravekeeper_reported")!.payload.result as Record<string,unknown>).camp="tampered";expect(report.payload.result).toEqual({kind:"camp",camp:"good"});
 const render=getDefaultScriptEventRenderRegistry();expect(render.toChatLine(report,locale)).toBeNull();expect(render.toLiveRender(report,false,locale)).toEqual([]);expect(render.toLiveRender(report,true,locale)[0].kind).toBe("private");expect(render.toReplayStage(report)).toBe("gravekeeper_feedback");
 expect(role(world,3).renderPrompt(locale)).toContain(locale==="en"?"night 2 reports player 1, exiled on day 1, as Good":"第2夜收到第1日放逐1号的结果：好人");
 expect(JSON.stringify(report.payload)).not.toContain('"role"');
});

for(const locale of ["zh-CN","en"] as const)test(`${locale}: passive exile feedback coexists with a separately granted Seer ability, using independent history and one-use authority`,async()=>{
 const {world}=bootstrapGame(board,{fixedRoles:deck,locale}),events:GameEvent[]=[];
 const ability=grantNightAbility(world,3,{id:"gift:grave-vision",kind:"seer_check",state:{lastTarget:null,lastIsWerewolf:null,lastResult:null,history:[]},source:{kind:"gift",actorId:4},startsOnDay:2,maxUses:1},events);
 const fact=captureExileFeedback(world,1,1)!;world.getComponent<{alive:boolean}>(1,COMPONENT.Alive)!.alive=false;let actions=0;
 await new NightPipeline({world,events,toolGateway:new ToolGateway(),damageResolutionSystem:new DamageResolutionSystem()}).execute(board,{async getAction(req){
  if(req.actorId===3){actions++;expect(req.context.stage).toBe("seer");expect(req.context.ability_id).toBe("gift:grave-vision");expect(state(world).history).toEqual([{exileDay:1,receivedDay:2,targetId:1,result:{kind:"camp",camp:"wolf"}}]);}
  if(req.allowedTools.includes("speak_to_wolves"))return{name:"speak_to_wolves",args:{text:"End",end_chat:true}};
  if(req.allowedTools.includes("kill_vote"))return{name:"kill_vote",args:{target_id:null,abstain:true}};
  if(req.allowedTools.includes("check_identity"))return{name:"check_identity",args:{target_id:2}};
  throw new Error(`unexpected:${req.context.stage}`);
 }},2,{previousExile:fact});
 expect(actions).toBe(1);expect(ability.uses).toBe(1);expect(ability.state.history).toEqual([{targetId:2,isWerewolf:true,result:{kind:"camp",camp:"wolf"}}]);expect(state(world).history).toHaveLength(1);expect(role(world,3).role).toBe(Role.Gravekeeper);
});

for(const locale of ["zh-CN","en"] as const)test(`${locale}: multiple native keepers only learn the immediately preceding exile once per night, and dead/transformed keepers receive nothing`,async()=>{
 const config={...board,roleSetups:[{role:Role.Wolf,count:2},{role:Role.Gravekeeper,count:2},{role:Role.Villager,count:2}]},game=bootstrapGame(config,{fixedRoles:[Role.Wolf,Role.Wolf,Role.Gravekeeper,Role.Gravekeeper,Role.Villager,Role.Villager],locale}),events:GameEvent[]=[];
 let fact={exileDay:1,targetId:1,result:{kind:"camp" as const,camp:Camp.ThirdParty}};
 let day=1;const ctx={world:game.world,events,isCurrent:()=>true,currentDay:()=>day,get previousExile(){return fact;},getAliveByRole:(wanted:Role)=>game.world.getAliveEntityIds().filter(id=>role(game.world,id).role===wanted)} as NightStageContext;
 await GRAVEKEEPER_FEEDBACK_STAGE.execute(ctx);expect(events).toEqual([]);day=2;
 await GRAVEKEEPER_FEEDBACK_STAGE.execute(ctx);await GRAVEKEEPER_FEEDBACK_STAGE.execute(ctx);expect(events.filter(event=>event.type==="gravekeeper_reported").map(event=>event.payload.actorId)).toEqual([3,4]);
 expect(state(game.world,3).history).toHaveLength(1);expect(state(game.world,4).history).toHaveLength(1);expect(state(game.world,3).history[0]).not.toBe(state(game.world,4).history[0]);
 day=3;await GRAVEKEEPER_FEEDBACK_STAGE.execute(ctx);expect(events).toHaveLength(2);
 fact={...fact,exileDay:2};game.world.getComponent<{alive:boolean}>(3,COMPONENT.Alive)!.alive=false;role(game.world,4).role=Role.Villager;
 await GRAVEKEEPER_FEEDBACK_STAGE.execute(ctx);expect(events).toHaveLength(2);expect(state(game.world,3).history).toHaveLength(1);
});

for(const target of [1,4] as const)test(`actual exile ${target}: no early state, next night camp feedback, and terminal exile opens no extra night`,async()=>{
 const game=bootstrapGame(board,{fixedRoles:deck});let cycle=1;
 const provider={async getAction(req:ActionRequest){
  if(req.allowedTools.includes("speak_to_wolves"))return{name:"speak_to_wolves" as const,args:{text:"End",end_chat:true}};
  if(req.allowedTools.includes("kill_vote"))return{name:"kill_vote" as const,args:{target_id:null,abstain:true}};
  if(req.allowedTools.includes("check_identity"))return{name:"check_identity" as const,args:{target_id:cycle===1?1:2}};
  if(req.allowedTools.includes("speak"))return{name:"speak" as const,args:{text:"Raw"}};
  if(req.allowedTools.includes("vote"))return{name:"vote" as const,args:{target_id:cycle===1?target:cycle===2?target===1?2:1:2,abstain:false}};
  throw new Error(`unexpected:${req.context.stage}`);
 }};
 await game.phaseManager.runSingleCycle(provider);expect(state(game.world)).toEqual({history:[]});expect(game.phaseManager.getEvents().some(event=>event.type==="gravekeeper_reported")).toBe(false);
 cycle=2;await game.phaseManager.runSingleCycle(provider);expect(state(game.world).history).toEqual([{exileDay:1,receivedDay:2,targetId:target,result:{kind:"camp",camp:target===1?"wolf":"good"}}]);
 if(target===4){cycle=3;await game.phaseManager.runSingleCycle(provider);expect(state(game.world).history.at(-1)).toEqual({exileDay:2,receivedDay:3,targetId:1,result:{kind:"camp",camp:"wolf"}});}
 expect(game.phaseManager.getSnapshot().result?.winner).toBe("good");const length=game.phaseManager.getEvents().length;await game.phaseManager.runSingleCycle(provider);expect(game.phaseManager.getEvents()).toHaveLength(length);
});

for(const mode of ["idiot","abstain","keeper_dead","pending_knife","pending_poison"] as const)test(`${mode}: non-exiles and prior death give no feedback; current-night pending damage does not suppress an eligible keeper`,async()=>{
 const fixed=[Role.Wolf,Role.Wolf,Role.Gravekeeper,mode==="idiot"?Role.Idiot:Role.Witch,Role.Villager,Role.Villager],config={...board,roleSetups:[{role:Role.Wolf,count:2},{role:Role.Gravekeeper,count:1},{role:fixed[3],count:1},{role:Role.Villager,count:2}]},game=bootstrapGame(config,{fixedRoles:fixed});let cycle=1;
 const provider={async getAction(req:ActionRequest){
  if(req.allowedTools.includes("speak_to_wolves"))return{name:"speak_to_wolves" as const,args:{text:"End",end_chat:true}};
  if(req.allowedTools.includes("kill_vote"))return{name:"kill_vote" as const,args:{target_id:cycle===2&&mode==="pending_knife"?3:null,abstain:!(cycle===2&&mode==="pending_knife")}};
  if(req.allowedTools.includes("use_potion"))return{name:"use_potion" as const,args:{target_id:cycle===2&&mode==="pending_poison"?3:4,potion_type:cycle===2&&mode==="pending_poison"?"poison" as const:"none" as const}};
  if(req.allowedTools.includes("speak"))return{name:"speak" as const,args:{text:"Raw"}};
  if(req.allowedTools.includes("vote"))return{name:"vote" as const,args:{target_id:cycle===1?mode==="abstain"?null:mode==="idiot"?4:mode==="keeper_dead"?3:1:null,abstain:cycle!==1||mode==="abstain"}};
  throw new Error(`unexpected:${req.context.stage}`);
 }};
 await game.phaseManager.runSingleCycle(provider);cycle=2;await game.phaseManager.runSingleCycle(provider);
 const feedback=game.phaseManager.getEvents().filter(event=>event.type==="gravekeeper_reported");expect(feedback).toHaveLength(mode.startsWith("pending_")?1:0);
 if(mode.startsWith("pending_")){expect(feedback[0].payload).toEqual({actorId:3,targetId:1,exileDay:1,receivedDay:2,result:{kind:"camp",camp:"wolf"}});expect(game.world.getAliveEntityIds()).not.toContain(3);}
});
