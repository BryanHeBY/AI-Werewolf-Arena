/**
 * Commits a selected Knight duel against its captured target and original actor. Inputs are the
 * validated selection and current window; outputs are the original duel effects and death
 * proposals. It does not reuse a revoked window or independently advance the day phase.
 */
import {
  Role,
  Camp,
  Phase,
  DeathCause,
  type KnightDuelSelection,
  type DeathSources,
  type GameEvent,
} from "../../../../core/domain/model";
import { COMPONENT } from "../../../../core/domain/components/names";
import type { RoleComponent } from "../../../../core/domain/components/role";
import type { World } from "../../../../core/domain/world";
import { getKnightState, consumeKnightDuel } from "./state";

/** One Knight resource/public fact/death proposal; never writes Alive or advances the phase. */
export function commitKnightDuel(
  world: World,
  choice: KnightDuelSelection,
  phase: Phase,
  events: GameEvent[],
): { deaths: number[]; sources: DeathSources; endsDay: boolean } | null {
  if (phase !== Phase.Day || choice.actorId === choice.targetId) return null;
  const actor = world.getComponent(choice.actorId, COMPONENT.Role),
    target = world.getComponent(choice.targetId, COMPONENT.Role);
  const state = actor ? getKnightState(actor) : undefined;
  if (
    actor?.role !== Role.Knight ||
    state?.canDuel !== true ||
    !target ||
    !world.getComponent(choice.actorId, COMPONENT.Alive)?.alive ||
    !world.getComponent(choice.targetId, COMPONENT.Alive)?.alive
  )
    return null;
  const hit = target.camp === Camp.Wolf;
  consumeKnightDuel(state);
  events.push({
    timestamp: Date.now(),
    type: "knight_duel",
    payload: {
      actorId: choice.actorId,
      targetId: choice.targetId,
      result: hit ? "wolf" : "not_wolf",
    },
  });
  return hit
    ? {
        deaths: [choice.targetId],
        sources: { [choice.targetId]: [DeathCause.Duel] },
        endsDay: true,
      }
    : {
        deaths: [choice.actorId],
        sources: { [choice.actorId]: [DeathCause.DuelFailure] },
        endsDay: false,
      };
}
