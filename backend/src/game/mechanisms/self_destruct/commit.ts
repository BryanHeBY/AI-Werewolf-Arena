/**
 * Commits the selected self-destruct choice through its configured role hook. Inputs are the
 * captured actor, validated blast and current window; outputs are existing blast effects and
 * death proposals. It does not reuse a revoked actor or perform final phase/victory sealing.
 */
import { RED_MOON_ROLE } from "../roles/red_moon_apostle/state";
import { commitDemonRedMoonBlast } from "../roles/demon_hunter/authority";
import { canRoleSelfDestruct } from "../roles/self_destruct_capability";
import {
  weddingMember,
  weddingSetup,
  ghostBrideReady,
  swallowWeddingBadges,
} from "../roles/ghost_bride/authority";
import {
  ActionWindow,
  Phase,
  Role,
  DeathCause,
  type SelfDestructSelection,
  type DeathSources,
  type GameEvent,
} from "../../../core/domain/model";
import { COMPONENT } from "../../../core/domain/components/names";
import type { RoleComponent } from "../../../core/domain/components/role";
import type { World } from "../../../core/domain/world";
import { getWhiteWolfKingState, consumeWhiteWolfDetonation } from "../roles/white_wolf_king/ports";
import { getDefaultRoleCatalog } from "../roles/catalog";

/** Commits only this public ability's resource/event/facts; the resolver owns death writes. */
export function commitSelfDestructSelection(
  world: World,
  choice: SelfDestructSelection,
  window: ActionWindow,
  phase: Phase,
  events: GameEvent[],
): { deaths: number[]; sources: DeathSources } | null {
  if (
    !Object.values(ActionWindow).includes(window) ||
    phase !== (window === ActionWindow.OnPreVote ? Phase.Voting : Phase.Day)
  )
    return null;
  const role = world.getComponent(choice.actorId, COMPONENT.Role);
  if (!role || !world.getComponent(choice.actorId, COMPONENT.Alive)?.alive) return null;
  const ownsWedding = weddingSetup(world) !== null;
  if (
    ownsWedding &&
    (!ghostBrideReady(world) ||
      role.role !== Role.Wolf ||
      weddingMember(world, role) ||
      ![ActionWindow.OnPreElection, ActionWindow.OnPreVote].includes(window))
  )
    return null;
  const deaths = [choice.actorId],
    sources: DeathSources = { [choice.actorId]: [DeathCause.SelfDestruct] };
  if (choice.kind === "ordinary") {
    const redMoon = String(role.role) === RED_MOON_ROLE;
    if (
      choice.targetId !== null ||
      (redMoon
        ? ![ActionWindow.OnPreElection, ActionWindow.OnPreVote].includes(window)
        : !canRoleSelfDestruct(role, getDefaultRoleCatalog()))
    )
      return null;
    const moon = redMoon ? commitDemonRedMoonBlast(world, choice.actorId) : null;
    if (redMoon && !moon) return null;
    if (ownsWedding) swallowWeddingBadges(world, events);
    events.push({
      timestamp: Date.now(),
      type: "wolf_self_destruct",
      payload: { wolfId: choice.actorId, window },
    });
    if (moon?.sealsNight)
      events.push({
        timestamp: Date.now(),
        type: "red_moon_night_sealed",
        payload: { actorId: choice.actorId, day: moon.day, night: moon.day + 1 },
      });
  } else if (choice.kind === "white_wolf_king") {
    const state = getWhiteWolfKingState(role);
    if (role.role !== Role.WhiteWolfKing || state?.canDetonate !== true) return null;
    if (choice.targetId !== null) {
      if (
        choice.targetId === choice.actorId ||
        !world.getComponent(choice.targetId, COMPONENT.Alive)?.alive
      )
        return null;
      deaths.push(choice.targetId);
      sources[choice.targetId] = [DeathCause.WhiteWolfBlast];
    }
    consumeWhiteWolfDetonation(state);
    events.push({
      timestamp: Date.now(),
      type: "white_wolf_king_self_destruct",
      payload: { actorId: choice.actorId, targetId: choice.targetId, window },
    });
  } else return null;
  return { deaths, sources };
}
