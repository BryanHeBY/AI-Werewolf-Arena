/** 文件说明：预言家夜间查验阶段处理。 */
import { COMPONENT } from "../../../../core/domain/components/names";
import { RoleComponent } from "../../../../core/domain/components/role";
import { Camp, Phase, Role } from "../../../../core/domain/model";
import { NightStageHandler } from "../../stages/night/contracts";
import { getSeerState } from "../private_state";
import { resolveInspection } from "../inspection";
import { activeNightAbility, nightAbilityActors, recordNightAbilityUse } from "../abilities";

const seerCheckStage: NightStageHandler = {
  id: "seer_check",
  priority: 600,
  async execute(ctx): Promise<void> {
    for (const { actorId: seerId, ability } of nightAbilityActors(ctx.world, "seer_check", ctx.currentDay())) {
      if (!ctx.world.getAliveEntityIds().includes(seerId) || activeNightAbility(ctx.world.getComponent<RoleComponent>(seerId, COMPONENT.Role), "seer_check", ctx.currentDay(), ability.id) !== ability) continue;
      const req = ctx.makeRequest(seerId, ["check_identity"], {
        stage: "seer",
        ability_id: ability.id,
      });
      const action = await ctx.actionProvider.getAction(req);
      if (action?.name !== "check_identity") {
        continue;
      }

      const result = ctx.toolGateway.validateAndSanitize(ctx.world, seerId, action, {
        phase: Phase.Night,
        day: ctx.currentDay(), abilityId: ability.id,
      });
      if (!result.ok || !result.sanitizedCall) {
        continue;
      }

      const targetId = result.sanitizedCall.args.target_id;
      const inspection = resolveInspection(ctx.world, targetId, "camp", ctx.roleCatalog);
      if (!inspection) continue;
      const isWerewolf = inspection.camp === Camp.Wolf;
      const seerRole = ctx.world.getComponent<RoleComponent>(seerId, COMPONENT.Role);
      if (!activeNightAbility(seerRole, "seer_check", ctx.currentDay(), ability.id)) continue;
      const seerState = seerRole ? getSeerState(seerRole, ability.id) : undefined;
      if (seerState) {
        seerState.lastTarget = targetId;
        seerState.lastIsWerewolf = isWerewolf;
        seerState.lastResult = { ...inspection };
        seerState.history.push({ targetId, isWerewolf, result: { ...inspection } });
      }

      ctx.state.seerChecks.push({ seerId, targetId, isWerewolf, result: { ...inspection } });
      recordNightAbilityUse(ability, ctx.currentDay(), true);
      ctx.events.push({
        timestamp: Date.now(),
        type: "seer_checked",
        payload: { actorId: seerId, ...(ability.source.kind === "native" ? {} : { abilityId: ability.id }), targetId, isWerewolf, result: { ...inspection } },
      });
    }
  },
};

/** 预言家夜间阶段列表。 */
export const SEER_NIGHT_STAGES: NightStageHandler[] = [seerCheckStage];
