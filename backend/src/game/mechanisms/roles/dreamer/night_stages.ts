/**
 * Executes Dreamer choices against the current ability and original target life. Inputs are
 * night-stage requests and validated dream targets; outputs preserve history and sourced dream
 * protection. Actor eligibility is read through the bound night query; it never
 * applies a death wave or refreshes an expired captured target.
 * Ordinary payload history writes delegate to the local state owner at the original
 * commit position; all checks, use accounting and publication remain in this flow.
 */
import { recordDreamSelection } from "./state";
import { isRadiantEclipseBoard, captureRadiantPaidEffect } from "../radiant_eclipse/night_frame";
import { AliveComponent, aliveLifeVersion } from "../../../../core/domain/components/alive";
import { COMPONENT } from "../../../../core/domain/components/names";
import { Phase } from "../../../../core/domain/model";
import type { NightStageHandler } from "../../stages/night/contracts";
import { recordNightAbilityUse } from "../abilities";
import { captureNightAbilityScope } from "../ability_scope";
import { markDreamNightCommitted } from "./night_frame";

export const DREAMER_NIGHT_STAGE: NightStageHandler = {
  id: "dreamer_action",
  priority: 150,
  async execute(ctx) {
    const day = ctx.currentDay();
    for (const { actorId, ability } of ctx.nightActors.actors("dream", day)) {
      if (!ctx.isCurrent()) return;
      const scope = captureNightAbilityScope(
        ctx.world,
        actorId,
        ability,
        day,
        () => ctx.isCurrent() && ctx.currentDay() === day,
      );
      if (!scope?.isEligible()) continue;
      const actorLife = scope.life.life,
        actorVersion = scope.life.version,
        state = ability.state;
      const targets = new Map(
        ctx.world
          .getAliveEntityIds()
          .filter((id) => id !== actorId)
          .map((id) => {
            const life = ctx.world.getComponent(id, COMPONENT.Alive)!;
            return [id, { life, version: aliveLifeVersion(life) }] as const;
          }),
      );
      if (targets.size === 0) continue;
      let applied = false;
      const current = () => scope.isEligible();
      for (let attempt = 1; attempt <= 3; attempt++) {
        if (!current()) {
          if (isRadiantEclipseBoard(ctx.world))
            throw new Error("radiant_eclipse_dream_scope_stale");
          break;
        }
        const request = ctx.makeRequest(actorId, ["dream"], {
          stage: "dreamer",
          ability_id: ability.id,
          ...(attempt === 1 ? {} : { retry_attempt: attempt - 1, retry_max: 2 }),
        });
        if (!current()) {
          if (isRadiantEclipseBoard(ctx.world))
            throw new Error("radiant_eclipse_dream_scope_stale");
          break;
        }
        const action = await ctx.actionProvider.getAction(request);
        if (!current()) {
          if (isRadiantEclipseBoard(ctx.world))
            throw new Error("radiant_eclipse_dream_scope_stale");
          break;
        }
        if (action?.name !== "dream") {
          if (isRadiantEclipseBoard(ctx.world))
            throw new Error("radiant_eclipse_dream_action_missing");
          continue;
        }
        const validated = ctx.toolGateway.validateAndSanitize(ctx.world, actorId, action, {
          phase: Phase.Night,
          day,
          abilityId: ability.id,
        });
        if (!current()) {
          if (isRadiantEclipseBoard(ctx.world))
            throw new Error("radiant_eclipse_dream_scope_stale");
          break;
        }
        if (!validated.ok || validated.sanitizedCall?.name !== "dream") {
          if (isRadiantEclipseBoard(ctx.world))
            throw new Error("radiant_eclipse_dream_action_invalid");
          continue;
        }
        const targetId = validated.sanitizedCall.args.target_id,
          target = targets.get(targetId);
        if (
          !target ||
          ctx.world.getComponent(targetId, COMPONENT.Alive) !== target.life ||
          !target.life.alive ||
          target.version === undefined ||
          aliveLifeVersion(target.life) !== target.version
        )
          continue;
        const consecutive = state.lastDay === day - 1 && state.lastTarget === targetId;
        recordDreamSelection(state, targetId, day);
        recordNightAbilityUse(ability, day, true);
        markDreamNightCommitted(ctx.world, day);
        applied = true;
        ctx.state.dreamLinks.push({
          actorId,
          targetId,
          day,
          isCurrent: captureRadiantPaidEffect(ctx.world, day, actorId, ability, targetId),
          consecutive,
          protectionPolicy: state.protectionPolicy,
          actorLife,
          actorVersion,
          targetLife: target.life,
          targetVersion: target.version,
          ...(ability.source.kind === "native" ? {} : { abilityId: ability.id }),
        });
        ctx.events.push({
          timestamp: Date.now(),
          type: "dream_applied",
          payload: {
            actorId,
            targetId,
            day,
            consecutive,
            ...(ability.source.kind === "native" ? {} : { abilityId: ability.id }),
          },
        });
        break;
      }
      if (
        !applied &&
        current() &&
        [...targets].some(
          ([id, target]) =>
            ctx.world.getComponent(id, COMPONENT.Alive) === target.life &&
            target.life.alive &&
            target.version !== undefined &&
            aliveLifeVersion(target.life) === target.version,
        )
      )
        throw new Error("dream_required_action_missing");
    }
  },
};
