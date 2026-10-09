import { Camp } from "../../../src/core";
import { PotionType } from "../../../src/core";
import {expect,test} from "bun:test";
import {bootstrapGame} from "../../../src/app/bootstrap";
import {Role,Phase,WinCondition,COMPONENT,ActionWindow,type BoardConfig,type RoleComponent,type ActionRequest} from "../../../src/core";
import {sixPlayerMvpConfig} from "../../../src/runtime/scenarios/six_player_mvp";
import {getDreamerState,getHunterState,getWolfKingState,getWitchState} from "../../../src/game/mechanisms/roles/private_state";
import {buildAgentVisibleEventFeed} from "../../../src/game/engine/agent_visible_event_feed";
import {ActionReception} from "../../../src/ai/agents/player/action_reception";
import {PlayerPromptPolicy} from "../../../src/ai/agents/player/player_prompt_policy";
import {getDefaultRoleCatalog,getDefaultToolSpecRegistry,getDefaultTargetHintRegistry,getDefaultPhaseStageLocalizationRegistry,getDefaultConfigRenderRegistry} from "../../../src/game/mechanisms";
import {NightPipeline} from "../../../src/game/engine/phase_pipeline/night_pipeline";
import {DamageResolutionSystem} from "../../../src/core/domain/systems/damage_resolution_system";
import {ToolGateway} from "../../../src/game/gateway/tool_gateway";
import {grantNightAbility} from "../../../src/game/mechanisms/roles/ability_changes";
import {sixPlayerMvpConfig as plainBoard} from "../../../src/runtime/scenarios/six_player_mvp";
import {DeathResolution} from "../../../src/game/engine/death_resolution";
import {EventRegistry} from "../../../src/game/engine/event_registry";
import {ActionValidator} from "../../../src/game/gateway/action_validator";
import {ToolValidationRuleRegistry} from "../../../src/game/mechanisms/validation/tool_validation_rule_registry";
import {DreamNightFrame} from "../../../src/game/mechanisms/roles/dreamer/night_frame";
import {DeathCause,type GameEvent,type RuntimeSnapshot} from "../../../src/core";

const deck=[Role.Dreamer,Role.Wolf,Role.Witch,Role.Hunter,Role.Villager,Role.Villager];

test("a real gateway rule revoking the night-settlement scope cannot commit late last words",async()=>{
 const game=bootstrapGame(config(),{fixedRoles:deck}),events:GameEvent[]=[],state:RuntimeSnapshot={day:1,phase:Phase.Day,gameOver:false,result:null};let current=true;
 const gateway=new ToolGateway(new ActionValidator(new ToolValidationRuleRegistry({speak:()=>{current=false;return null;}})));
 await new DeathResolution(game.world,events,gateway,new EventRegistry(),state).resolve([4],{4:[DeathCause.WolfKill]},{async getAction(request){expect(request.context.stage).toBe("last_words");return{name:"speak",args:{text:"Late last words"}};}},Phase.Night,Phase.Day,{}, {dreams:new DreamNightFrame([]),nightOriginIds:[4],isCurrent:()=>current});
 expect(events.some(event=>event.type==="last_words_spoken")).toBe(false);expect(game.world.activeDeathActionCount).toBe(0);expect(game.world.getAliveEntityIds()).not.toContain(4);
});

for(const mode of ["mixed_waves","compound_body"] as const)test(`${mode}: early White blast merges Day deaths with Night roots without granting every shooter night dream effects`,async()=>{
 const fixed=[Role.Dreamer,Role.WhiteWolfKing,Role.Wolf,Role.Hunter,Role.WolfKing,Role.Witch,Role.Villager,Role.Villager],board={...config(fixed),boardSize:8,enableSheriff:true,hooks:{onDaybreak:true,onPreElection:true,onPreVote:true,onPerSpeechGap:true},selfDestruct:{enabledWindows:[ActionWindow.OnPreElection]}},game=bootstrapGame(board,{fixedRoles:fixed});const shots:Array<[number,Phase]> = [];
 const snapshot=await game.phaseManager.runSingleCycle({async getAction(request){
  if(request.allowedTools.includes("dream"))return{name:"dream",args:{target_id:7}};
  if(request.allowedTools.includes("speak_to_wolves"))return{name:"speak_to_wolves",args:{text:"End",end_chat:true}};
  if(request.allowedTools.includes("kill_vote"))return{name:"kill_vote",args:{target_id:mode==="mixed_waves"?4:5,abstain:false}};
  if(request.allowedTools.includes("use_potion"))return{name:"use_potion",args:{target_id:6,potion_type:PotionType.None}};
  if(request.allowedTools.includes("self_destruct_with_target"))return{name:"self_destruct_with_target",args:{target_id:5,confirm:true,reason:"Public blast"}};
  if(request.allowedTools.includes("self_destruct"))return null;
  if(request.allowedTools.includes("speak"))return{name:"speak",args:{text:"Raw"}};
  if(request.allowedTools.includes("shoot")){shots.push([request.actorId,request.context.death_phase!]);return{name:"shoot",args:{target_id:request.actorId===4?7:1}};}
  throw new Error(`blast_interrupts_remaining_day:${request.context.stage}`);
 }});
 expect(snapshot).toEqual({day:2,phase:Phase.Night,gameOver:false,result:null});
 const events=game.phaseManager.getEvents();expect(events.filter(event=>event.type==="death_shot_blocked").map(event=>event.payload)).toEqual(mode==="mixed_waves"?[{actorId:4,targetId:7,reason:"night_protection"}]:[]);
 expect(events.filter(event=>event.type==="additional_deaths").map(event=>event.payload)).toEqual(mode==="compound_body"?[{deaths:[7]}]:[]);
 expect(shots).toEqual(mode==="mixed_waves"?[[4,Phase.Night],[5,Phase.Day]]:[[5,Phase.Day]]);
 expect(game.world.getAliveEntityIds()).toEqual(mode==="mixed_waves"?[3,6,7,8]:[3,4,6,8]);
});

test("a committed dream prefix is retained as evidence but same-world same-night reentry after cancellation is explicitly rejected",async()=>{
 const game=bootstrapGame(config(),{fixedRoles:deck});let dreams=0;
 const provider={async getAction(request:ActionRequest){
  if(request.allowedTools.includes("dream")){dreams++;return{name:"dream" as const,args:{target_id:5}};}
  if(request.allowedTools.includes("speak_to_wolves")){game.phaseManager.jumpTo(Phase.Night);return{name:"speak_to_wolves" as const,args:{text:"End",end_chat:true}};}
  throw new Error("no_stage_after_cancel");
 }};
 expect(await game.phaseManager.runSingleCycle(provider)).toEqual({day:1,phase:Phase.Night,gameOver:false,result:null});
 expect(getDreamerState(role(game,1))).toEqual({lastDay:1,lastTarget:5,history:[{day:1,targetId:5}]});
 await expect(game.phaseManager.runSingleCycle(provider)).rejects.toThrow("dream_night_reentry_after_commit");expect(dreams).toBe(1);expect(game.phaseManager.getEvents().some(event=>event.type==="night_resolved")).toBe(false);
 await expect(new NightPipeline({world:game.world,events:[],toolGateway:new ToolGateway(),damageResolutionSystem:new DamageResolutionSystem()}).execute(config(),provider,1)).rejects.toThrow("dream_night_reentry_after_commit");
});

test("three invalid choices cannot silently skip a still-authorized mandatory dream",async()=>{
 const game=bootstrapGame(config(),{fixedRoles:deck});let attempts=0;
 await expect(game.phaseManager.runSingleCycle({async getAction(request){if(request.allowedTools.includes("dream")){attempts++;return null;}throw new Error("no_later_stage");}})).rejects.toThrow("dream_required_action_missing");
 expect(attempts).toBe(3);expect(getDreamerState(role(game,1))).toEqual({lastDay:null,lastTarget:null,history:[]});expect(game.phaseManager.getEvents().some(event=>event.type==="night_resolved")).toBe(false);
});

test("a same-phase jump during a Night-origin death shot revokes the old gun and link without rolling back the valid initial death",async()=>{
 const game=bootstrapGame(config(),{fixedRoles:deck});
 const snapshot=await game.phaseManager.runSingleCycle({async getAction(request){
  if(request.allowedTools.includes("dream"))return{name:"dream",args:{target_id:5}};
  if(request.allowedTools.includes("speak_to_wolves"))return{name:"speak_to_wolves",args:{text:"End",end_chat:true}};
  if(request.allowedTools.includes("kill_vote"))return{name:"kill_vote",args:{target_id:4,abstain:false}};
  if(request.allowedTools.includes("use_potion"))return{name:"use_potion",args:{target_id:3,potion_type:PotionType.None}};
  if(request.allowedTools.includes("speak"))return{name:"speak",args:{text:"Raw"}};
  if(request.allowedTools.includes("shoot")){game.phaseManager.jumpTo(Phase.Day);return{name:"shoot",args:{target_id:1}};}
  throw new Error("no_action_after_revoke");
 }});
 expect(snapshot).toEqual({day:1,phase:Phase.Day,gameOver:false,result:null});expect(game.world.getAliveEntityIds()).toEqual([1,2,3,5,6]);expect(getHunterState(role(game,4))?.canShoot).toBe(true);
 expect(game.phaseManager.getEvents().some(event=>event.type==="hunter_shot"||event.type==="dream_death"||event.type==="additional_deaths")).toBe(false);expect(game.world.activeDeathActionCount).toBe(0);
});

test("a same-wave already dead target receives Dream cause before its later death hook, so it cannot take a second gun",async()=>{
 const fixed=[Role.Dreamer,Role.WhiteWolfKing,Role.Wolf,Role.Hunter,Role.Hunter,Role.Witch,Role.Villager,Role.Villager],board={...config(fixed),boardSize:8,enableSheriff:true,hooks:{onDaybreak:true,onPreElection:true,onPreVote:true,onPerSpeechGap:true},selfDestruct:{enabledWindows:[ActionWindow.OnPreElection]}},game=bootstrapGame(board,{fixedRoles:fixed});const shots:number[]=[];
 await game.phaseManager.runSingleCycle({async getAction(request){
  if(request.allowedTools.includes("dream"))return{name:"dream",args:{target_id:5}};
  if(request.allowedTools.includes("speak_to_wolves"))return{name:"speak_to_wolves",args:{text:"End",end_chat:true}};
  if(request.allowedTools.includes("kill_vote"))return{name:"kill_vote",args:{target_id:4,abstain:false}};
  if(request.allowedTools.includes("use_potion"))return{name:"use_potion",args:{target_id:6,potion_type:PotionType.None}};
  if(request.allowedTools.includes("self_destruct_with_target"))return{name:"self_destruct_with_target",args:{target_id:5,confirm:true,reason:"Public blast"}};
  if(request.allowedTools.includes("self_destruct"))return null;
  if(request.allowedTools.includes("speak"))return{name:"speak",args:{text:"Raw"}};
  if(request.allowedTools.includes("shoot")){shots.push(request.actorId);return{name:"shoot",args:{target_id:1}};}
  throw new Error("no_election_after_blast");
 }});
 expect(shots).toEqual([4]);expect(getHunterState(role(game,5))?.canShoot).toBe(false);expect(game.world.getAliveEntityIds()).toEqual([3,6,7,8]);
 expect(game.phaseManager.getEvents().filter(event=>event.type==="dream_death").map(event=>event.payload.targetId)).toEqual([5]);expect(game.phaseManager.getEvents().some(event=>event.type==="additional_deaths")).toBe(false);
});

for(const locale of ["zh-CN","en"] as const)test(`${locale}: a non-Dreamer with an explicitly granted dream receives the bound effect rules and last choice without a false identity`,()=>{
 const fixed=[Role.Wolf,Role.Wolf,Role.Seer,Role.Guard,Role.Villager,Role.Villager],game=bootstrapGame(plainBoard,{fixedRoles:fixed,locale});
 grantNightAbility(game.world,5,{id:"gift:day-dream",kind:"dream",state:{lastDay:1,lastTarget:6,history:[{day:1,targetId:6}]},source:{kind:"gift",actorId:3},startsOnDay:2,maxUses:2},[]);
 const request:ActionRequest={actorId:5,phase:Phase.Night,allowedTools:["dream"],context:{day:2,stage:"dreamer",ability_id:"gift:day-dream",visible_events:[],turn_constraints:{}}};
 const prompt=policy(game,plainBoard).buildUser(request,{turnId:"t1",allowedTools:["dream"],actionSubmissionHint:"submit"});
 expect(prompt).toContain(locale==="en"?"Dream ability rules for this turn:":"本轮梦能力规则：");expect(prompt).toContain(locale==="en"?"night-origin death shots":"夜间来源死亡枪");expect(prompt).toContain('"lastTarget":6');expect(prompt).toContain('"lastDay":1');expect(prompt).not.toContain(locale==="en"?"Your role is Dreamer":"你的底牌是【摄梦人】");
 expect(policy(game,plainBoard).buildObservation(request).identity.role).toBe(Role.Villager);
});
function config(roles=deck):BoardConfig{return{...sixPlayerMvpConfig,winConditions:[WinCondition.SlaughterSide],roleSetups:[...new Set(roles)].map(role=>({role,count:roles.filter(item=>item===role).length}))};}
const role=(game:ReturnType<typeof bootstrapGame>,id:number)=>game.world.getComponent<RoleComponent>(id,COMPONENT.Role)!;
function policy(game:ReturnType<typeof bootstrapGame>,board=config()){return new PlayerPromptPolicy(game.world,{boardConfig:board,roleCatalog:getDefaultRoleCatalog(),toolSpecRegistry:getDefaultToolSpecRegistry(),targetHintRegistry:getDefaultTargetHintRegistry(),phaseStageLocalizationRegistry:getDefaultPhaseStageLocalizationRegistry(),configRenderRegistry:getDefaultConfigRenderRegistry()});}

for(const locale of ["zh-CN","en"] as const)test(`${locale}: readonly mandatory dream reception has no target-state leak or early resource consumption`,()=>{
 const game=bootstrapGame(config(),{fixedRoles:deck,locale}),reception=new ActionReception(game.world),request:ActionRequest={actorId:1,phase:Phase.Night,allowedTools:["dream"],context:{day:1,stage:"dreamer",ability_id:"native:dream",visible_events:[],turn_constraints:{}}};
 expect(reception.validate(request,"dream",{target_id:5}).ok).toBe(true);
 for(const target_id of [1,999,2.5,null])expect(reception.validate(request,"dream",{target_id}).ok).toBe(false);
 expect(reception.validate({...request,phase:Phase.Day},"dream",{target_id:5})).toMatchObject({ok:false,error:"ability_phase"});
 expect(getDreamerState(role(game,1))).toEqual({lastTarget:null,lastDay:null,history:[]});
 const target=policy(game).buildObservation({...request,actorId:5,allowedTools:["speak"],phase:Phase.Day,context:{...request.context,ability_id:undefined,stage:"day_speech"}});expect(target.ownState.dreamer).toBeUndefined();
});

type Case="protected"|"knife_link"|"saved"|"poison_link"|"gun_blocked"|"gun_link"|"day_gun"|"day_exile";
for(const locale of ["zh-CN","en"] as const)for(const kind of ["protected","knife_link","saved","poison_link","gun_blocked","gun_link","day_gun","day_exile"] as Case[])test(`${locale}/${kind}: real cycle applies exactly the frozen dream damage, shot, words and day-scope rules`,async()=>{
 const game=bootstrapGame(config(),{fixedRoles:deck,locale});let guns=0;
 await game.phaseManager.runSingleCycle({async getAction(request){
  if(request.allowedTools.includes("dream"))return{name:"dream",args:{target_id:kind==="poison_link"?4:5}};
  if(request.allowedTools.includes("speak_to_wolves"))return{name:"speak_to_wolves",args:{text:"End",end_chat:true}};
  if(request.allowedTools.includes("kill_vote")){const target=kind==="knife_link"||kind==="saved"?1:kind==="gun_blocked"||kind==="gun_link"?4:kind==="protected"?5:null;return{name:"kill_vote",args:{target_id:target,abstain:target===null}};}
  if(request.allowedTools.includes("use_potion"))return{name:"use_potion",args:{target_id:kind==="saved"||kind==="poison_link"?1:kind==="protected"?5:3,potion_type:kind==="saved"?PotionType.Heal:kind==="protected"||kind==="poison_link"?PotionType.Poison:PotionType.None}};
  if(request.allowedTools.includes("speak"))return{name:"speak",args:{text:"Raw"}};
  if(request.allowedTools.includes("shoot")){guns++;return{name:"shoot",args:{target_id:kind==="gun_link"?1:5}};}
  if(request.allowedTools.includes("vote"))return{name:"vote",args:{target_id:kind==="day_gun"?4:kind==="day_exile"?1:2,abstain:false}};
  throw new Error(`unexpected:${request.context.stage}`);
 }});
 const events=game.phaseManager.getEvents();
 expect(events.filter(event=>event.type==="dream_applied").map(event=>event.payload)).toEqual([{actorId:1,targetId:kind==="poison_link"?4:5,day:1,consecutive:false}]);
 expect(events.find(event=>event.type==="night_resolved")!.payload.deaths).toEqual(kind==="knife_link"?[1,5]:kind==="poison_link"?[1,4]:kind==="gun_blocked"||kind==="gun_link"?[4]:[]);
 expect(guns).toBe(kind==="gun_blocked"||kind==="gun_link"||kind==="day_gun"?1:0);
 expect(events.filter(event=>event.type==="death_shot_blocked").map(event=>event.payload)).toEqual(kind==="gun_blocked"?[{actorId:4,targetId:5,reason:"night_protection"}]:[]);
 expect(events.filter(event=>event.type==="hunter_shot").map(event=>event.payload)).toEqual(kind==="gun_link"?[{hunterId:4,targetId:1}]:kind==="day_gun"?[{hunterId:4,targetId:5}]:[]);
 expect(events.filter(event=>event.type==="additional_deaths").map(event=>event.payload)).toEqual(kind==="gun_link"?[{deaths:[5]}]:[]);
 expect(events.filter(event=>event.type==="dream_death").map(event=>event.payload.targetId)).toEqual(kind==="knife_link"?[5]:kind==="poison_link"?[4]:kind==="gun_link"?[5]:[]);
 expect(events.filter(event=>event.type==="last_words_spoken").map(event=>event.payload.playerId)).toEqual(kind==="knife_link"?[1,5,2]:kind==="poison_link"?[1,4,2]:kind==="gun_blocked"||kind==="gun_link"?[4,2]:kind==="day_gun"?[4]:kind==="day_exile"?[1]:[2]);
 expect(game.world.getAliveEntityIds()).toEqual(kind==="knife_link"?[3,4,6]:kind==="poison_link"?[3,5,6]:kind==="gun_blocked"?[1,3,5,6]:kind==="gun_link"?[3,6]:kind==="day_gun"?[1,2,3,6]:kind==="day_exile"?[2,3,4,5,6]:[1,3,4,5,6]);
 if(kind==="protected")expect(getWitchState(role(game,3))?.poison).toBe(0);
 if(kind==="saved")expect(getWitchState(role(game,3))?.heal).toBe(0);
 if(kind==="gun_blocked")expect(getHunterState(role(game,4))?.canShoot).toBe(false);
 if(kind!=="day_gun"&&kind!=="day_exile")expect(game.phaseManager.getSnapshot().result?.winner).toBe(Camp.Good);
 for(const actor of game.world.entityIds()){
  const feed=buildAgentVisibleEventFeed(game.world,events,actor);
  expect(feed.some(event=>event.type==="dream_applied")).toBe(actor===1);expect(feed.some(event=>event.type==="dream_death")).toBe(false);
  if(kind==="gun_link")expect(feed.some(event=>event.type==="additional_deaths")).toBe(true);
 }
});

for(const king of [false,true])test(`consecutive/${king}: repeated dream overrides ordinary protection, kills the actual target and forbids death guns`,async()=>{
 const fixed=[Role.Dreamer,king?Role.WolfKing:Role.Wolf,Role.Witch,Role.Hunter,Role.Villager,Role.Villager],game=bootstrapGame(config(fixed),{fixedRoles:fixed});let guns=0;
 const provider={async getAction(request:ActionRequest){
  const day=request.context.day;
  if(request.allowedTools.includes("dream"))return{name:"dream" as const,args:{target_id:king?2:5}};
  if(request.allowedTools.includes("speak_to_wolves"))return{name:"speak_to_wolves" as const,args:{text:"End",end_chat:true}};
  if(request.allowedTools.includes("kill_vote"))return{name:"kill_vote" as const,args:{target_id:day===2&&!king?5:null,abstain:day!==2||king}};
  if(request.allowedTools.includes("use_potion"))return{name:"use_potion" as const,args:{target_id:day===2&&!king?5:3,potion_type:day===2&&!king?PotionType.Heal as const:PotionType.None as const}};
  if(request.allowedTools.includes("speak"))return{name:"speak" as const,args:{text:"Raw"}};
  if(request.allowedTools.includes("vote"))return{name:"vote" as const,args:{target_id:day===1?null:2,abstain:day===1}};
  if(request.allowedTools.includes("shoot")){guns++;throw new Error("dream_forbids_gun");}
  throw new Error(`unexpected:${request.context.stage}`);
 }};
 await game.phaseManager.runSingleCycle(provider);await game.phaseManager.runSingleCycle(provider);
 const events=game.phaseManager.getEvents();expect(events.filter(event=>event.type==="dream_applied").map(event=>event.payload.consecutive)).toEqual([false,true]);
 expect(events.filter(event=>event.type==="dream_death").map(event=>event.payload)).toEqual([{actorId:1,targetId:king?2:5,day:2,reason:"consecutive"}]);
 expect(guns).toBe(0);if(king)expect(getWolfKingState(role(game,2))?.canShoot).toBe(false);
 expect(game.phaseManager.getSnapshot().result).toMatchObject({winner:Camp.Good,decidedAt:{day:2,phase:king?Phase.Day:Phase.Voting,checkpoint:king?"night_settled":"exile_settled"}});
});

test("two Dreamers form one terminating night chain before judging, with no duplicate death or late gun",async()=>{
 const fixed=[Role.Dreamer,Role.Dreamer,Role.Wolf,Role.Hunter,Role.Villager,Role.Villager],game=bootstrapGame(config(fixed),{fixedRoles:fixed});
 await game.phaseManager.runSingleCycle({async getAction(request){
  if(request.allowedTools.includes("dream"))return{name:"dream",args:{target_id:request.actorId===1?2:5}};
  if(request.allowedTools.includes("speak_to_wolves"))return{name:"speak_to_wolves",args:{text:"End",end_chat:true}};
  if(request.allowedTools.includes("kill_vote"))return{name:"kill_vote",args:{target_id:1,abstain:false}};
  if(request.allowedTools.includes("speak"))return{name:"speak",args:{text:"Raw"}};
  if(request.allowedTools.includes("vote"))return{name:"vote",args:{target_id:3,abstain:false}};
  throw new Error(`unexpected:${request.context.stage}`);
 }});
 expect(game.phaseManager.getEvents().find(event=>event.type==="night_resolved")!.payload.deaths).toEqual([1,2,5]);expect(game.world.getAliveEntityIds()).toEqual([4,6]);expect(game.phaseManager.getSnapshot().result?.winner).toBe(Camp.Good);
});
