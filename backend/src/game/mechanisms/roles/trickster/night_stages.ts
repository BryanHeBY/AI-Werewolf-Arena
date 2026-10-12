/**
 * Runs the Trickster paired-exchange request before subsequent night actions. Inputs are the
 * bound frame, policy pass allowance and validated choice; outputs preserve its exchange or
 * cancellation evidence. Exile substitution remains frame-owned and is not performed by the
 * provider.
 */
import { COMPONENT, type RoleComponent, type AliveComponent } from "../../../../core";
import { Phase } from "../../../../core/domain/identity";
import type { NightStageHandler } from "../../stages/night/contracts";
import { getTricksterState } from "./state";
import {
  assertTricksterRosterCurrent,
  beginTricksterNight,
  commitTricksterExchange,
  tricksterChoiceTargets,
  tricksterMayPass,
  tricksterActorId,
  cancelTricksterExchange,
} from "./night_frame";
import { cancelMagicianExchangeIfMatching } from "../magician/night_frame";
export const TRICKSTER_EXCHANGE_STAGE: NightStageHandler = {
  id: "trickster_exchange",
  priority: 100,
  async execute(ctx) {
    const day = ctx.currentDay(),
      actorId = beginTricksterNight(ctx.world, day);
    if (actorId === null) {
      const id = tricksterActorId(ctx.world);
      ctx.events.push({
        timestamp: Date.now(),
        type: "trickster_exchange_skipped",
        payload: {
          actorId: id,
          day,
          reason: ctx.world.getComponent(id, COMPONENT.Alive)!.alive ? "exhausted" : "dead",
        },
        audience: Object.freeze([id]),
      });
      return;
    }
    const role = ctx.world.getComponent(actorId, COMPONENT.Role);
    if (!getTricksterState(role)) throw new Error("trickster_actor_invalid");
    const request = ctx.makeRequest(actorId, ["swap_exile_targets"], {
      stage: "trickster_exchange",
      requiresAction: true,
      action_failure_policy: "error",
      allow_fallback: false,
      trickster_candidates: tricksterChoiceTargets(ctx.world, day),
      trickster_may_pass: tricksterMayPass(ctx.world, day),
    });
    assertTricksterRosterCurrent(ctx.world);
    const action = await ctx.actionProvider.getAction(request);
    assertTricksterRosterCurrent(ctx.world);
    if (!ctx.isCurrent() || ctx.currentDay() !== day) throw new Error("trickster_exchange_stale");
    if (action?.name !== "swap_exile_targets") throw new Error("trickster_exchange_action_missing");
    const validated = ctx.toolGateway.validateAndSanitize(ctx.world, actorId, action, {
      phase: Phase.Night,
      day,
    });
    assertTricksterRosterCurrent(ctx.world);
    if (!ctx.isCurrent() || ctx.currentDay() !== day) throw new Error("trickster_exchange_stale");
    if (!validated.ok || validated.sanitizedCall?.name !== "swap_exile_targets")
      throw new Error("trickster_exchange_action_invalid");
    const args = validated.sanitizedCall.args,
      pair: [number, number] | null = args.abstain ? null : [args.first_id!, args.second_id!];
    commitTricksterExchange(ctx.world, actorId, day, pair);
    ctx.events.push({
      timestamp: Date.now(),
      type: "trickster_exchange_committed",
      payload: { actorId, day, pair: pair && [Math.min(...pair), Math.max(...pair)] },
      audience: Object.freeze([actorId]),
    });
    if (pair && cancelMagicianExchangeIfMatching(ctx.world, day, pair))
      cancelTricksterExchange(ctx.world, day);
  },
};
