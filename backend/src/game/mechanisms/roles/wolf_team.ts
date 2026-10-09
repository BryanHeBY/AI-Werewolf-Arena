import { initialIdentitySetupReady } from "./initial_identity/deal";
import { COMPONENT } from "../../../core/domain/components/names";
import type { RoleComponent } from "../../../core/domain/components/role";
import {
  Camp,
  type EntityId,
  type GameEvent,
  type WolfTeamEventType,
} from "../../../core/domain/model";
import type { World } from "../../../core/domain/world";
import type { RoleCatalog } from "./catalog";
import type { WolfTeamPermissions } from "./contracts";

const NO_ACCESS: WolfTeamPermissions = Object.freeze({
  recognizedByPack: false,
  recognizes: "none",
  canChat: false,
  canVoteForKill: false,
});

/** Pure query over the role's current explicit permissions; no global registry. */
export function wolfTeamPermissions(
  role: RoleComponent | undefined,
  catalog: RoleCatalog,
  world?: World,
): WolfTeamPermissions {
  if (world && !initialIdentitySetupReady(world)) return NO_ACCESS;
  if (!role || role.camp !== Camp.Wolf) return NO_ACCESS;
  const permissions = catalog.get(role.role)?.wolfTeam;
  return typeof permissions === "function" ? permissions(role, world) : (permissions ?? NO_ACCESS);
}

export function knownWolfTeammates(
  world: World,
  actorId: EntityId,
  catalog: RoleCatalog,
): EntityId[] {
  const viewer = wolfTeamPermissions(
    world.getComponent<RoleComponent>(actorId, COMPONENT.Role),
    catalog,
    world,
  );
  if (viewer.recognizes === "none") return [];
  // Identity knowledge is independent of unannounced deaths.
  return world
    .entityIds()
    .filter((id) => {
      if (id === actorId) return false;
      const target = world.getComponent<RoleComponent>(id, COMPONENT.Role);
      if (target?.camp !== Camp.Wolf) return false;
      if (viewer.recognizes === "all") return true;
      if (viewer.recognizes === "pack")
        return wolfTeamPermissions(target, catalog, world).recognizedByPack;
      return viewer.recognizes.includes(target.role);
    })
    .sort((a, b) => a - b);
}

export function wolfChatParticipants(world: World, catalog: RoleCatalog): EntityId[] {
  return world
    .getAliveEntityIds()
    .filter(
      (id) =>
        wolfTeamPermissions(world.getComponent<RoleComponent>(id, COMPONENT.Role), catalog, world)
          .canChat,
    )
    .sort((a, b) => a - b);
}

export function wolfKnifeHolders(world: World, catalog: RoleCatalog): EntityId[] {
  return world
    .getAliveEntityIds()
    .filter(
      (id) =>
        wolfTeamPermissions(world.getComponent<RoleComponent>(id, COMPONENT.Role), catalog, world)
          .canVoteForKill,
    )
    .sort((a, b) => a - b);
}

/** Capture once at emission. This envelope stays internal to the engine/Tape. */
export function wolfTeamEvent<K extends WolfTeamEventType>(
  world: World,
  catalog: RoleCatalog,
  event: Omit<Extract<GameEvent, { type: K }>, "audience">,
): Extract<GameEvent, { type: K }> {
  const recipients = wolfChatParticipants(world, catalog);
  if (event.type === "wolf_kill_vote_cast") recipients.push(...wolfKnifeHolders(world, catalog));
  return {
    ...event,
    audience: Object.freeze([...new Set(recipients)].sort((a, b) => a - b)),
  } as Extract<GameEvent, { type: K }>;
}
