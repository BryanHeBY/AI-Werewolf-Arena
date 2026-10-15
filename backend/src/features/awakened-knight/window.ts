/**
 * 负责觉醒骑士普通／成功续步的单次严格请求。输入真实boundary与原运行依赖，输出唯一authority已付结果。
 * 时点在Guard机会及前一完整死亡链之后；251/252租约区分普通null与连续结束，原day/phase不能改写。
 * 只记录本族公开尝试事实，不写Alive、不flush遗言或改阶段；缺失／失效关闭原窗口且保既有前缀。
 */
import { type Phase, type GameEvent } from "@ai-werewolf-arena/game-contract";
import { AWAKENED_DUEL_POLICY } from "@ai-werewolf-arena/game-contract/facts/awakened-duel";
import type { World } from "../../domain/world";
import type { ActionProvider, ActionRequestConstructionPort } from "../../domain/actions";
import { RequestLease } from "../../domain/request-lease";
import type { ToolGateway } from "../../engine/actions/tool-gateway";
import {
  duelBoundaryOptions,
  duelBoundaryCurrent,
  commitDuelChoice,
  paidDuelProposal,
  closeDuelBoundary,
  closeDuelChain,
  type DuelBoundary,
  type DuelChoiceResult,
} from "./authority";
interface Scope {
  actorId: number;
  day: number;
  phase: Phase;
  stage: "awakened_duel" | "awakened_duel_continue";
  current(): boolean;
}
const lease = (order: number) =>
  RequestLease.window<Scope>(
    {
      actorId: (s) => s.actorId,
      day: (s) => s.day,
      phase: (s) => s.phase,
      stage: (s) => s.stage,
      current: (s) => s.current(),
    },
    order,
    ["awakened_duel_options", "action_failure_policy", "allow_fallback"],
  );
const ordinary = lease(251),
  continued = lease(252);
export interface DuelWindowRuntime {
  readonly world: World;
  readonly events: GameEvent[];
  readonly requests: ActionRequestConstructionPort;
  readonly provider: ActionProvider;
  readonly gateway: ToolGateway;
  readonly phase: Phase;
  current(): boolean;
}
export async function runDuelBoundary(
  runtime: DuelWindowRuntime,
  boundary: DuelBoundary,
): Promise<DuelChoiceResult> {
  let delivery: ReturnType<typeof ordinary.openDelivery> | undefined,
    failed = false,
    paid: DuelChoiceResult | undefined;
  try {
    const o = duelBoundaryOptions(runtime.world, boundary);
    if (!o) throw new Error("awakened_duel_boundary_revoked");
    const { actorId, day } = o,
      phase = runtime.phase,
      stage = o.continuing ? "awakened_duel_continue" : "awakened_duel",
      leases = o.continuing ? continued : ordinary;
    const scope: Scope = {
      actorId,
      day,
      phase,
      stage,
      current: () => runtime.current() && duelBoundaryCurrent(runtime.world, boundary),
    };
    const request = runtime.requests.create({
      actorId,
      phase,
      stage,
      allowedTools: ["awakened_duel"],
      requiresAction: true,
      summary: {
        key: o.continuing
          ? "request.summary.awakened_duel_continue"
          : "request.summary.awakened_duel",
      },
      context: {
        awakened_duel_options: { continuing: o.continuing, targetIds: o.targetIds },
        action_failure_policy: "error",
        allow_fallback: false,
      },
    });
    leases.bind(scope, request);
    delivery = leases.openDelivery(scope, request);
    if (!delivery) throw new Error("awakened_duel_request_revoked");
    const provider = runtime.provider,
      get = provider.getAction,
      args: [typeof request] = [request],
      invoke = Reflect.apply.bind(Reflect);
    if (!delivery.current()) throw new Error("awakened_duel_request_revoked");
    const action = await invoke(get, provider, args);
    if (!delivery.current()) throw new Error("awakened_duel_reply_revoked");
    if (action?.name !== "awakened_duel") throw new Error("awakened_duel_action_missing");
    const validated = runtime.gateway.validateAndSanitize(runtime.world, actorId, action, {
      phase,
      day,
    });
    if (!validated.ok || validated.sanitizedCall?.name !== "awakened_duel")
      throw new Error("awakened_duel_action_invalid");
    const result = (paid = commitDuelChoice(
      runtime.world,
      boundary,
      validated.sanitizedCall.args.target_id,
      () => delivery!.current(),
    ));
    // 已付尝试或显式null已落定；先终结租约，晚日志／true通知异常不得二次false。
    delivery.complete();
    if (result.kind === "attempt") {
      const proposal = paidDuelProposal(runtime.world, result.attempt);
      runtime.events.push({
        timestamp: Date.now(),
        type: "awakened_duel_committed",
        payload: {
          policy: AWAKENED_DUEL_POLICY,
          actorId,
          day,
          chain: proposal.chain,
          targetId: proposal.targetId,
          branch: proposal.branch,
        },
      });
    }
    return result;
  } catch (error) {
    failed = true;
    if (paid && paid.kind !== "declined") {
      try {
        closeDuelChain(runtime.world, paid.chain);
      } catch {
        /* 只收原链编辑权，保留真正付款及原异常。 */
      }
    }
    throw error;
  } finally {
    closeDuelBoundary(boundary);
    if (failed) {
      try {
        delivery?.close();
      } catch {
        /* 保留原失败。 */
      }
    } else delivery?.close();
  }
}
