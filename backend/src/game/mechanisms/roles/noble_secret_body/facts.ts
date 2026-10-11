import type { GameEvent } from "../../../../core/domain/events";
import { Phase } from "../../../../core/domain/identity";
import type { World } from "../../../../core/domain/world";
import { getSessionRecorder } from "../../../../recording/recording_context";
import { checkpointNobleBodyAuthority } from "./authority";
import { NOBLE_SECRET_BODY_POLICY } from "./state";
import type { NobleBodyNightNotice } from "./player_projection";
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
