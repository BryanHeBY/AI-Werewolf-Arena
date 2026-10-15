/**
 * 负责在受影响的原生夜能力之前推进噩梦之影恐惧请求；输入是原 frame 与校验后的目标选择。
 * 输出为原恐惧提交和事件；Provider 等待前后及提交前按原顺序复验名单、日期与运行窗口。
 * 阻断资格仍由 frame 持有，不因模型拒绝、玩家状态形状或文案直接产生许可。
 */
import { COMPONENT } from "../../../../domain/components/names";
import type { RoleComponent } from "../../../../domain/components/role";
import { Phase } from "../../../../domain/identity";
import type { NightStageHandler } from "../../stages/night/contracts";
import { getNightmareShadowState } from "./state-slot";
import {
  assertNightmareRosterCurrent,
  beginNightmareNight,
  commitNightmareFear,
} from "./night_frame";

/** 原首次原生行动：恐惧成功提交之前不公开狼同伴知识；声明优先级不授予实际库存。 */
export const NIGHTMARE_FEAR_STAGE: NightStageHandler = {
  id: "nightmare_fear",
  priority: 90,
  async execute(ctx) {
    const day = ctx.currentDay();
    const actorId = beginNightmareNight(ctx.world, day);
    if (actorId === null) return;
    const role = ctx.world.getComponent(actorId, COMPONENT.Role);
    if (!getNightmareShadowState(role, () => ctx.world.getComponent(actorId, COMPONENT.Camp))) throw new Error("nightmare_fear_actor_invalid");
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
