import type { AliveComponent } from "../../../../core/domain/components/alive";
import { COMPONENT } from "../../../../core/domain/components/names";
import type { RoleComponent } from "../../../../core/domain/components/role";
import { Phase } from "../../../../core/domain/identity";
import type { NightStageHandler } from "../../stages/night/contracts";
import { getTimeConsortState } from "./state";
import {
  timeConsortActorId,
  assertTimeConsortRosterCurrent,
  beginTimeConsortNight,
  commitTimeConsortChoice,
  timeConsortChoiceTargets,
} from "./night_frame";
/** Runs from the configured role set, including after the time_consort's death. */
export const TIME_CONSORT_LOCK_STAGE: NightStageHandler = {
  id: "time_consort_lock",
  priority: 50,
  async execute(ctx) {
    const day = ctx.currentDay(),
      actorId = beginTimeConsortNight(ctx.world, day);
    if (actorId === null) {
      const id = timeConsortActorId(ctx.world);
      if (id === null) throw new Error("time_consort_actor_missing");
      const reason = ctx.world.getComponent<AliveComponent>(id, COMPONENT.Alive)!.alive
        ? "exhausted"
        : "dead";
      ctx.events.push({
        timestamp: Date.now(),
        type: "time_consort_lock_skipped",
        payload: { actorId: id, day, reason },
        audience: Object.freeze([id]),
      });
      return;
    }
    const role = ctx.world.getComponent<RoleComponent>(actorId, COMPONENT.Role);
    if (!getTimeConsortState(role)) throw new Error("time_consort_actor_invalid");
    const request = ctx.makeRequest(actorId, ["lock_time"], {
      stage: "time_consort_lock",
      requiresAction: true,
      action_failure_policy: "error",
      allow_fallback: false,
      consort_candidates: timeConsortChoiceTargets(ctx.world, day),
    });
    assertTimeConsortRosterCurrent(ctx.world);
    const action = await ctx.actionProvider.getAction(request);
    assertTimeConsortRosterCurrent(ctx.world);
    if (!ctx.isCurrent() || ctx.currentDay() !== day) throw new Error("time_consort_lock_stale");
    if (action?.name !== "lock_time") throw new Error("time_consort_lock_action_missing");
    const validated = ctx.toolGateway.validateAndSanitize(ctx.world, actorId, action, {
      phase: Phase.Night,
      day,
    });
    assertTimeConsortRosterCurrent(ctx.world);
    if (!ctx.isCurrent() || ctx.currentDay() !== day) throw new Error("time_consort_lock_stale");
    if (!validated.ok || validated.sanitizedCall?.name !== "lock_time")
      throw new Error("time_consort_lock_action_invalid");
    const args = validated.sanitizedCall.args;
    const targetId = args.abstain ? null : args.target_id!;
    commitTimeConsortChoice(ctx.world, actorId, day, targetId);
    ctx.events.push({
      timestamp: Date.now(),
      type: "time_consort_lock_committed",
      payload: {
        actorId,
        day,
        targetId,
      },
      audience: Object.freeze([actorId]),
    });
  },
};
