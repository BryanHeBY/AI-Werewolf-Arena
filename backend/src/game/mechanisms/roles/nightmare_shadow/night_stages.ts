/**
 * Runs the Nightmare fear request before affected native night abilities. Inputs are the
 * captured Nightmare frame and validated fear target; outputs are the committed fear choice and
 * event. Blocking predicates remain in the frame and never arise merely from a model refusal.
 */
import { COMPONENT } from "../../../../core/domain/components/names";
import type { RoleComponent } from "../../../../core/domain/components/role";
import { Phase } from "../../../../core/domain/identity";
import type { NightStageHandler } from "../../stages/night/contracts";
import { getNightmareShadowState } from "./state";
import {
  assertNightmareRosterCurrent,
  beginNightmareNight,
  commitNightmareFear,
} from "./night_frame";

/** First native action: no pack identity may be exposed before this commits. */
export const NIGHTMARE_FEAR_STAGE: NightStageHandler = {
  id: "nightmare_fear",
  priority: 90,
  async execute(ctx) {
    const day = ctx.currentDay();
    const actorId = beginNightmareNight(ctx.world, day);
    if (actorId === null) return;
    const role = ctx.world.getComponent(actorId, COMPONENT.Role);
    if (!getNightmareShadowState(role)) throw new Error("nightmare_fear_actor_invalid");
    const request = ctx.makeRequest(actorId, ["fear"], {
      stage: "nightmare_fear",
      requiresAction: true,
      action_failure_policy: "error",
      allow_fallback: false,
    });
    assertNightmareRosterCurrent(ctx.world);
    const action = await ctx.actionProvider.getAction(request);
    assertNightmareRosterCurrent(ctx.world);
    if (!ctx.isCurrent() || ctx.currentDay() !== day) throw new Error("nightmare_fear_stale");
    if (action?.name !== "fear") throw new Error("nightmare_fear_action_missing");
    const args = action.args;
    if (
      !args ||
      typeof args.abstain !== "boolean" ||
      (args.abstain
        ? args.target_id !== null
        : typeof args.target_id !== "number" || !Number.isSafeInteger(args.target_id))
    )
      throw new Error("nightmare_fear_action_invalid");
    const validated = ctx.toolGateway.validateAndSanitize(ctx.world, actorId, action, {
      phase: Phase.Night,
      day,
    });
    assertNightmareRosterCurrent(ctx.world);
    if (!ctx.isCurrent() || ctx.currentDay() !== day) throw new Error("nightmare_fear_stale");
    if (!validated.ok || validated.sanitizedCall?.name !== "fear")
      throw new Error("nightmare_fear_action_invalid");
    const targetId = validated.sanitizedCall.args.target_id;
    commitNightmareFear(ctx.world, actorId, day, targetId);
    ctx.events.push({
      timestamp: Date.now(),
      type: "nightmare_fear_committed",
      payload: { actorId, day, targetId },
      audience: Object.freeze([actorId]),
    });
  },
};
