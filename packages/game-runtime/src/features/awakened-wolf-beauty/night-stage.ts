/**
 * 负责真实开夜先过期关系、狼刀后再收觉醒魅惑。输入可信夜上下文，输出已付选择与本人私有事实；
 * N2冷却没有Provider请求，null只明确空过，不消费替死。租约230与原body/夜号共同守卫，
 * 每次await和字段读取后末核再提交；付款／true通知之后的记录失败保留真实前缀，关闭不重开夜窗。
 */
import { Phase, Role, type ActionRequest, type ToolCall } from "@ai-werewolf-arena/game-contract";
import { AWAKENED_BEAUTY_POLICY } from "@ai-werewolf-arena/game-contract/facts/awakened-beauty";
import { RequestLease, type RequestLeaseTurn } from "../../domain/request-lease";
import type { TrustedNightStageHandler } from "../../engine/night/trusted-runtime";
import {
  prepareAwakenedBeautyNight,
  openAwakenedCharm,
  awakenedCharmCurrent,
  awakenedCharmCandidates,
  payAwakenedCharm,
  closeAwakenedCharm,
} from "./authority";
interface Scope {
  actorId: number;
  day: number;
  current(): boolean;
}
const requests = RequestLease.window<Scope>(
  {
    actorId: (s) => s.actorId,
    day: (s) => s.day,
    phase: () => Phase.Night,
    stage: () => "awakened_charm",
    current: (s) => s.current(),
  },
  230,
  ["awakened_charm_candidates", "action_failure_policy", "allow_fallback"],
);
export const AWAKENED_BEAUTY_PREPARE_STAGE: TrustedNightStageHandler = {
  id: "awakened_beauty_prepare",
  priority: 50,
  async execute(ctx) {
    const day = ctx.currentDay(),
      actors = ctx.getAliveByRole(Role.AwakenedWolfBeauty);
    if (actors.length > 1) throw new Error("awakened_beauty_actor_count_invalid");
    prepareAwakenedBeautyNight(
      ctx.world,
      actors[0] ?? null,
      day,
      () => ctx.isCurrent() && ctx.currentDay() === day,
    );
  },
};
export const AWAKENED_CHARM_STAGE: TrustedNightStageHandler = {
  id: "awakened_charm",
  priority: 450,
  async execute(ctx) {
    const day = ctx.currentDay(),
      actors = ctx.getAliveByRole(Role.AwakenedWolfBeauty);
    if (!actors.length) return;
    if (actors.length !== 1) throw new Error("awakened_beauty_actor_count_invalid");
    const actorId = actors[0]!;
    if (!openAwakenedCharm(ctx.world, actorId, day)) return;
    let failed = false;
    let delivery: RequestLeaseTurn | undefined;
    try {
      const request = ctx.makeRequest(actorId, ["awakened_charm"], {
        stage: "awakened_charm",
        requiresAction: true,
        action_failure_policy: "error",
        allow_fallback: false,
        awakened_charm_candidates: awakenedCharmCandidates(ctx.world, actorId, day),
      });
      const scope: Scope = {
        actorId,
        day,
        current: () =>
          ctx.isCurrent() &&
          ctx.currentDay() === day &&
          awakenedCharmCurrent(ctx.world, actorId, day),
      };
      requests.bind(scope, request);
      delivery = requests.openDelivery(scope, request);
      const provider = ctx.actionProvider,
        getAction = provider.getAction,
        args: [ActionRequest] = [request],
        invoke = Reflect.apply.bind(Reflect);
      if (!delivery?.current()) throw new Error("awakened_charm_request_revoked");
      const action = (await invoke(getAction, provider, args)) as ToolCall | null;
      if (!delivery.current()) throw new Error("awakened_charm_request_revoked");
      if (action?.name !== "awakened_charm") throw new Error("awakened_charm_action_missing");
      const result = ctx.toolGateway.validateAndSanitize(ctx.world, actorId, action, {
        phase: Phase.Night,
        day,
      });
      if (!delivery.current()) throw new Error("awakened_charm_request_revoked");
      if (!result.ok || result.sanitizedCall?.name !== "awakened_charm")
        throw new Error("awakened_charm_action_invalid");
      const targetId = result.sanitizedCall.args.target_id;
      payAwakenedCharm(ctx.world, actorId, day, targetId, () => delivery!.current());
      delivery.complete();
      ctx.events.push({
        timestamp: Date.now(),
        type: "awakened_charm_chosen",
        payload: {
          policy: AWAKENED_BEAUTY_POLICY,
          day,
          actorId,
          targetId,
          nextAllowedNight: day + (targetId === null ? 1 : 2),
        },
        audience: Object.freeze([actorId]),
      });
    } catch (error) {
      failed = true;
      throw error;
    } finally {
      closeAwakenedCharm(ctx.world, actorId, day);
      try {
        delivery?.close();
      } catch (error) {
        if (!failed) throw error;
      }
    }
  },
};
export const OWNED_NIGHT_STAGE_PROGRAMS = Object.freeze([
  [AWAKENED_BEAUTY_PREPARE_STAGE, AWAKENED_BEAUTY_PREPARE_STAGE.execute] as const,
  [AWAKENED_CHARM_STAGE, AWAKENED_CHARM_STAGE.execute] as const,
]);
