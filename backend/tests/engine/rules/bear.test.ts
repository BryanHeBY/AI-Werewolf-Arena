import { PotionType } from "../../../src/core";
import {expect,test} from "bun:test";
import {bootstrapGame} from "../../../src/app/bootstrap";
import {Role,Camp,Phase,WinCondition,COMPONENT,ActionWindow,type BoardConfig,type RoleComponent,type ActionRequest,type ToolCall,type GameEvent} from "../../../src/core";
import {sixPlayerMvpConfig} from "../../../src/runtime/scenarios/six_player_mvp";
import {BearNightFrame} from "../../../src/game/mechanisms/roles/bear/night_frame";
import {getBearState} from "../../../src/game/mechanisms/roles/private_state";
import {getDefaultRoleCatalog,RoleCatalog} from "../../../src/game/mechanisms/roles/catalog";
import {createAliveComponent} from "../../../src/core/domain/components/alive";
import {createRoleComponent} from "../../../src/core/domain/components/role";
import type {IdentityComponent} from "../../../src/core/domain/entities/player";
import {buildAgentVisibleEventFeed} from "../../../src/game/engine/agent_visible_event_feed";
import {getDefaultToolSpecRegistry,getDefaultTargetHintRegistry,getDefaultPhaseStageLocalizationRegistry,getDefaultConfigRenderRegistry} from "../../../src/game/mechanisms";
import {PlayerPromptPolicy} from "../../../src/ai/agents/player/player_prompt_policy";
import {ActionReception} from "../../../src/ai/agents/player/action_reception";

const deck=[Role.Bear,Role.Wolf,Role.Witch,Role.Hunter,Role.Villager,Role.Villager];
const config=(roles=deck):BoardConfig=>({...sixPlayerMvpConfig,boardSize:roles.length,roleSetups:[...new Set(roles)].map(role=>({role,count:roles.filter(r=>r===role).length})),winConditions:[WinCondition.SlaughterSide],selfDestruct:{enabledWindows:[]}});
const role=(game:ReturnType<typeof bootstrapGame>,id:number)=>game.world.getComponent<RoleComponent>(id,COMPONENT.Role)!;
function publish(game:ReturnType<typeof bootstrapGame>){const events:GameEvent[]=[];BearNightFrame.capture(game.world,1)!.publish(game.world,events,()=>true);return events;}

for(const [kind,expected] of [["right",true],["left",true],["both",true],["quiet",false],["dead_skip",false],["seat_order",false],["single",true],["empty",false]] as const)test(`${kind}: night-start adjacency uses the unique living seat ring and publishes only the public boolean`,()=>{
 const fixed=kind==="left"?[Role.Bear,Role.Witch,Role.Hunter,Role.Villager,Role.Villager,Role.Wolf]:kind==="both"?[Role.Bear,Role.Wolf,Role.Witch,Role.Hunter,Role.Villager,Role.Wolf]:kind==="quiet"?[Role.Bear,Role.Witch,Role.Wolf,Role.Hunter,Role.Villager,Role.Villager]:deck;
 const game=bootstrapGame(config(fixed),{fixedRoles:fixed});
 if(kind==="dead_skip")game.world.getComponent<{alive:boolean}>(2,COMPONENT.Alive)!.alive=false;
 if(kind==="seat_order"){game.world.getComponent<IdentityComponent>(2,COMPONENT.Identity)!.seat=4;game.world.getComponent<IdentityComponent>(4,COMPONENT.Identity)!.seat=2;}
 if(kind==="single"||kind==="empty")for(const id of game.world.entityIds())if(id!==1&&(kind==="empty"||id!==2))game.world.getComponent<{alive:boolean}>(id,COMPONENT.Alive)!.alive=false;
 const events=publish(game);expect(events.map(event=>[event.type,event.payload])).toEqual([["bear_roared",{day:1,roared:expected}]]);expect(getBearState(role(game,1))).toEqual({history:[{day:1,roared:expected}]});
 for(const actor of game.world.entityIds())expect(buildAgentVisibleEventFeed(game.world,events,actor).map(event=>event.payload)).toEqual([{day:1,roared:expected}]);
});

test("Bear sensing requires true Wolf faction, ignores Seer disguise, and respects its independent explicit role policy",()=>{
 const game=bootstrapGame(config(),{fixedRoles:deck}),profiles=getDefaultRoleCatalog().all(),wolf=profiles.find(p=>p.role===Role.Wolf)!;
 for(const [camp,sense,expected] of [[Camp.Wolf,undefined,true],[Camp.Wolf,()=>false,false],[Camp.Good,()=>true,false]] as const){
  role(game,2).camp=camp;const catalog=new RoleCatalog(profiles.map(p=>p===wolf?{...p,inspectionLabels:{camp:Camp.Good},detectableByBear:sense}:p)),events:GameEvent[]=[];getBearState(role(game,1))!.history=[];
  BearNightFrame.capture(game.world,1,catalog)!.publish(game.world,events,()=>true);expect(events[0].payload).toEqual({day:1,roared:expected});
 }
});

for(const mutation of ["clock","life_replace","revive","role_replace","state_replace","faction"] as const)test(`${mutation}: a revoked original Bear sample cannot publish or mutate old/new state`,()=>{
 const game=bootstrapGame(config(),{fixedRoles:deck}),old=getBearState(role(game,1))!,frame=BearNightFrame.capture(game.world,1)!,events:GameEvent[]=[];
 if(mutation==="life_replace")game.world.addComponent(1,COMPONENT.Alive,createAliveComponent());
 if(mutation==="revive"){const life=game.world.getComponent<{alive:boolean}>(1,COMPONENT.Alive)!;life.alive=false;life.alive=true;}
 if(mutation==="role_replace"){const fresh=createRoleComponent(Role.Bear,Camp.Good);getDefaultRoleCatalog().applyRuntime(fresh);game.world.addComponent(1,COMPONENT.Role,fresh);}
 if(mutation==="state_replace")role(game,1).privateState.bear={history:[]};
 if(mutation==="faction")role(game,1).camp=Camp.Wolf;
 frame.publish(game.world,events,()=>mutation!=="clock");expect(events).toEqual([]);expect(old.history).toEqual([]);expect(getBearState(role(game,1))!.history).toEqual([]);
});

test("a sampled neighbor's later death does not resample; next night skips its dead seat and duplicate publication changes nothing",()=>{
 const game=bootstrapGame(config(),{fixedRoles:deck}),frame=BearNightFrame.capture(game.world,1)!,events:GameEvent[]=[];game.world.getComponent<{alive:boolean}>(2,COMPONENT.Alive)!.alive=false;
 frame.publish(game.world,events,()=>true);frame.publish(game.world,events,()=>true);BearNightFrame.capture(game.world,1)!.publish(game.world,events,()=>true);BearNightFrame.capture(game.world,2)!.publish(game.world,events,()=>true);
 expect(events.map(event=>event.payload)).toEqual([{day:1,roared:true},{day:2,roared:false}]);expect(getBearState(role(game,1))!.history).toEqual(events.filter(event=>event.type==="bear_roared").map(event=>event.payload));
});

test("a manager frame belongs to its original World even if another controller reuses the same component references",()=>{
 const first=bootstrapGame(config(),{fixedRoles:deck}),second=bootstrapGame(config(),{fixedRoles:deck}),frame=BearNightFrame.capture(first.world,1)!,events:GameEvent[]=[];
 second.world.addComponent(1,COMPONENT.Role,role(first,1));second.world.addComponent(1,COMPONENT.Alive,first.world.getComponent(1,COMPONENT.Alive)!);
 frame.publish(second.world,events,()=>true);expect(events).toEqual([]);expect(getBearState(role(first,1))!.history).toEqual([]);frame.publish(first.world,events,()=>true);expect(events.map(e=>e.payload)).toEqual([{day:1,roared:true}]);
});

test("night role/state/faction or seat changes of neighbors do not rewrite the captured sample",()=>{
 const game=bootstrapGame(config(),{fixedRoles:deck}),frame=BearNightFrame.capture(game.world,1)!,events:GameEvent[]=[];role(game,2).camp=Camp.Good;game.world.getComponent<IdentityComponent>(2,COMPONENT.Identity)!.seat=4;
 frame.publish(game.world,events,()=>true);BearNightFrame.capture(game.world,2)!.publish(game.world,events,()=>true);expect(events.map(event=>event.payload)).toEqual([{day:1,roared:true},{day:2,roared:false}]);
});

for(const killedBefore of [false,true])test(`dead/${killedBefore}: the original dead Bear announces quiet, but a revived life never inherits that sample`,()=>{
 const game=bootstrapGame(config(),{fixedRoles:deck}),life=game.world.getComponent<{alive:boolean}>(1,COMPONENT.Alive)!,events:GameEvent[]=[];
 if(killedBefore)life.alive=false;const frame=BearNightFrame.capture(game.world,1)!;life.alive=false;frame.publish(game.world,events,()=>true);expect(events.map(event=>event.payload)).toEqual([{day:1,roared:false}]);
 const next=BearNightFrame.capture(game.world,2)!;life.alive=true;next.publish(game.world,events,()=>true);expect(events).toHaveLength(1);
});

for(const locale of ["zh-CN","en"] as const)test(`${locale}: no active Bear tool or pack permission, no pending observation/history, and only already-public history reaches its own prompt`,()=>{
 const game=bootstrapGame(config(),{locale,fixedRoles:deck}),policy=new PlayerPromptPolicy(game.world,{boardConfig:config(),roleCatalog:getDefaultRoleCatalog(),toolSpecRegistry:getDefaultToolSpecRegistry(),targetHintRegistry:getDefaultTargetHintRegistry(),phaseStageLocalizationRegistry:getDefaultPhaseStageLocalizationRegistry(),configRenderRegistry:getDefaultConfigRenderRegistry()}),request:ActionRequest={actorId:1,phase:Phase.Day,allowedTools:["speak"],context:{day:1,stage:"day_speech",visible_events:[],turn_constraints:{}}},frame=BearNightFrame.capture(game.world,1)!;
 expect(policy.buildObservation(request).ownState.bear).toEqual({history:[]});expect(role(game,1).renderPrompt(locale)).toContain(locale==="en"?"No Bear announcement has been published":"尚无已公布的熊公告");
 expect(getDefaultRoleCatalog().require(Role.Bear).toolSpecs??[]).toEqual([]);expect(new ActionReception(game.world).validate({...request,phase:Phase.Night,allowedTools:["kill_vote"]},"kill_vote",{target_id:2,abstain:false}).ok).toBe(false);
 const events:GameEvent[]=[];frame.publish(game.world,events,()=>true);request.context.visible_events=buildAgentVisibleEventFeed(game.world,events,1);
 expect(policy.buildObservation(request).ownState.bear).toEqual({history:[{day:1,roared:true}]});expect(role(game,1).renderPrompt(locale)).toContain(locale==="en"?"Latest public announcement: day 1, Bear roared.":"最近公开公告：第1天，熊咆哮了。");expect(policy.buildObservation({...request,actorId:3}).ownState.bear).toBeUndefined();
});

const passive=(request:ActionRequest):ToolCall|null=>{
 if(request.allowedTools.includes("speak_to_wolves"))return{name:"speak_to_wolves",args:{text:"End",end_chat:true}};
 if(request.allowedTools.includes("use_potion"))return{name:"use_potion",args:{target_id:request.actorId,potion_type:PotionType.None}};
 if(request.allowedTools.includes("speak"))return{name:"speak",args:{text:"Raw"}};
 if(request.allowedTools.includes("vote"))return{name:"vote",args:{target_id:null,abstain:true}};
 if(request.allowedTools.includes("duel"))return null;
 throw new Error(`unexpected:${request.context.stage}`);
};

test("real night last wolf death keeps its original positive sample, publishes after original words, and only then seals the victory",async()=>{
 const game=bootstrapGame(config(),{fixedRoles:deck});await game.phaseManager.runSingleCycle({async getAction(request){if(request.allowedTools.includes("kill_vote"))return{name:"kill_vote",args:{target_id:2,abstain:false}};return passive(request);}});
 const events=game.phaseManager.getEvents();expect(events.filter(e=>e.type==="bear_roared").map(e=>e.payload)).toEqual([{day:1,roared:true}]);expect(events.findIndex(e=>e.type==="last_words_spoken")).toBeLessThan(events.findIndex(e=>e.type==="bear_roared"));expect(events.findIndex(e=>e.type==="bear_roared")).toBeLessThan(events.findIndex(e=>e.type==="game_over"));expect(game.phaseManager.getSnapshot().result?.winner).toBe(Camp.Good);
});

for(const cause of ["knife","poison","dream","charm","night_shot"] as const)test(`${cause}: a Bear killed anywhere in the real night wave announces quiet after the whole chain`,async()=>{
 const fixed=cause==="dream"?[Role.Bear,Role.Wolf,Role.Witch,Role.Dreamer,Role.Villager,Role.Villager]:cause==="charm"?[Role.Bear,Role.WolfBeauty,Role.Witch,Role.Hunter,Role.Villager,Role.Villager]:deck,game=bootstrapGame(config(fixed),{fixedRoles:fixed});
 await game.phaseManager.runSingleCycle({async getAction(request){
  if(request.allowedTools.includes("kill_vote"))return{name:"kill_vote",args:{target_id:cause==="knife"?1:cause==="dream"||cause==="night_shot"?4:null,abstain:cause==="poison"||cause==="charm"}};
  if(request.allowedTools.includes("dream"))return{name:"dream",args:{target_id:1}};
  if(request.allowedTools.includes("charm"))return{name:"charm",args:{target_id:1}};
  if(request.allowedTools.includes("shoot"))return{name:"shoot",args:{target_id:1}};
  if(request.allowedTools.includes("use_potion")&&(cause==="poison"||cause==="charm"))return{name:"use_potion",args:{target_id:cause==="charm"?2:1,potion_type:PotionType.Poison}};
  return passive(request);
 }});
 const events=game.phaseManager.getEvents(),report=events.findIndex(e=>e.type==="bear_roared");expect(events.filter(e=>e.type==="bear_roared").map(e=>e.payload)).toEqual([{day:1,roared:false}]);expect(game.world.getAliveEntityIds()).not.toContain(1);expect(getBearState(role(game,1))!.history).toEqual([{day:1,roared:false}]);for(const e of events.filter(e=>["last_words_spoken","hunter_shot","dream_death","charm_death","additional_deaths"].includes(e.type)))expect(events.indexOf(e)).toBeLessThan(report);
});

for(const point of ["wolf_discussion","last_words","sheriff_nomination","sheriff_campaign_speech","sheriff_withdraw","sheriff_vote"] as const)test(`${point}: real asynchronous same-phase revision prevents all late announcements/history`,async()=>{
 const game=bootstrapGame({...config(),enableSheriff:point.startsWith("sheriff_")},{fixedRoles:deck});let revoked=false;
 await game.phaseManager.runSingleCycle({async getAction(request){
  expect(revoked).toBe(false);
  if(request.context.stage===point){revoked=true;game.phaseManager.jumpTo(request.phase);return request.allowedTools.includes("speak_to_wolves")?{name:"speak_to_wolves",args:{text:"Late",end_chat:true}}:request.allowedTools.includes("run_for_sheriff")?{name:"run_for_sheriff",args:{run:true}}:request.allowedTools.includes("vote_for_sheriff")?{name:"vote_for_sheriff",args:{target_id:1,abstain:false}}:{name:"speak",args:{text:"Late"}};}
  if(request.allowedTools.includes("kill_vote"))return{name:"kill_vote",args:{target_id:5,abstain:false}};
  if(request.allowedTools.includes("run_for_sheriff"))return{name:"run_for_sheriff",args:{run:request.actorId===1}};
  if(request.allowedTools.includes("vote_for_sheriff"))return{name:"vote_for_sheriff",args:{target_id:1,abstain:false}};
  return passive(request);
 }});
 const events=game.phaseManager.getEvents();expect(events.some(e=>e.type==="bear_roared"||e.type==="sheriff_elected"||(e.type==="day_speech"&&e.payload.text==="Late"))).toBe(false);expect(getBearState(role(game,1))!.history).toEqual([]);expect(game.world.activeDeathActionCount).toBe(0);expect(revoked).toBe(true);
});

test("first-day early White blast announces quiet after merged Night/Day deaths before interrupted judgment",async()=>{
 const fixed=[Role.Bear,Role.WhiteWolfKing,Role.Wolf,Role.Witch,Role.Hunter,Role.Villager],board={...config(fixed),enableSheriff:true,hooks:{onDaybreak:true,onPreElection:true,onPreVote:true,onPerSpeechGap:true},selfDestruct:{enabledWindows:[ActionWindow.OnPreElection]}},game=bootstrapGame(board,{fixedRoles:fixed});
 await game.phaseManager.runSingleCycle({async getAction(request){
  if(request.allowedTools.includes("kill_vote"))return{name:"kill_vote",args:{target_id:6,abstain:false}};
  if(request.allowedTools.includes("self_destruct_with_target"))return{name:"self_destruct_with_target",args:{target_id:1,confirm:true,reason:"Public"}};
  if(request.allowedTools.includes("self_destruct"))return null;
  return passive(request);
 }});
 const events=game.phaseManager.getEvents(),report=events.findIndex(e=>e.type==="bear_roared");expect(events.filter(e=>e.type==="bear_roared").map(e=>e.payload)).toEqual([{day:1,roared:false}]);expect(report).toBeLessThan(events.findIndex(e=>e.type==="game_over"));expect(game.phaseManager.getSnapshot().result?.decidedAt.checkpoint).toBe("day_interrupted");expect(events.some(e=>e.type==="sheriff_nomination_summary")).toBe(false);
});

test("night Wolf King gun kills the only good special role: complete its badge chain, announce quiet, then ordinary Good victory",async()=>{
 const fixed=[Role.Bear,Role.WolfKing,Role.Villager,Role.Villager,Role.Villager,Role.Villager],game=bootstrapGame({...config(fixed),enableSheriff:true,initialSheriffSeat:1},{fixedRoles:fixed});
 await game.phaseManager.runSingleCycle({async getAction(request){if(request.allowedTools.includes("kill_vote"))return{name:"kill_vote",args:{target_id:2,abstain:false}};if(request.allowedTools.includes("shoot"))return{name:"shoot",args:{target_id:1}};return passive(request);}});
 const events=game.phaseManager.getEvents(),gun=events.findIndex(e=>e.type==="wolf_king_shot"),badge=events.findIndex(e=>e.type==="sheriff_badge_transferred"),report=events.findIndex(e=>e.type==="bear_roared");expect(gun).toBeGreaterThan(-1);expect(gun).toBeLessThan(badge);expect(badge).toBeLessThan(report);expect(events.filter(e=>e.type==="bear_roared").map(e=>e.payload)).toEqual([{day:1,roared:false}]);expect(report).toBeLessThan(events.findIndex(e=>e.type==="game_over"));expect(game.phaseManager.getSnapshot().result?.winner).toBe(Camp.Good);expect(game.world.getAliveEntityIds()).toEqual([3,4,5,6]);
});
