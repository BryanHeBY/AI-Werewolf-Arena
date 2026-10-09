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
import { getWhiteWolfKingState } from "../roles/private_state";
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
  const role = world.getComponent<RoleComponent>(choice.actorId, COMPONENT.Role);
  if (!role || !world.getComponent<{ alive: boolean }>(choice.actorId, COMPONENT.Alive)?.alive)
    return null;
  const deaths = [choice.actorId],
    sources: DeathSources = { [choice.actorId]: [DeathCause.SelfDestruct] };
  if (choice.kind === "ordinary") {
    if (
      choice.targetId !== null ||
      getDefaultRoleCatalog().get(role.role)?.canSelfDestruct !== true
    )
      return null;
    events.push({
      timestamp: Date.now(),
      type: "wolf_self_destruct",
      payload: { wolfId: choice.actorId, window },
    });
  } else if (choice.kind === "white_wolf_king") {
    const state = getWhiteWolfKingState(role);
    if (role.role !== Role.WhiteWolfKing || state?.canDetonate !== true) return null;
    if (choice.targetId !== null) {
      if (
        choice.targetId === choice.actorId ||
        !world.getComponent<{ alive: boolean }>(choice.targetId, COMPONENT.Alive)?.alive
      )
        return null;
      deaths.push(choice.targetId);
      sources[choice.targetId] = [DeathCause.WhiteWolfBlast];
    }
    state.canDetonate = false;
    events.push({
      timestamp: Date.now(),
      type: "white_wolf_king_self_destruct",
      payload: { actorId: choice.actorId, targetId: choice.targetId, window },
    });
  } else return null;
  return { deaths, sources };
}
