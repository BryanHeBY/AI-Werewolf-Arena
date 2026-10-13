/**
 * 负责把夜之贵族／觉醒愚者秘密之身的原知识通知与契约结算回执发布为事实和必需录制。
 * 输入为原权威的通知／回执、事件数组与阶段；输出保留原载荷、受众冻结和记录失败前缀。
 * 知识与通知纯结构归公共契约，实际库存和付款仍归 authority；本模块不选择目标、
 * 重新判胜或授予租约，先检查权威回执再记录／发布的原顺序保持。
 */
import type { GameEvent } from "../../../../core/domain/events";
import { Phase } from "../../../../core/domain/identity";
import type { World } from "../../../../core/domain/world";
import { getSessionRecorder } from "../../../../recording/recording_context";
import { checkpointNobleBodyAuthority } from "./authority";
import { NOBLE_SECRET_BODY_POLICY } from "./state";
import type { NobleBodyNightNotice } from "@ai-werewolf-arena/game-contract/facts/noble-secret-body";
export function appendNobleBodyNotices(
  events: GameEvent[],
  notices: readonly NobleBodyNightNotice[],
): void {
  for (const n of notices)
    events.push(
      n.kind === "night_noble"
        ? {
            timestamp: Date.now(),
            type: "noble_night_notified",
            payload: {
              policy: NOBLE_SECRET_BODY_POLICY,
              actorId: n.actorId,
              day: n.day,
              ...n.known,
            },
            audience: Object.freeze([n.actorId]),
          }
        : {
            timestamp: Date.now(),
            type: "secret_body_night_notified",
            payload: {
              policy: NOBLE_SECRET_BODY_POLICY,
              actorId: n.actorId,
              day: n.day,
              ...n.known,
            },
            audience: Object.freeze([n.actorId]),
          },
    );
}
export function recordNobleContractClosure(
  world: World,
  day: number,
  receipt: { contractId: string; targetId: number },
  phase: Phase,
) {
  const owned = checkpointNobleBodyAuthority(world, true),
    contract = owned.noble.contracts.find((c) => c.id === receipt.contractId);
  if (
    !contract ||
    contract.status.kind === "pending" ||
    contract.status.day !== day ||
    contract.targetId !== receipt.targetId
  )
    throw Error("noble_contract_fact_invalid");
  const payload = {
    policy: NOBLE_SECRET_BODY_POLICY,
    actorId: owned.nobleId,
    day,
    contractId: contract.id,
    targetId: contract.targetId,
    createdNight: contract.createdNight,
    expiresNight: contract.expiresNight,
    ...(contract.status.kind === "expired"
      ? { status: "expired" as const, proposedCause: "servant_expiry" as const }
      : { status: contract.status.kind }),
  };
  getSessionRecorder()?.recordRequiredLogicOp({
    scope: "resolution",
    op: "noble_contract_closed",
    actorId: owned.nobleId,
    phase,
    status: "ok",
    output: payload,
  });
  return Object.freeze(payload);
}

export function appendNobleContractClosure(
  world: World,
  day: number,
  receipt: { contractId: string; targetId: number },
  events: GameEvent[],
  phase: Phase,
): void {
  const payload = recordNobleContractClosure(world, day, receipt, phase);
  events.push({
    timestamp: Date.now(),
    type: "noble_contract_closed",
    payload,
    audience: Object.freeze([]),
  });
}
