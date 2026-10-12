/**
 * Runs the Magician exchange request before remapped night abilities. Inputs are the installed
 * night frame and validated pair selection; outputs are the original exchange event and
 * authority commit. The stage never applies target mapping eagerly through a prompt; the frame
 * supplies the later receipt.
 */
import { COMPONENT } from "../../../../core/domain/components/names";
import type { RoleComponent } from "../../../../core/domain/components/role";
import { Phase } from "../../../../core/domain/identity";
import type { NightStageHandler } from "../../stages/night/contracts";
import { getMagicianState } from "./state";
import {
  assertMagicianRosterCurrent,
  beginMagicianNight,
  commitMagicianExchange,
  magicianChoiceTargets,
} from "./night_frame";
/** Runs from the configured role set, including after the magician's death. */
export const MAGICIAN_EXCHANGE_STAGE: NightStageHandler = {
  id: "magician_exchange",
  priority: 80,
  async execute(ctx) {
    const day = ctx.currentDay(),
      actorId = beginMagicianNight(ctx.world, day);
    if (actorId === null) return;
    const role = ctx.world.getComponent(actorId, COMPONENT.Role);
    if (!getMagicianState(role)) throw new Error("magician_actor_invalid");
    const request = ctx.makeRequest(actorId, ["swap_targets"], {
      stage: "magician_exchange",
      requiresAction: true,
      action_failure_policy: "error",
      allow_fallback: false,
      swap_candidates: magicianChoiceTargets(ctx.world, day),
    });
    assertMagicianRosterCurrent(ctx.world);
    const action = await ctx.actionProvider.getAction(request);
    assertMagicianRosterCurrent(ctx.world);
    if (!ctx.isCurrent() || ctx.currentDay() !== day) throw new Error("magician_exchange_stale");
    if (action?.name !== "swap_targets") throw new Error("magician_exchange_action_missing");
    const validated = ctx.toolGateway.validateAndSanitize(ctx.world, actorId, action, {
      phase: Phase.Night,
      day,
    });
    assertMagicianRosterCurrent(ctx.world);
    if (!ctx.isCurrent() || ctx.currentDay() !== day) throw new Error("magician_exchange_stale");
    if (!validated.ok || validated.sanitizedCall?.name !== "swap_targets")
      throw new Error("magician_exchange_action_invalid");
    const args = validated.sanitizedCall.args;
    const pair: [number, number] | null = args.abstain ? null : [args.first_id!, args.second_id!];
    commitMagicianExchange(ctx.world, actorId, day, pair);
    ctx.events.push({
      timestamp: Date.now(),
      type: "magician_exchange_committed",
      payload: {
        actorId,
        day,
        pair: pair && [Math.min(pair[0], pair[1]), Math.max(pair[0], pair[1])],
      },
      audience: Object.freeze([actorId]),
    });
  },
};
