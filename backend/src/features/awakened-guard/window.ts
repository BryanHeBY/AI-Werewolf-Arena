/**
 * 负责觉醒守卫一个真实安全边界的严格请求交付。输入原boundary、构造端口与运行依赖，输出显式选择结算。
 * 时点在真实夜阶段或Guard→Knight日边界的第一步；租约250捕获原phase/day/context与最早期限。
 * 仅本族authority付款，真实决定后先完成交付再发表事实；发表异常保已付前缀，缺失／late不伪造成wait。
 */
import { Phase, type GameEvent } from "@ai-werewolf-arena/game-contract";
import { AWAKENED_GUARD_POLICY } from "@ai-werewolf-arena/game-contract/facts/awakened-guard";
import type { ActionProvider, ActionRequestConstructionPort } from "../../domain/actions";
import type { World } from "../../domain/world";
import { RequestLease } from "../../domain/request-lease";
import type { ToolGateway } from "../../engine/actions/tool-gateway";
import {
  guardBoundaryOptions,
  guardBoundaryCurrent,
  commitGuardChoice,
  closeGuardBoundary,
  type GuardBoundary,
} from "./authority";
interface Scope {
  actorId: number;
  day: number;
  phase: Phase;
  stage: "awakened_protection_night" | "awakened_protection_day";
  current(): boolean;
}
const choices = RequestLease.window<Scope>(
  {
    actorId: (s) => s.actorId,
    day: (s) => s.day,
    phase: (s) => s.phase,
    stage: (s) => s.stage,
    current: (s) => s.current(),
  },
  250,
  ["awakened_protect_options", "action_failure_policy", "allow_fallback"],
);
export interface GuardWindowRuntime {
  readonly world: World;
  readonly events: GameEvent[];
  readonly requests: ActionRequestConstructionPort;
  readonly provider: ActionProvider;
  readonly gateway: ToolGateway;
  readonly phase: Phase;
  current(): boolean;
}
export async function runGuardBoundary(
  runtime: GuardWindowRuntime,
  boundary: GuardBoundary,
): Promise<void> {
  let delivery: ReturnType<typeof choices.openDelivery> | undefined,
    failed = false;
  try {
    const o = guardBoundaryOptions(runtime.world, boundary);
    if (!o) throw new Error("awakened_guard_boundary_revoked");
    const { actorId, day, timing } = o,
      phase = runtime.phase,
      stage = timing === "night" ? "awakened_protection_night" : "awakened_protection_day";
    const scope: Scope = {
      actorId,
      day,
      phase,
      stage,
      current: () => runtime.current() && guardBoundaryCurrent(runtime.world, boundary),
    };
    const request = runtime.requests.create({
      actorId,
      phase,
      stage,
      allowedTools: ["awakened_protect"],
      requiresAction: true,
      summary: { key: "request.summary.awakened_protect" },
      context: {
        awakened_protect_options: { timing, last: o.last, targetIds: o.targetIds },
        action_failure_policy: "error",
        allow_fallback: false,
      },
    });
    choices.bind(scope, request);
    delivery = choices.openDelivery(scope, request);
    if (!delivery) throw new Error("awakened_guard_request_revoked");
    const provider = runtime.provider,
      get = provider.getAction,
      args: [typeof request] = [request],
      invoke = Reflect.apply.bind(Reflect);
    if (!delivery.current()) throw new Error("awakened_guard_request_revoked");
    const action = await invoke(get, provider, args);
    if (!delivery.current()) throw new Error("awakened_guard_reply_revoked");
    if (action?.name !== "awakened_protect") throw new Error("awakened_guard_action_missing");
    const validated = runtime.gateway.validateAndSanitize(runtime.world, actorId, action, {
      phase,
      day,
    });
    if (!validated.ok || validated.sanitizedCall?.name !== "awakened_protect")
      throw new Error("awakened_guard_action_invalid");
    const choice = {
      mode: validated.sanitizedCall.args.mode,
      targetId: validated.sanitizedCall.args.target_id,
    };
    const outcome = commitGuardChoice(runtime.world, boundary, choice, () => delivery!.current());
    // 唯一付款／明确决定已经落定，先终结并通知；后续发表失败不把真实接受改成false。
    delivery.complete();
    runtime.events.push({
      timestamp: Date.now(),
      type: "awakened_protection_chosen",
      payload: { policy: AWAKENED_GUARD_POLICY, actorId, day, timing, ...choice, outcome },
      audience: Object.freeze([actorId]),
    });
    if (timing === "day" && choice.mode === "protect")
      runtime.events.push({
        timestamp: Date.now(),
        type: "awakened_protection_revealed",
        payload: { policy: AWAKENED_GUARD_POLICY, actorId, day, targetId: choice.targetId! },
      });
  } catch (error) {
    failed = true;
    throw error;
  } finally {
    closeGuardBoundary(boundary);
    if (failed) {
      try {
        delivery?.close();
      } catch {
        /* 保留原提交／传输失败。 */
      }
    } else delivery?.close();
  }
}
