import type { AliveComponent } from "../../../../core/domain/components/alive";
import { COMPONENT } from "../../../../core/domain/components/names";
import type { RoleComponent } from "../../../../core/domain/components/role";
import { Phase } from "../../../../core/domain/identity";
import type { NightStageHandler } from "../../stages/night/contracts";
import { getWolfSorcererState } from "./state";
import {
  wolfSorcererActorId,
  assertWolfSorcererRosterCurrent,
  beginWolfSorcererNight,
  commitWolfSorcererExchange,
  wolfSorcererChoiceTargets,
} from "./night_frame";
/** Runs from the configured role set, including after the wolf_sorcerer's death. */
export const WOLF_SORCERER_EXCHANGE_STAGE: NightStageHandler = {
  id: "wolf_sorcerer_exchange",
  priority: 100,
  async execute(ctx) {
    const day = ctx.currentDay(),
      actorId = beginWolfSorcererNight(ctx.world, day);
    if (actorId === null) {
      const id = wolfSorcererActorId(ctx.world),
        own = ctx.world.getComponent<RoleComponent>(id, COMPONENT.Role);
      const state = getWolfSorcererState(own)!;
      const reason =
        day < state.firstNight
          ? "not_started"
          : ctx.world.getComponent<AliveComponent>(id, COMPONENT.Alive)!.alive
            ? "exhausted"
            : "dead";
      ctx.events.push({
        timestamp: Date.now(),
        type: "wolf_sorcerer_exchange_skipped",
        payload: { actorId: id, day, reason },
        audience: Object.freeze([id]),
      });
      return;
    }
    const role = ctx.world.getComponent<RoleComponent>(actorId, COMPONENT.Role);
    if (!getWolfSorcererState(role)) throw new Error("wolf_sorcerer_actor_invalid");
    const request = ctx.makeRequest(actorId, ["swap_night_seats"], {
      stage: "wolf_sorcerer_exchange",
      requiresAction: true,
      action_failure_policy: "error",
      allow_fallback: false,
      sorcerer_candidates: wolfSorcererChoiceTargets(ctx.world, day),
    });
    assertWolfSorcererRosterCurrent(ctx.world);
    const action = await ctx.actionProvider.getAction(request);
    assertWolfSorcererRosterCurrent(ctx.world);
    if (!ctx.isCurrent() || ctx.currentDay() !== day)
      throw new Error("wolf_sorcerer_exchange_stale");
    if (action?.name !== "swap_night_seats")
      throw new Error("wolf_sorcerer_exchange_action_missing");
    const validated = ctx.toolGateway.validateAndSanitize(ctx.world, actorId, action, {
      phase: Phase.Night,
      day,
    });
    assertWolfSorcererRosterCurrent(ctx.world);
    if (!ctx.isCurrent() || ctx.currentDay() !== day)
      throw new Error("wolf_sorcerer_exchange_stale");
    if (!validated.ok || validated.sanitizedCall?.name !== "swap_night_seats")
      throw new Error("wolf_sorcerer_exchange_action_invalid");
    const args = validated.sanitizedCall.args;
    const pair: [number, number] | null = args.abstain ? null : [args.first_id!, args.second_id!];
    commitWolfSorcererExchange(ctx.world, actorId, day, pair);
    ctx.events.push({
      timestamp: Date.now(),
      type: "wolf_sorcerer_exchange_committed",
      payload: {
        actorId,
        day,
        pair: pair && [Math.min(pair[0], pair[1]), Math.max(pair[0], pair[1])],
      },
      audience: Object.freeze([actorId]),
    });
  },
};
