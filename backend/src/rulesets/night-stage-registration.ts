/**
 * Owns explicit compatibility and Ghost Bride replacement registration policies.
 * Inputs are already collected handler references and compiler-provided wedding
 * handlers; outputs are the registered Map or a named conflicting-handler error.
 * Profile and compiler reservations share only the same original handler for an
 * observed ID. No duplicate priority/execute getters, actor queries or coercion
 * run here; declared replacements preserve their original four-step order.
 */
import type { NightStageHandler } from "../game/mechanisms/stages/night/contracts";

export const NIGHT_STAGE_SHARING = Object.freeze({
  compatibility: "same-original-handler-reference",
  sources: Object.freeze(["role-profile", "compiler-reservation"] as const),
  conflictCode: "night_stage_handler_conflict",
} as const);

/** These are finite existing operations, not a general replacement graph. */
export const GHOST_BRIDE_STAGE_OPERATIONS = Object.freeze([
  Object.freeze({ kind: "remove", id: "wolf_kill_vote" } as const),
  Object.freeze({ kind: "install", source: "wedding-chat" } as const),
  Object.freeze({ kind: "install", source: "wedding-knife" } as const),
  Object.freeze({ kind: "reprioritize-if-present", id: "wolf_discussion", priority: 350 } as const),
] as const);

export function registerNightStages(
  collected: readonly NightStageHandler[],
): Map<string, NightStageHandler> {
  const registered = new Map<string, NightStageHandler>();
  for (const stage of collected) {
    const observedId = stage.id;
    if (!registered.has(observedId)) {
      // Keep the original second ID evaluation for a newly registered winner.
      const registeredId = stage.id,
        existing = registered.get(registeredId);
      if (existing !== undefined && existing !== stage) conflict(registeredId);
      registered.set(registeredId, stage);
    } else if (registered.get(observedId) !== stage) {
      conflict(observedId);
    }
  }
  return registered;
}

function conflict(observedId: string): never {
  const suffix = typeof observedId === "string" ? `:${observedId}` : "";
  throw new Error(NIGHT_STAGE_SHARING.conflictCode + suffix);
}

export function applyGhostBrideStageRegistration(
  registered: Map<string, NightStageHandler>,
  weddingChat: NightStageHandler,
  weddingKnife: NightStageHandler,
): void {
  for (const operation of GHOST_BRIDE_STAGE_OPERATIONS) {
    switch (operation.kind) {
      case "remove":
        registered.delete(operation.id);
        break;
      case "install": {
        const stage = operation.source === "wedding-chat" ? weddingChat : weddingKnife;
        registered.set(stage.id, stage);
        break;
      }
      case "reprioritize-if-present": {
        const chat = registered.get(operation.id);
        if (chat) registered.set(chat.id, { ...chat, priority: operation.priority });
        break;
      }
    }
  }
}
