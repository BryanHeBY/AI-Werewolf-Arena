import { AliveComponent, aliveLifeVersion } from "../../../../core/domain/components/alive";
import { COMPONENT } from "../../../../core/domain/components/names";
import { Role, Camp, Phase } from "../../../../core/domain/model";
import type { RoleComponent } from "../../../../core/domain/components/role";
import type { NightStageHandler } from "../../stages/night/contracts";
import { getWolfBeautyState } from "../private_state";
import { bindCharm } from "./relation";

export const WOLF_BEAUTY_CHARM_STAGE: NightStageHandler = {
  id: "wolf_beauty_charm",
  priority: 450,
  async execute(ctx) {
    const day = ctx.currentDay();
    for (const actorId of ctx.getAliveByRole(Role.WolfBeauty)) {
      if (!ctx.isCurrent()) return;
      const role = ctx.world.getComponent<RoleComponent>(actorId, COMPONENT.Role)!,
        state = getWolfBeautyState(role),
        actorLife = ctx.world.getComponent<AliveComponent>(actorId, COMPONENT.Alive)!,
        actorVersion = aliveLifeVersion(actorLife);
      if (role.camp !== Camp.Wolf || !state || state.lastActedDay === day) continue;
      const targets = new Map(
        ctx.world
          .getAliveEntityIds()
          .filter((id) => id !== actorId)
          .map((id) => {
            const life = ctx.world.getComponent<AliveComponent>(id, COMPONENT.Alive)!;
            return [id, { life, version: aliveLifeVersion(life) }] as const;
          }),
      );
      const action = await ctx.actionProvider.getAction(
        ctx.makeRequest(actorId, ["charm"], { stage: "wolf_beauty", requiresAction: false }),
      );
      const current = () =>
        ctx.isCurrent() &&
        ctx.world.getComponent(actorId, COMPONENT.Role) === role &&
        role.role === Role.WolfBeauty &&
        role.camp === Camp.Wolf &&
        getWolfBeautyState(role) === state &&
        state.lastActedDay !== day &&
        ctx.world.getComponent(actorId, COMPONENT.Alive) === actorLife &&
        actorLife.alive &&
        actorVersion !== undefined &&
        aliveLifeVersion(actorLife) === actorVersion;
      if (!current()) continue;
      if (action !== null && action.name !== "charm") continue;
      let targetId = action === null ? null : action.args.target_id;
      if (action) {
        const result = ctx.toolGateway.validateAndSanitize(ctx.world, actorId, action, {
          phase: Phase.Night,
          day,
        });
        if (!current() || !result.ok || result.sanitizedCall?.name !== "charm") continue;
        targetId = result.sanitizedCall.args.target_id;
      }
      if (targetId !== null) {
        const target = targets.get(targetId);
        if (
          !target ||
          ctx.world.getComponent(targetId, COMPONENT.Alive) !== target.life ||
          !target.life.alive ||
          target.version === undefined ||
          aliveLifeVersion(target.life) !== target.version
        )
          continue;
      }
      state.targetId = targetId;
      state.lastActedDay = day;
      state.history.push({ day, targetId });
      bindCharm(ctx.world, actorId, targetId);
      ctx.events.push({
        timestamp: Date.now(),
        type: "charm_applied",
        payload: { actorId, targetId, day },
      });
    }
  },
};
