/**
 * 负责诡术师夜间配对请求、原 current／名单复验及交换／抵消事实。输入为真实 frame、跳过政策和已校验选择；
 * 输出保原 provider await 后的提交与事实顺序，阶段仍为 priority=100。当前请求只提供候选，许可归 frame／gateway。
 * 先提交历史再发布事实，再与魔术师同配对抵消；抵消不退已用号码，放逐替换仍归 frame 而非 provider。
 */
import { COMPONENT, type RoleComponent, type AliveComponent } from "../../../../core";
import { Phase } from "../../../../core/domain/identity";
import type { NightStageHandler } from "../../stages/night/contracts";
import { getTricksterState } from "./state-slot";
import {
  assertTricksterRosterCurrent,
  beginTricksterNight,
  commitTricksterExchange,
  tricksterChoiceTargets,
  tricksterMayPass,
  tricksterActorId,
  cancelTricksterExchange,
} from "./night_frame";
import { cancelMagicianExchangeIfMatching } from "../magician/exchange-ports";
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
    // 原历史与事实已提交后才查询并取消对方；晚读取／取消抛错保此前前缀，本方取消仍在 true 后。
    if (pair && cancelMagicianExchangeIfMatching(ctx.world, day, pair))
      cancelTricksterExchange(ctx.world, day);
  },
};
