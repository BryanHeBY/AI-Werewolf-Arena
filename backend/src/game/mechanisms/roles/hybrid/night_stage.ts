/**
 * Executes Hybrid exemplar selection and records its actual night commitment. Inputs are the
 * current Hybrid body, candidates and validated tool; outputs are the chosen exemplar state and
 * corresponding facts. Selection never replaces the original role component or silently repeats
 * a completed choice.
 */
import type { HybridState } from "@ai-werewolf-arena/game-contract";
import { COMPONENT } from "../../../../core/domain/components/names";

import {
  createVictoryComponent,
  type VictoryComponent,
} from "../../../../core/domain/components/victory";
import { Camp, Phase, Role } from "../../../../core/domain/model";
import { captureNightLife, livingNightLife } from "../../../../core/domain/night_effects";
import type { World } from "../../../../core/domain/world";
import type { NightStageHandler } from "../../stages/night/contracts";
import { canChooseExemplar, getHybridState } from "./state";

const committed = new WeakMap<World, Set<number>>();
export function hasHybridNightCommit(world: World, day: number): boolean {
  return committed.get(world)?.has(day) ?? false;
}

export const HYBRID_STAGE: NightStageHandler = {
  id: "hybrid",
  priority: 110,
  async execute(ctx) {
    const day = ctx.currentDay();
    if (day !== 1) return;
    for (const actorId of ctx.getAliveByRole(Role.Hybrid)) {
      const role = ctx.world.getComponent(actorId, COMPONENT.Role)!;
      const state = getHybridState(role),
        life = captureNightLife(ctx.world, actorId);
      const victory = ctx.world.getComponent(actorId, COMPONENT.Victory);
      if (!state || !life || !victory || role.camp !== Camp.Good) continue;
      const privateState = role.privateState,
        affiliations = victory.affiliations;
      const current = () =>
        ctx.isCurrent() &&
        ctx.currentDay() === day &&
        ctx.world.getComponent(actorId, COMPONENT.Role) === role &&
        role.role === Role.Hybrid &&
        role.camp === Camp.Good &&
        role.privateState === privateState &&
        getHybridState(role) === state &&
        livingNightLife(ctx.world, life) &&
        ctx.world.getComponent(actorId, COMPONENT.Victory) === victory &&
        victory.affiliations === affiliations &&
        affiliations.length === 0 &&
        canChooseExemplar(state, day);
      if (!current()) continue;
      let completed = false;
      for (let attempt = 0; attempt < 3; attempt++) {
        if (!current()) break;
        const targets = new Map(
          ctx.world
            .getAliveEntityIds()
            .filter((id) => id !== actorId)
            .map((id) => {
              const targetRole = ctx.world.getComponent(id, COMPONENT.Role)!;
              return [
                id,
                {
                  life: captureNightLife(ctx.world, id)!,
                  role: targetRole,
                  kind: targetRole.role,
                  camp: targetRole.camp,
                  privateState: targetRole.privateState,
                },
              ] as const;
            }),
        );
        if (!targets.size) throw new Error("hybrid_valid_action_missing");
        const action = await ctx.actionProvider.getAction(
          ctx.makeRequest(actorId, ["choose_exemplar"], {
            stage: "hybrid",
            requiresAction: true,
            allow_fallback: false,
            ...(attempt ? { retry_attempt: attempt, retry_max: 2 } : {}),
          }),
        );
        if (!current()) break;
        if (action?.name !== "choose_exemplar") continue;
        const valid = ctx.toolGateway.validateAndSanitize(ctx.world, actorId, action, {
          phase: Phase.Night,
          day,
        });
        if (!current() || !valid.ok || valid.sanitizedCall?.name !== "choose_exemplar") continue;
        const targetId = valid.sanitizedCall.args.target_id,
          target = targets.get(targetId);
        if (
          !target ||
          !livingNightLife(ctx.world, target.life) ||
          ctx.world.getComponent(targetId, COMPONENT.Role) !== target.role ||
          target.role.role !== target.kind ||
          target.role.camp !== target.camp ||
          target.role.privateState !== target.privateState ||
          (target.camp !== Camp.Good && target.camp !== Camp.Wolf)
        )
          continue;
        const membership = createVictoryComponent([{ kind: "faction", faction: target.camp }]);
        // No await between the final checks and both owned writes. A second reply loses its original scope.
        (state as Pick<HybridState, "remaining">).remaining = 0;
        (state as Pick<HybridState, "choice">).choice = { day, targetId };
        ctx.world.addComponent(actorId, COMPONENT.Victory, membership);
        const days = committed.get(ctx.world) ?? new Set<number>();
        days.add(day);
        committed.set(ctx.world, days);
        ctx.events.push({
          timestamp: Date.now(),
          type: "hybrid_exemplar_chosen",
          payload: { actorId, day, targetId },
        });
        ctx.events.push({
          timestamp: Date.now(),
          type: "hybrid_affiliation_resolved",
          payload: { actorId, day, targetId, faction: target.camp },
        });
        completed = true;
        break;
      }
      if (!completed && current()) throw new Error("hybrid_valid_action_missing");
    }
  },
};
