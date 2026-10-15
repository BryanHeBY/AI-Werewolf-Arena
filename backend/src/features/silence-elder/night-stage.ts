/**
 * 负责禁言长老的独立夜间请求与付款。输入为可信夜运行，输出本人选择事实和实际交付结果。
 * 每次等待及网关回调后核原 World／阶段／生命／状态和最早期限，合法候选不等于已经付款。
 * 已付后才完成 true；未付退出关闭 false，关闭异常不覆盖原业务错误，也不回滚历史前缀。
 */
import { Phase, Role } from "@ai-werewolf-arena/game-contract";
import { SILENCE_ELDER_POLICY } from "@ai-werewolf-arena/game-contract/facts/silence-elder";
import { RequestLease, type RequestLeaseTurn } from "../../domain/request-lease";
import type { TrustedNightStageHandler } from "../../engine/night/trusted-runtime";
import {
  openSilenceNight,
  closeSilenceNight,
  silenceNightCurrent,
  silenceCandidates,
  commitSilenceChoice,
} from "./authority";

/** 仅原请求持有，不能从context重建；current晚查领域及运行阶段，原异常直接传播。 */
interface NightRequestScope {
  actorId: number;
  day: number;
  current(): boolean;
}
const requests = RequestLease.window<NightRequestScope>(
  {
    actorId: (s) => s.actorId,
    day: (s) => s.day,
    phase: () => Phase.Night,
    stage: () => "silence_elder",
    current: (s) => s.current(),
  },
  170,
  ["silence_candidates", "action_failure_policy", "allow_fallback"],
);

export const SILENCE_ELDER_NIGHT_STAGE: TrustedNightStageHandler = {
  id: "silence_elder",
  priority: 5,
  async execute(ctx) {
    const actors = ctx.getAliveByRole(Role.SilenceElder);
    if (actors.length === 0) return;
    if (actors.length !== 1) throw new Error("silence_actor_count_invalid");
    const actorId = actors[0]!,
      day = ctx.currentDay();
    openSilenceNight(ctx.world, actorId, day);
    const current = () =>
      ctx.isCurrent() && ctx.currentDay() === day && silenceNightCurrent(ctx.world, actorId, day);
    let delivery: RequestLeaseTurn | undefined;
    let failed = false;
    try {
      const request = ctx.makeRequest(actorId, ["silence"], {
        stage: "silence_elder",
        requiresAction: true,
        action_failure_policy: "error",
        allow_fallback: false,
        silence_candidates: silenceCandidates(ctx.world, actorId, day),
      });
      const scope = { actorId, day, current };
      requests.bind(scope, request);
      delivery = requests.openDelivery(scope, request);
      if (!delivery?.current()) throw new Error("silence_request_revoked");
      const action = await ctx.actionProvider.getAction(request);
      if (!delivery.current()) throw new Error("silence_request_revoked");
      if (action?.name !== "silence") throw new Error("silence_action_missing");
      const result = ctx.toolGateway.validateAndSanitize(ctx.world, actorId, action, {
        phase: Phase.Night,
        day,
      });
      if (!delivery.current()) throw new Error("silence_request_revoked");
      if (!result.ok || result.sanitizedCall?.name !== "silence")
        throw new Error("silence_action_invalid");
      const { target_id: targetId, translator_id: translatorId } = result.sanitizedCall.args;
      commitSilenceChoice(ctx.world, actorId, day, targetId, translatorId, () =>
        delivery!.current(),
      );
      delivery.complete();
      ctx.events.push({
        timestamp: Date.now(),
        type: "silence_chosen",
        payload: { policy: SILENCE_ELDER_POLICY, actorId, day, targetId, translatorId },
        audience: Object.freeze([actorId]),
      });
    } catch (error) {
      failed = true;
      throw error;
    } finally {
      closeSilenceNight(ctx.world);
      try {
        delivery?.close();
      } catch (error) {
        if (!failed) throw error;
      }
    }
  },
};
export const OWNED_NIGHT_STAGE_PROGRAMS = Object.freeze([
  [SILENCE_ELDER_NIGHT_STAGE, SILENCE_ELDER_NIGHT_STAGE.execute] as const,
]);
