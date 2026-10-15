/**
 * 临时独立F04实验：真实公开设置/死亡流程，仅在原Camp安装点注入本例同一错误。
 * 手写字面断言已完成前缀；不修改生产、旧oracle、付款政策或私有配置。
 * 运行来源是记录的B13可加载工作树，不称全固定849行为等价。
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { bootstrapGame } from '/home/hby/dev/AI-Werewolf-Arena/backend/src/app/bootstrap';
import { Role, Camp, Phase, COMPONENT, DeathCause } from '/home/hby/dev/AI-Werewolf-Arena/backend/src/core';
import { foxBoard } from '/home/hby/dev/AI-Werewolf-Arena/backend/tests/support/features/cursed-fox/builders/scenario';
import { boardDefinitionFromConfig, parseBoardDefinition } from '/home/hby/dev/AI-Werewolf-Arena/backend/src/runtime/config/board_definition';
import { GameActionRequestFactory } from '/home/hby/dev/AI-Werewolf-Arena/backend/src/game/engine/action_request_factory';
import { ToolGateway } from '/home/hby/dev/AI-Werewolf-Arena/backend/src/game/gateway/tool_gateway';
import { WildChildSetupWindow } from '/home/hby/dev/AI-Werewolf-Arena/backend/src/game/mechanisms/roles/wild_child/setup';
import { wildChildBinding } from '/home/hby/dev/AI-Werewolf-Arena/backend/src/game/mechanisms/roles/wild_child/lifecycle';
import { getWildChildState, resolveWildChildDeathWave } from '/home/hby/dev/AI-Werewolf-Arena/backend/src/game/mechanisms/roles/wild_child/ports';
import { DeathResolution } from '/home/hby/dev/AI-Werewolf-Arena/backend/src/game/engine/death_resolution';
import { EventRegistry } from '/home/hby/dev/AI-Werewolf-Arena/backend/src/game/engine/event_registry';
import { ShapeshifterSetupWindow } from '/home/hby/dev/AI-Werewolf-Arena/backend/src/game/mechanisms/roles/shapeshifter/setup';
import { getShapeshifterState } from '/home/hby/dev/AI-Werewolf-Arena/backend/src/game/mechanisms/roles/shapeshifter/state-ports';
import { initialIdentityStock, initialIdentitySetupStatus, hasActiveInitialIdentitySetup, projectInitialIdentitySetup } from '/home/hby/dev/AI-Werewolf-Arena/backend/src/game/mechanisms/roles/initial_identity/deal';
const construction={get requestFactory(){return GameActionRequestFactory;}};
const normalized=(name:string,roles:Role[])=>parseBoardDefinition(boardDefinitionFromConfig(name,foxBoard(roles))).config;
const copy=(v:unknown)=>structuredClone(v);
const eventsData=(events:any[])=>events.map(e=>({type:e.type,payload:copy(e.payload)}));
async function wild(){
 const roles=[Role.WildChild,Role.Wolf,Role.Wolf,Role.Seer,Role.Witch,Role.Hunter];
 const game=bootstrapGame(normalized('f04_wild',roles),{fixedRoles:roles}),world=game.world,events:any[]=[];
 const originalRole=world.getComponent(1,COMPONENT.Role)!,oldCamp=world.getComponent(1,COMPONENT.Camp)!,oldVictory=world.getComponent(1,COMPONENT.Victory)!,model=world.getComponent(2,COMPONENT.Alive)!;
 let providerCalls=0;
 const setup=await new WildChildSetupWindow(world,new ToolGateway(),events,construction).execute(game.boardConfig,{async getAction(){providerCalls++;return{name:'choose_wild_model',args:{target_id:2}};}},1,()=>true);
 assert.equal(setup,true);assert.equal(providerCalls,1);
 const b=wildChildBinding(world)!,state=getWildChildState(originalRole)!,priorState=copy(state),error=Error('literal_f04_wild_camp_install_failed'),trace:string[]=[];
 const before=world.addComponent;let candidateCamp:unknown,caught:unknown,deathProviderCalls=0;
 world.addComponent=function(id:any,key:any,value:any){if(id===1&&key===COMPONENT.Camp){trace.push('Camp:throw');candidateCamp=value;throw error;}return before.call(this,id,key,value);};
 const resolver=new DeathResolution(world,events,new ToolGateway(),new EventRegistry(),{day:1,phase:Phase.Day,gameOver:false,result:null},game.boardConfig);
 try{await resolver.resolve([2],{2:[DeathCause.Poison]},{async getAction(){deathProviderCalls++;throw Error('unexpected_late_death_provider');}},Phase.Night,Phase.Day);}catch(e){caught=e;}finally{world.addComponent=before;}
 assert.equal(caught,error);assert.deepEqual(trace,['Camp:throw']);assert.equal(deathProviderCalls,0);
 assert.equal(world.getComponent(1,COMPONENT.Role),originalRole);assert.equal(originalRole.camp,Camp.Wolf);
 assert.equal(world.getComponent(1,COMPONENT.Camp),oldCamp);assert.equal(oldCamp.camp,Camp.Good);
 assert.equal(world.getComponent(1,COMPONENT.Victory),oldVictory);assert.deepEqual(oldVictory.affiliations,[{kind:'faction',faction:Camp.Good}]);
 assert.equal(model.alive,false);assert.equal(b.modelDeath,true);assert.equal(b.modelCommitted,true);assert.equal(b.actor.camp,Camp.Good);assert.equal(b.camp,oldCamp);assert.equal(b.victory,oldVictory);
 assert.deepEqual(copy(state),priorState);assert.equal(state.remaining,0);assert.equal(state.status,'chosen');assert.equal(state.eligibleNight,null);
 assert.deepEqual(events.map(e=>e.type),['wild_child_model_chosen','wild_child_model_eliminated']);
 const priorEventCount=events.length;
 resolveWildChildDeathWave(world,[2],{2:[DeathCause.Poison]},1,Phase.Night,events);
 assert.equal(events.length,priorEventCount);assert.equal(state.status,'chosen');assert.equal(oldCamp.camp,Camp.Good);
 return{sameError:true,errorMessage:(caught as Error).message,setupProviderCalls:providerCalls,deathProviderCalls,trace,role:{sameReference:true,role:originalRole.role,camp:originalRole.camp},camp:{sameOldReference:true,value:oldCamp.camp,candidate:copy(candidateCamp)},victory:{sameOldReference:true,value:copy(oldVictory)},modelAlive:model.alive,binding:{modelDeath:b.modelDeath,modelCommitted:b.modelCommitted,actorCapturedCamp:b.actor.camp,sameCampRef:b.camp===oldCamp,sameVictoryRef:b.victory===oldVictory,setup:b.setup,expectedState:b.expectedState},state:copy(state),events:eventsData(events),retry:{additionalEvents:events.length-priorEventCount,state:copy(state)}};
}
async function initial(){
 const cards=[Role.Shapeshifter,Role.Seer,Role.Witch,Role.Hunter,Role.Villager,Role.Villager,Role.Wolf,Role.Wolf];
 const roles=[Role.Shapeshifter,Role.Seer,Role.Witch,Role.Hunter,Role.Wolf,Role.Wolf];
 const game=bootstrapGame(normalized('f04_shape',roles),{fixedRoles:cards}),world=game.world,events:any[]=[];
 const originalRole=world.getComponent(1,COMPONENT.Role)!,oldCamp=world.getComponent(1,COMPONENT.Camp)!,oldVictory=world.getComponent(1,COMPONENT.Victory)!,state=getShapeshifterState(originalRole)!;
 const deal=initialIdentityStock(world)!,hand=deal.hands.get(1)!,chosen=deal.reserve[0],initialState=copy(state),trace:string[]=[],error=Error('literal_f04_initial_camp_install_failed');
 const before=world.addComponent;let caught:unknown,atFailure:any,providerCalls=0;
 world.addComponent=function(id:any,key:any,value:any){if(id===1&&key===COMPONENT.Camp){trace.push('Camp:throw');atFailure={role:world.getComponent(1,COMPONENT.Role)?.role,roleCamp:world.getComponent(1,COMPONENT.Role)?.camp,camp:world.getComponent(1,COMPONENT.Camp)?.camp,state:copy(state),hand:copy(deal.hands.get(1)),reserve:copy(deal.reserve),selection:copy(deal.selection),candidateCamp:copy(value)};throw error;}const result=before.call(this,id,key,value);if(id===1&&key===COMPONENT.Role)trace.push('Role:installed');return result;};
 try{await new ShapeshifterSetupWindow(world,new ToolGateway(),events,construction).execute(game.boardConfig,{async getAction(){providerCalls++;trace.push('provider');return{name:'choose_shapeshifter_card',args:{slot:0}};}},1,()=>true);}catch(e){caught=e;}finally{world.addComponent=before;}
 assert.equal(caught,error);assert.equal(providerCalls,1);assert.deepEqual(trace,['provider','Role:installed','Camp:throw']);
 const current=world.getComponent(1,COMPONENT.Role)!;
 assert.notEqual(current,originalRole);assert.equal(originalRole.role,Role.Shapeshifter);assert.equal(originalRole.camp,Camp.Good);assert.equal(current.role,Role.Wolf);assert.equal(current.camp,Camp.Wolf);
 assert.equal(world.getComponent(1,COMPONENT.Camp),oldCamp);assert.equal(oldCamp.camp,Camp.Good);assert.equal(world.getComponent(1,COMPONENT.Victory),oldVictory);assert.deepEqual(oldVictory.affiliations,[{kind:'faction',faction:Camp.Good}]);
 assert.equal(deal.hands.get(1),chosen);assert.equal(deal.reserve[0],hand);assert.deepEqual(deal.selection,{actorId:1,slot:0,role:Role.Wolf});
 assert.equal(atFailure.state.remaining,0);assert.equal(atFailure.state.choice,0);assert.equal(state.remaining,0);assert.equal(state.choice,null);
 assert.equal(initialIdentitySetupStatus(world),'failed');assert.equal(hasActiveInitialIdentitySetup(world),false);assert.deepEqual(events,[]);
 return{sameError:true,errorMessage:(caught as Error).message,providerCalls,trace,originalRole:{role:originalRole.role,camp:originalRole.camp},newRole:{differentReference:true,role:current.role,camp:current.camp},camp:{sameOldReference:true,value:oldCamp.camp},victory:{sameOldReference:true,value:copy(oldVictory)},initialState,atCampFailure:atFailure,originalStateAfterFinally:copy(state),physicalCards:{chosenOriginalReference:deal.hands.get(1)===chosen,oldHandMovedToReserve:deal.reserve[0]===hand,selection:copy(deal.selection)},status:initialIdentitySetupStatus(world),active:hasActiveInitialIdentitySetup(world),publicProjection:projectInitialIdentitySetup(world),events:eventsData(events)};
}
const result={policy:'F04现状实验不决定修复',scope:'两个全新Camp-install抛错输入；canonical板子/真实公开provider和death流程；无模型、生产编辑或旧green复跑。',wild:await wild(),initial:await initial()};
fs.writeFileSync('/tmp/f04-camp-installation-result.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));
