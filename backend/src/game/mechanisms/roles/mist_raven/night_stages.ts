/**
 * 负责炼金魔女雾选择及狼鸦之爪额外刀的真实阶段。输入为当前 frame、候选和工具回复；
 * 输出为原提交及带来源刀口。请求前后、gateway 后保持原阵容与阶段复验，提交先于本人事实。
 * 这里不结算已交接伤害，也不接管较晚蛇窗；晚事实抛错保留已经消费／记录的选择。
 */
import type { NightStageHandler } from "../../stages/night/contracts";
import { COMPONENT } from "../../../../domain/components/names";
import { Phase } from "../../../../domain/identity";
import type { RoleComponent } from "../../../../domain/components/role";
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
        (
          ctx.world.getComponent(actorId, COMPONENT.Role) as
            { readonly privateState: { readonly alchemist?: unknown } } | undefined
        )?.privateState.alchemist,
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
    // 先提交选择／历史（含不耗库存的空选）；之后重读state与push失败不撤回雾选择或补库存。
    commitMistChoice(ctx.world, day, result.sanitizedCall.args.target_ids);
    const state = readAlchemistState(
      (
        ctx.world.getComponent(actorId, COMPONENT.Role)!.privateState as {
          readonly alchemist?: unknown;
        }
      ).alchemist,
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
        (
          ctx.world.getComponent(actorId, COMPONENT.Role) as
            { readonly privateState: { readonly ravenClaw?: unknown } } | undefined
        )?.privateState.ravenClaw,
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
