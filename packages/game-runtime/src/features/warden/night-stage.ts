/**
 * 负责次夜起秘密pair和双方独立请求。输入是可信夜运行，输出已付历史与按pair顺序发表的秘密回执。
 * 两人的请求先冻结再同时等待，各有真实租约和期限；先返回的一方立即付款，另一方失败不退款。
 * Provider／网关异常原样保留，close只终结未付交付，事实或true通知晚失败不撤回真实前缀。
 */
import { Phase, Role, type ActionRequest, type ToolCall } from "@ai-werewolf-arena/game-contract";
import { WARDEN_POLICY, type WardenDecision } from "@ai-werewolf-arena/game-contract/facts/warden";
import { RequestLease, type RequestLeaseTurn } from "../../domain/request-lease";
import type {
  TrustedNightStageHandler,
  TrustedNightStageRuntime,
} from "../../engine/night/trusted-runtime";
import {
  openWardenNight,
  closeWardenNight,
  wardenNightCurrent,
  wardenCandidates,
  commitWardenPair,
  wardenDecisionCurrent,
  wardenPartner,
  commitWardenDecision,
  wardenOutcome,
} from "./authority";
import { bindWardenNightState, bindWardenNativeRuntime } from "./ports";
interface Scope {
  actorId: number;
  day: number;
  current(): boolean;
}
const pairRequests = RequestLease.window<Scope>(
  {
    actorId: (s) => s.actorId,
    day: (s) => s.day,
    phase: () => Phase.Night,
    stage: () => "warden_pair",
    current: (s) => s.current(),
  },
  190,
  ["warden_candidates", "action_failure_policy", "allow_fallback"],
);
const decisionRequests = RequestLease.window<Scope>(
  {
    actorId: (s) => s.actorId,
    day: (s) => s.day,
    phase: () => Phase.Night,
    stage: () => "warden_decide",
    current: (s) => s.current(),
  },
  191,
  ["warden_partner_id", "action_failure_policy", "allow_fallback"],
);
function prepareDecision(ctx: TrustedNightStageRuntime, actorId: number, day: number) {
  const partnerId = wardenPartner(ctx.world, actorId, day);
  if (partnerId === null) throw new Error("warden_partner_revoked");
  const request = ctx.makeRequest(actorId, ["warden_decide"], {
    stage: "warden_decide",
    requiresAction: true,
    action_failure_policy: "error",
    allow_fallback: false,
    warden_partner_id: partnerId,
  });
  const scope: Scope = {
    actorId,
    day,
    current: () =>
      ctx.isCurrent() && ctx.currentDay() === day && wardenDecisionCurrent(ctx.world, actorId, day),
  };
  decisionRequests.bind(scope, request);
  const delivery = decisionRequests.openDelivery(scope, request);
  if (!delivery) throw new Error("warden_decision_revoked");
  return { actorId, request, delivery, accepted: null as WardenDecision | null };
}
async function collectDecision(
  ctx: TrustedNightStageRuntime,
  day: number,
  p: ReturnType<typeof prepareDecision>,
): Promise<void> {
  let failed = false;
  try {
    const provider = ctx.actionProvider,
      getAction = provider.getAction,
      args: [ActionRequest] = [p.request],
      invoke = Reflect.apply.bind(Reflect);
    if (!p.delivery.current()) throw new Error("warden_decision_revoked");
    const action = (await invoke(getAction, provider, args)) as ToolCall | null;
    if (!p.delivery.current()) throw new Error("warden_decision_revoked");
    if (action?.name !== "warden_decide") throw new Error("warden_decision_missing");
    const result = ctx.toolGateway.validateAndSanitize(ctx.world, p.actorId, action, {
      phase: Phase.Night,
      day,
    });
    if (!p.delivery.current()) throw new Error("warden_decision_revoked");
    if (!result.ok || result.sanitizedCall?.name !== "warden_decide")
      throw new Error("warden_decision_invalid");
    const choice = result.sanitizedCall.args.choice;
    commitWardenDecision(ctx.world, p.actorId, day, choice, () => p.delivery.current());
    p.accepted = choice;
    p.delivery.complete();
  } catch (error) {
    failed = true;
    throw error;
  } finally {
    try {
      p.delivery.close();
    } catch (error) {
      if (!failed) throw error;
    }
  }
}
export const WARDEN_NIGHT_STAGE: TrustedNightStageHandler = {
  id: "warden_pair",
  priority: 100,
  async execute(ctx) {
    const day = ctx.currentDay();
    if (day < 2) return;
    const actors = ctx.getAliveByRole(Role.Warden);
    if (!actors.length) return;
    if (actors.length !== 1) throw new Error("warden_actor_count_invalid");
    const actorId = actors[0]!;
    openWardenNight(ctx.world, actorId, day);
    bindWardenNightState(ctx.state, ctx.world, day);
    bindWardenNativeRuntime(ctx, ctx.world, day);
    let delivery: RequestLeaseTurn | undefined,
      failed = false;
    const pending: ReturnType<typeof prepareDecision>[] = [];
    try {
      const request = ctx.makeRequest(actorId, ["warden_pair"], {
        stage: "warden_pair",
        requiresAction: true,
        action_failure_policy: "error",
        allow_fallback: false,
        warden_candidates: wardenCandidates(ctx.world, actorId, day),
      });
      const scope: Scope = {
        actorId,
        day,
        current: () =>
          ctx.isCurrent() &&
          ctx.currentDay() === day &&
          wardenNightCurrent(ctx.world, actorId, day),
      };
      pairRequests.bind(scope, request);
      delivery = pairRequests.openDelivery(scope, request);
      const provider = ctx.actionProvider,
        getAction = provider.getAction,
        args: [ActionRequest] = [request],
        invoke = Reflect.apply.bind(Reflect);
      if (!delivery?.current()) throw new Error("warden_pair_revoked");
      const action = (await invoke(getAction, provider, args)) as ToolCall | null;
      if (!delivery.current()) throw new Error("warden_pair_revoked");
      if (action?.name !== "warden_pair") throw new Error("warden_pair_missing");
      const result = ctx.toolGateway.validateAndSanitize(ctx.world, actorId, action, {
        phase: Phase.Night,
        day,
      });
      if (!delivery.current()) throw new Error("warden_pair_revoked");
      if (!result.ok || result.sanitizedCall?.name !== "warden_pair")
        throw new Error("warden_pair_invalid");
      const chosen = result.sanitizedCall.args.target_ids;
      commitWardenPair(ctx.world, actorId, day, chosen, () => delivery!.current());
      delivery.complete();
      ctx.events.push({
        timestamp: Date.now(),
        type: "warden_pair_chosen",
        payload: { policy: WARDEN_POLICY, actorId, day, pair: chosen },
        audience: Object.freeze([actorId]),
      });
      if (chosen === null) return;
      for (const id of chosen)
        ctx.events.push({
          timestamp: Date.now(),
          type: "warden_partner_notified",
          payload: {
            policy: WARDEN_POLICY,
            actorId: id,
            day,
            partnerId: chosen.find((other) => other !== id)!,
          },
          audience: Object.freeze([id]),
        });
      // 在任何Provider开始前建立两份独立请求，ctx不包含另一人的选择或完成状态。
      for (const id of chosen) pending.push(prepareDecision(ctx, id, day));
      const results = await Promise.allSettled(pending.map((p) => collectDecision(ctx, day, p)));
      const rejection = results.find((r) => r.status === "rejected");
      try {
        for (const p of pending)
          if (p.accepted !== null)
            ctx.events.push({
              timestamp: Date.now(),
              type: "warden_decision",
              payload: { policy: WARDEN_POLICY, actorId: p.actorId, day, choice: p.accepted },
              audience: Object.freeze([p.actorId]),
            });
      } catch (error) {
        if (rejection?.status === "rejected") throw rejection.reason;
        throw error;
      }
      if (rejection?.status === "rejected") throw rejection.reason;
      const outcome = wardenOutcome(ctx.world, day);
      if (!outcome) throw new Error("warden_resolution_missing");
      ctx.events.push({
        timestamp: Date.now(),
        type: "warden_resolved",
        payload: { policy: WARDEN_POLICY, day, ...outcome },
        audience: Object.freeze([]),
      });
    } catch (error) {
      failed = true;
      throw error;
    } finally {
      closeWardenNight(ctx.world);
      for (const p of pending)
        try {
          p.delivery.close();
        } catch (error) {
          if (!failed) throw error;
        }
      try {
        delivery?.close();
      } catch (error) {
        if (!failed) throw error;
      }
    }
  },
};
export const OWNED_NIGHT_STAGE_PROGRAMS = Object.freeze([
  [WARDEN_NIGHT_STAGE, WARDEN_NIGHT_STAGE.execute] as const,
]);
