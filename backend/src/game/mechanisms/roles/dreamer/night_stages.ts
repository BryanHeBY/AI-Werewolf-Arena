import { AliveComponent, aliveLifeVersion } from "../../../../core/domain/components/alive";
import { COMPONENT } from "../../../../core/domain/components/names";
import type { RoleComponent } from "../../../../core/domain/components/role";
import { Phase } from "../../../../core/domain/model";
import type { NightStageHandler } from "../../stages/night/contracts";
import { activeNightAbility, nightAbilityActors, recordNightAbilityUse } from "../abilities";
import { markDreamNightCommitted } from "./night_frame";

export const DREAMER_NIGHT_STAGE: NightStageHandler = {
  id: "dreamer_action", priority: 150,
  async execute(ctx) {
    const day = ctx.currentDay();
    for (const {actorId,ability} of nightAbilityActors(ctx.world,"dream",day)) {
      if (!ctx.isCurrent()) return;
      const role = ctx.world.getComponent<RoleComponent>(actorId,COMPONENT.Role), actorLife = ctx.world.getComponent<AliveComponent>(actorId,COMPONENT.Alive), actorVersion = actorLife ? aliveLifeVersion(actorLife) : undefined, state = ability.state;
      if (!actorLife?.alive || !role) continue;
      const targets = new Map(ctx.world.getAliveEntityIds().filter(id=>id!==actorId).map(id=>{
        const life=ctx.world.getComponent<AliveComponent>(id,COMPONENT.Alive)!;return [id,{life,version:aliveLifeVersion(life)}] as const;
      }));
      if (targets.size===0) continue;
      let applied=false;
      const current=()=>ctx.isCurrent()&&ctx.world.getComponent(actorId,COMPONENT.Role)===role&&ctx.world.getComponent(actorId,COMPONENT.Alive)===actorLife&&actorLife.alive&&actorVersion!==undefined&&aliveLifeVersion(actorLife)===actorVersion&&activeNightAbility(role,"dream",day,ability.id)===ability&&ability.state===state;
      for (let attempt=1;attempt<=3;attempt++) {
        const request=ctx.makeRequest(actorId,["dream"],{stage:"dreamer",ability_id:ability.id,...(attempt===1?{}:{retry_attempt:attempt-1,retry_max:2})});
        const action=await ctx.actionProvider.getAction(request);
        if (!current()) break;
        if (action?.name!=="dream") continue;
        const validated=ctx.toolGateway.validateAndSanitize(ctx.world,actorId,action,{phase:Phase.Night,day,abilityId:ability.id});
        if (!current()) break;
        if (!validated.ok || validated.sanitizedCall?.name!=="dream") continue;
        const targetId=validated.sanitizedCall.args.target_id,target=targets.get(targetId);
        if (!target || ctx.world.getComponent(targetId,COMPONENT.Alive)!==target.life || !target.life.alive || target.version===undefined || aliveLifeVersion(target.life)!==target.version) continue;
        const consecutive=state.lastDay===day-1&&state.lastTarget===targetId;
        state.lastTarget=targetId;state.lastDay=day;state.history.push({day,targetId});recordNightAbilityUse(ability,day,true);
        markDreamNightCommitted(ctx.world,day);applied=true;
        ctx.state.dreamLinks.push({actorId,targetId,day,consecutive,actorLife,actorVersion,targetLife:target.life,targetVersion:target.version,...(ability.source.kind==="native"?{}:{abilityId:ability.id})});
        ctx.events.push({timestamp:Date.now(),type:"dream_applied",payload:{actorId,targetId,day,consecutive,...(ability.source.kind==="native"?{}:{abilityId:ability.id})}});
        break;
      }
      if(!applied&&current()&&[...targets].some(([id,target])=>ctx.world.getComponent(id,COMPONENT.Alive)===target.life&&target.life.alive&&target.version!==undefined&&aliveLifeVersion(target.life)===target.version))throw new Error("dream_required_action_missing");
    }
  },
};
