import {AliveComponent,aliveLifeVersion} from "../../../../core/domain/components/alive";
import {COMPONENT} from "../../../../core/domain/components/names";
import type {RoleComponent} from "../../../../core/domain/components/role";
import {Phase,type EntityId} from "../../../../core/domain/model";
import type {World} from "../../../../core/domain/world";
import type {NightStageHandler} from "../../stages/night/contracts";
import {activeNightAbility,nightAbilityActors,recordNightAbilityUse} from "../abilities";
import {getGargoyleState,type RoleInspectionState} from "../private_state";
import {resolveInspection} from "../inspection";
import {beginRoleInspectionNight,recordRoleInspectionCompletion} from "./night_scope";

export function uninspectedRoleTargets(world:World,actorId:EntityId,state:RoleInspectionState):EntityId[]{return world.getAliveEntityIds().filter(id=>id!==actorId&&!state.history.some(report=>report.targetId===id));}
export const ROLE_INSPECTION_STAGE:NightStageHandler={id:"role_inspection",priority:180,async execute(ctx){
 const day=ctx.currentDay();beginRoleInspectionNight(ctx.world,day);
 for(const {actorId,ability} of nightAbilityActors(ctx.world,"role_check",day)){
  if(!ctx.isCurrent())return;
  const role=ctx.world.getComponent<RoleComponent>(actorId,COMPONENT.Role)!,kind=role.role,camp=role.camp,privateState=role.privateState,gargoyleState=getGargoyleState(role),state=ability.state,life=ctx.world.getComponent<AliveComponent>(actorId,COMPONENT.Alive)!,version=aliveLifeVersion(life);
  const current=()=>ctx.isCurrent()&&ctx.world.getComponent(actorId,COMPONENT.Role)===role&&role.role===kind&&role.camp===camp&&role.privateState===privateState&&getGargoyleState(role)===gargoyleState&&activeNightAbility(role,"role_check",day,ability.id)===ability&&ability.state===state&&ctx.world.getComponent(actorId,COMPONENT.Alive)===life&&life.alive&&version!==undefined&&aliveLifeVersion(life)===version;
  if(!current())continue;
  if(!uninspectedRoleTargets(ctx.world,actorId,state).length){recordRoleInspectionCompletion(ctx.world,actorId,day,ability,ctx.isCurrent);continue;}
  let completed=false;
  for(let attempt=0;attempt<3;attempt++){
   if(!current())break;
   const targets=new Map(uninspectedRoleTargets(ctx.world,actorId,state).map(id=>{const target=ctx.world.getComponent<AliveComponent>(id,COMPONENT.Alive)!;return[id,{target,version:aliveLifeVersion(target)}] as const;}));
   if(!targets.size){recordRoleInspectionCompletion(ctx.world,actorId,day,ability,ctx.isCurrent);completed=true;break;}
   const action=await ctx.actionProvider.getAction(ctx.makeRequest(actorId,["inspect_role"],{stage:"role_inspection",ability_id:ability.id,...(attempt?{retry_attempt:attempt,retry_max:2}:{})}));
   if(!current())break;
   if(action?.name!=="inspect_role")continue;
   const validated=ctx.toolGateway.validateAndSanitize(ctx.world,actorId,action,{phase:Phase.Night,day,abilityId:ability.id});
   if(!current()||!validated.ok||validated.sanitizedCall?.name!=="inspect_role")continue;
   const targetId=validated.sanitizedCall.args.target_id,target=targets.get(targetId),targetCurrent=()=>!!target&&ctx.world.getComponent(targetId,COMPONENT.Alive)===target.target&&target.target.alive&&target.version!==undefined&&aliveLifeVersion(target.target)===target.version;
   if(!targetCurrent())continue;
   const result=resolveInspection(ctx.world,targetId,"role",ctx.roleCatalog);if(!current()||!targetCurrent()||!result)continue;
   state.lastTarget=targetId;state.lastDay=day;state.history.push({day,targetId,result:{...result}});recordNightAbilityUse(ability,day,true);
   ctx.events.push({timestamp:Date.now(),type:"role_inspected",payload:{actorId,...(ability.source.kind==="native"?{}:{abilityId:ability.id}),targetId,day,result:{...result}}});recordRoleInspectionCompletion(ctx.world,actorId,day,ability,ctx.isCurrent);completed=true;break;
  }
  if(!completed&&current()){
   if(uninspectedRoleTargets(ctx.world,actorId,state).length)throw new Error("role_inspection_required_action_missing");
   recordRoleInspectionCompletion(ctx.world,actorId,day,ability,ctx.isCurrent);
  }
 }
}};
