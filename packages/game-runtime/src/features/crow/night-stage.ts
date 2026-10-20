/**
 * 负责乌鸦独立夜阶段的真实请求、等待、网关复验及提交，输出仅为已付私有选择事实。
 * 输入是可信夜运行上下文，RequestLease持原请求/合法别名/最早期限；本族权威持原体和候选生命。
 * 每次await及首语义写之前必须复验，未知错误原样传播；付款后才完成true，未付退出关闭false。
 * finally关闭不会撤销历史或已付目标，消息和可见候选不授予行动权限。
 */
import { RequestLease, type RequestLeaseTurn } from "../../domain/request-lease";
import { Phase, Role } from "@ai-werewolf-arena/game-contract";
import type { TrustedNightStageHandler } from "../../engine/night/trusted-runtime";
import {
  assertCrowCurrent,
  openCrowNight,
  closeCrowNight,
  crowCandidates,
  commitCrowChoice,
} from "./authority";
/** 每个原请求独有的运行scope；只传给租约，不进入Agent上下文或录制。
 * current晚查原生命、状态、阶段和日次，未知callee错误原样传播，租约负责永久关闭和最早预算。 */
interface CrowRequestScope {
  actorId: number;
  day: number;
  current(): boolean;
}
const requests = RequestLease.window<CrowRequestScope>(
  {
    actorId: (s) => s.actorId,
    day: (s) => s.day,
    phase: () => Phase.Night,
    stage: () => "crow_curse",
    current: (s) => s.current(),
  },
  160,
  ["crow_candidates", "action_failure_policy", "allow_fallback", "requiresAction"],
);
export const CROW_NIGHT_STAGE: TrustedNightStageHandler = {
  id: "crow_curse",
  priority: 750,
  async execute(ctx) {
    const actors = ctx.getAliveByRole(Role.Crow);
    if (actors.length === 0) return;
    if (actors.length !== 1) throw new Error("crow_actor_count_invalid");
    const actorId = actors[0]!,
      day = ctx.currentDay();
    openCrowNight(ctx.world, actorId, day);
    const check = () => {
      assertCrowCurrent(ctx.world, actorId, day);
      if (!ctx.isCurrent() || ctx.currentDay() !== day) throw new Error("crow_night_stale");
    };
    let delivery: RequestLeaseTurn | undefined;
    let failed = false;
    try {
      const request = ctx.makeRequest(actorId, ["curse_exile"], {
        stage: "crow_curse",
        requiresAction: true,
        action_failure_policy: "error",
        allow_fallback: false,
        crow_candidates: crowCandidates(ctx.world, actorId, day),
      });
      const scope: CrowRequestScope = {
        actorId,
        day,
        current: () => {
          check();
          return true;
        },
      };
      requests.bind(scope, request);
      delivery = requests.openDelivery(scope, request);
      if (!delivery || !delivery.current()) throw new Error("crow_request_revoked");
      const action = await ctx.actionProvider.getAction(request);
      if (!delivery.current()) throw new Error("crow_request_revoked");
      check();
      if (action?.name !== "curse_exile") throw new Error("crow_action_missing");
      const validated = ctx.toolGateway.validateAndSanitize(ctx.world, actorId, action, {
        phase: Phase.Night,
        day,
      });
      check();
      if (!validated.ok || validated.sanitizedCall?.name !== "curse_exile")
        throw new Error("crow_action_invalid");
      const targetId = validated.sanitizedCall.args.target_id;
      commitCrowChoice(ctx.world, actorId, day, targetId, () => delivery!.current());
      // 领域历史和已付目标均已落定才通知true；通知/事实晚异常不撤销已付前缀。
      delivery.complete();
      ctx.events.push({
        timestamp: Date.now(),
        type: "crow_curse_chosen",
        payload: { actorId, day, targetId },
        audience: Object.freeze([actorId]),
      });
    } catch (error) {
      failed = true;
      throw error;
    } finally {
      closeCrowNight(ctx.world);
      try {
        delivery?.close();
      } catch (error) {
        if (!failed) throw error;
      }
    }
  },
};
export const OWNED_NIGHT_STAGE_PROGRAMS = Object.freeze([
  [CROW_NIGHT_STAGE, CROW_NIGHT_STAGE.execute] as const,
]);
