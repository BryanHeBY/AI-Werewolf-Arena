/**
 * 负责觉醒猎人的真实死亡方向请求、独立租约与临时patrol许可。输入为本族不透明资格及DR当前波，
 * 输出已付内存提案；真实最近狼由唯一owner付款时重算，不向模型提供狼候选或伪装成shoot。
 * 本组合只收选择和调用本族付款，不标死、递归结算或判胜；DR关闭同一许可数组，失败保已付前缀。
 */
import { Phase, type ActionRequest, type ToolCall } from "@ai-werewolf-arena/game-contract";
import { AWAKENED_PATROL_POLICY } from "@ai-werewolf-arena/game-contract/facts/awakened-patrol";
import { RequestLease, type RequestLeaseTurn } from "../domain/request-lease";
import type { ActionProvider } from "../domain/actions";
import { GameActionRequestFactory } from "../engine/actions/action-request-factory";
import {
  awakenedPatrolCurrent,
  awakenedPatrolSeats,
  payAwakenedPatrol,
  awakenedPatrolPayment,
  closeAwakenedPatrol,
  type PatrolQualification,
} from "../features/awakened-hunter/authority";
import type { DeathShotSelectionRuntime, DeathWaveActions } from "./death-shot-selection";
interface Scope {
  actorId: number;
  day: number;
  phase: Phase;
  current(): boolean;
}
const requests = RequestLease.window<Scope>(
  {
    actorId: (s) => s.actorId,
    day: (s) => s.day,
    phase: (s) => s.phase,
    stage: () => "awakened_patrol",
    current: (s) => s.current(),
  },
  231,
  [
    "trigger",
    "death_phase",
    "death_origin_phase",
    "death_sources",
    "death_action_id",
    "patrol_seat_order",
    "action_failure_policy",
    "allow_fallback",
  ],
);
export async function collectDeathPatrol(
  runtime: DeathShotSelectionRuntime,
  actorId: number,
  qualification: PatrolQualification,
  provider: ActionProvider,
  actions: DeathWaveActions,
  deathPhase: Phase,
  rootPhase: Phase,
  causes: readonly import("@ai-werewolf-arena/game-contract").DeathCause[],
) {
  const world = runtime.world;
  const current = () =>
    actions.isCurrent() &&
    runtime.world === world &&
    runtime.state.day === actions.day &&
    runtime.state.phase === actions.phase &&
    !runtime.state.gameOver &&
    awakenedPatrolCurrent(world, qualification);
  let failed = false,
    delivery: RequestLeaseTurn | undefined;
  try {
    if (!current()) throw new Error("awakened_patrol_request_revoked");
    const permit = world.openDeathAction(actorId, "patrol", actions.phase, actions.day, current);
    actions.permits.push(permit);
    const request = new GameActionRequestFactory(world, runtime.events, actions.day).create({
      phase: actions.phase,
      actorId,
      allowedTools: ["patrol"],
      stage: "awakened_patrol",
      requiresAction: true,
      summary: { key: "request.summary.awakened_patrol" },
      context: {
        trigger: "on_death",
        death_phase: deathPhase,
        death_origin_phase: rootPhase,
        death_sources: [...causes],
        death_action_id: permit.id,
        patrol_seat_order: awakenedPatrolSeats(world, qualification),
        action_failure_policy: "error",
        allow_fallback: false,
      },
    });
    const scope: Scope = { actorId, day: actions.day, phase: actions.phase, current };
    requests.bind(scope, request);
    delivery = requests.openDelivery(scope, request);
    const getAction = provider.getAction,
      args: [ActionRequest] = [request],
      invoke = Reflect.apply.bind(Reflect);
    if (!delivery?.current()) throw new Error("awakened_patrol_request_revoked");
    const action = (await invoke(getAction, provider, args)) as ToolCall | null;
    if (!delivery.current()) throw new Error("awakened_patrol_request_revoked");
    if (action?.name !== "patrol") throw new Error("awakened_patrol_action_missing");
    const valid = runtime.toolGateway.validateAndSanitize(world, actorId, action, {
      phase: actions.phase,
      day: actions.day,
      deathActionId: permit.id,
    });
    if (!delivery.current()) throw new Error("awakened_patrol_request_revoked");
    if (!valid.ok || valid.sanitizedCall?.name !== "patrol")
      throw new Error("awakened_patrol_action_invalid");
    const direction = valid.sanitizedCall.args.direction;
    const proposal = payAwakenedPatrol(
      world,
      qualification,
      direction,
      () =>
        delivery!.current() &&
        world.hasDeathAction(actorId, "patrol", actions.phase, actions.day, permit.id),
    );
    delivery.complete();
    const payment = awakenedPatrolPayment(world, qualification);
    if (!payment) throw new Error("awakened_patrol_payment_missing");
    runtime.events.push({
      timestamp: Date.now(),
      type: "awakened_patrol_paid",
      payload: { policy: AWAKENED_PATROL_POLICY, actorId, ...payment },
      audience: Object.freeze([actorId]),
    });
    if (!proposal)
      runtime.events.push({
        timestamp: Date.now(),
        type: "awakened_patrol_resolved",
        payload: {
          policy: AWAKENED_PATROL_POLICY,
          day: actions.day,
          actorId,
          direction: null,
          targetId: null,
        },
      });
    return proposal;
  } catch (error) {
    failed = true;
    throw error;
  } finally {
    closeAwakenedPatrol(qualification);
    try {
      delivery?.close();
    } catch (error) {
      if (!failed) throw error;
    }
  }
}
