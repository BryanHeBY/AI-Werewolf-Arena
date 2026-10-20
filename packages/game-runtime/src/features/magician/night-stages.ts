/**
 * 负责在被映射的夜间行动之前请求魔术师交换；输入为已安装 frame、原请求和经预检的二人选择。
 * 输出为原交换提交及本人私有事实；等待前后仍复核原体／阶段／日次，不把提示候选当成付款或许可。
 * 数据校验归本族 state-slot，关系／窗口归 frame；本阶段保持先 commit 后发布的失败前缀，
 * 不提前通过提示执行目标映射，后续行动仍取得原映射回执。
 */
import { COMPONENT } from "../../domain/components/names";
import type { RoleComponent } from "../../domain/components/role";
import { Phase } from "../../domain/identity";
import type { TrustedNightStageHandler as NightStageHandler } from "../../engine/night/trusted-runtime";
import { getMagicianState } from "./state-slot";
import {
  assertMagicianRosterCurrent,
  beginMagicianNight,
  commitMagicianExchange,
  magicianChoiceTargets,
} from "./night-frame";
/** 按板子已配置角色集运行，包括魔术师已死亡时的原开夜路径；是否出请求仍由 frame 判断。 */
export const MAGICIAN_EXCHANGE_STAGE: NightStageHandler = {
  id: "magician_exchange",
  priority: 80,
  async execute(ctx) {
    const day = ctx.currentDay(),
      actorId = beginMagicianNight(ctx.world, day);
    if (actorId === null) return;
    const role = ctx.world.getComponent(actorId, COMPONENT.Role);
    if (!getMagicianState(role, () => ctx.world.getComponent(actorId, COMPONENT.Camp)))
      throw new Error("magician_actor_invalid");
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

/** 模块定义完成时固定完整原程序引用；后来替换 execute 不能借原 handler 对象取得私有输入。这里不持有运行 World。 */
export const OWNED_NIGHT_STAGE_PROGRAMS = Object.freeze(
  [MAGICIAN_EXCHANGE_STAGE].map((handler) => Object.freeze([handler, handler.execute] as const)),
);
