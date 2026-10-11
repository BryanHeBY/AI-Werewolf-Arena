import type { NightStageHandler } from "../../stages/night/contracts";
import { COMPONENT } from "../../../../core/domain/components/names";
import { Phase } from "../../../../core/domain/identity";
import type { RoleComponent } from "../../../../core/domain/components/role";
import {
  assertMistRosterCurrent,
  mistCasterId,
  mistChoiceTargets,
  commitMistChoice,
  ravenKnifeTargets,
  commitRavenKnife,
} from "./night_frame";
import { readAlchemistState, readRavenState } from "./state";

export const ALCHEMIST_MIST_STAGE: NightStageHandler = {
  id: "alchemist_mist",
  priority: 50,
  async execute(ctx) {
    const day = ctx.currentDay(),
      actorId = mistCasterId(ctx.world, "alchemist"),
      candidates = mistChoiceTargets(ctx.world, day);
    if (candidates.length < 3) {
      const state = readAlchemistState(
        ctx.world.getComponent<RoleComponent>(actorId, COMPONENT.Role)?.privateState.alchemist,
      );
      const reason = !ctx.world.getAliveEntityIds().includes(actorId)
        ? "dead"
        : state?.mistRemaining === 0
          ? "spent"
          : "no_targets";
      ctx.events.push({
        timestamp: Date.now(),
        type: "alchemist_mist_skipped",
        payload: { actorId, day, reason },
        audience: Object.freeze([actorId]),
      });
      return;
    }
    const request = ctx.makeRequest(actorId, ["cast_mist"], {
      stage: "alchemist_mist",
      requiresAction: true,
      allow_fallback: false,
      action_failure_policy: "error",
      mist_candidates: candidates,
    });
    assertMistRosterCurrent(ctx.world);
    const action = await ctx.actionProvider.getAction(request);
    assertMistRosterCurrent(ctx.world);
    if (!ctx.isCurrent() || ctx.currentDay() !== day) throw new Error("mist_choice_stale");
    if (action?.name !== "cast_mist") throw new Error("mist_choice_action_missing");
    const result = ctx.toolGateway.validateAndSanitize(ctx.world, actorId, action, {
      phase: Phase.Night,
      day,
    });
    assertMistRosterCurrent(ctx.world);
    if (!ctx.isCurrent() || !result.ok || result.sanitizedCall?.name !== "cast_mist")
      throw new Error("mist_choice_action_invalid");
    commitMistChoice(ctx.world, day, result.sanitizedCall.args.target_ids);
    const state = readAlchemistState(
      ctx.world.getComponent<RoleComponent>(actorId, COMPONENT.Role)!.privateState.alchemist,
    )!;
    ctx.events.push({
      timestamp: Date.now(),
      type: "alchemist_mist_chosen",
      payload: { actorId, day, targetIds: state.mistHistory.at(-1)!.targetIds },
      audience: Object.freeze([actorId]),
    });
  },
};
export const RAVEN_KNIFE_STAGE: NightStageHandler = {
  id: "raven_knife",
  priority: 450,
  async execute(ctx) {
    const day = ctx.currentDay(),
      actorId = mistCasterId(ctx.world, "raven_claw_wolf"),
      candidates = ravenKnifeTargets(ctx.world, day);
    if (!candidates.length) {
      const state = readRavenState(
        ctx.world.getComponent<RoleComponent>(actorId, COMPONENT.Role)?.privateState.ravenClaw,
      );
      const reason = !ctx.world.getAliveEntityIds().includes(actorId)
        ? "dead"
        : state?.awakenedDay === null
          ? "sealed"
          : state?.extraRemaining === 0
            ? "spent"
            : "no_targets";
      ctx.events.push({
        timestamp: Date.now(),
        type: "raven_knife_skipped",
        payload: { actorId, day, reason },
        audience: Object.freeze([actorId]),
      });
      return;
    }
    const request = ctx.makeRequest(actorId, ["raven_knife"], {
      stage: "raven_knife",
      requiresAction: true,
      allow_fallback: false,
      action_failure_policy: "error",
      raven_candidates: candidates,
    });
    assertMistRosterCurrent(ctx.world);
    const action = await ctx.actionProvider.getAction(request);
    assertMistRosterCurrent(ctx.world);
    if (!ctx.isCurrent() || ctx.currentDay() !== day) throw new Error("raven_knife_stale");
    if (action?.name !== "raven_knife") throw new Error("raven_knife_action_missing");
    const result = ctx.toolGateway.validateAndSanitize(ctx.world, actorId, action, {
      phase: Phase.Night,
      day,
    });
    assertMistRosterCurrent(ctx.world);
    if (!ctx.isCurrent() || !result.ok || result.sanitizedCall?.name !== "raven_knife")
      throw new Error("raven_knife_action_invalid");
    commitRavenKnife(ctx.world, day, result.sanitizedCall.args.target_id);
    ctx.events.push({
      timestamp: Date.now(),
      type: "raven_knife_chosen",
      payload: { actorId, day, targetId: result.sanitizedCall.args.target_id },
      audience: Object.freeze([actorId]),
    });
  },
};
