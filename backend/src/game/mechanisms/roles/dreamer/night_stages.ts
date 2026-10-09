import { AliveComponent, aliveLifeVersion } from "../../../../core/domain/components/alive";
import { COMPONENT } from "../../../../core/domain/components/names";
import { Phase } from "../../../../core/domain/model";
import type { NightStageHandler } from "../../stages/night/contracts";
import { nightAbilityActors, recordNightAbilityUse } from "../abilities";
import { captureNightAbilityScope } from "../ability_scope";
import { markDreamNightCommitted } from "./night_frame";

export const DREAMER_NIGHT_STAGE: NightStageHandler = {
  id: "dreamer_action", priority: 150,
  async execute(ctx) {
    const day = ctx.currentDay();
    for (const {actorId,ability} of nightAbilityActors(ctx.world,"dream",day)) {
      if (!ctx.isCurrent()) return;
      const scope=captureNightAbilityScope(ctx.world,actorId,ability,day,()=>ctx.isCurrent()&&ctx.currentDay()===day);
      if (!scope?.isEligible()) continue;
      const actorLife=scope.life.life,actorVersion=scope.life.version,state=ability.state;
      const targets = new Map(ctx.world.getAliveEntityIds().filter(id=>id!==actorId).map(id=>{
        const life=ctx.world.getComponent<AliveComponent>(id,COMPONENT.Alive)!;return [id,{life,version:aliveLifeVersion(life)}] as const;
      }));
      if (targets.size===0) continue;
      let applied=false;
      const current=()=>scope.isEligible();
      for (let attempt=1;attempt<=3;attempt++) {
        if (!current()) break;
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
