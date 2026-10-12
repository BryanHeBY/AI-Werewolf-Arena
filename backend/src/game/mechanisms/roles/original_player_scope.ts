import { types } from "node:util";
import type { World } from "../../../core/domain/world";
import type { RoleComponent } from "../../../core/domain/components/role";
import type { CampComponent } from "../../../core/domain/components/camp";
import {
  aliveLifeDescriptor,
  aliveLifeVersion,
  type AliveComponent,
} from "../../../core/domain/components/alive";
import { COMPONENT } from "../../../core/domain/components/names";
import { isRoleId, type RoleId } from "@ai-werewolf-arena/game-catalog";
import { Camp } from "../../../core/domain/identity";
export interface OriginalPlayerScope {
  readonly id: number;
  readonly life: AliveComponent;
  readonly version: number;
  readonly role: RoleComponent;
  readonly roleId: RoleId;
  readonly roleCamp: Camp;
  readonly camp: CampComponent;
  readonly campValue: Camp;
}
const captured = new WeakMap<OriginalPlayerScope, World>();
function own(v: object, key: string): unknown {
  if (types.isProxy(v)) return undefined;
  const d = Object.getOwnPropertyDescriptor(v, key);
  return d && "value" in d ? d.value : undefined;
}
function safeAlive(v: AliveComponent | undefined): v is AliveComponent {
  if (!v || types.isProxy(v) || aliveLifeVersion(v) === undefined) return false;
  const original = aliveLifeDescriptor(v),
    actual = Object.getOwnPropertyDescriptor(v, "alive");
  return !!original && !!actual && actual.get === original.get && actual.set === original.set;
}
export function captureOriginalPlayer(world: World, id: number): OriginalPlayerScope | null {
  const life = world.getComponent<AliveComponent>(id, COMPONENT.Alive),
    role = world.getComponent<RoleComponent>(id, COMPONENT.Role),
    camp = world.getComponent<CampComponent>(id, COMPONENT.Camp);
  if (!Number.isSafeInteger(id) || id < 1 || !safeAlive(life) || !life.alive || !role || !camp)
    return null;
  const roleId = own(role, "role"),
    roleCamp = own(role, "camp"),
    campValue = own(camp, "camp");
  if (
    !isRoleId(roleId) ||
    !Object.values(Camp).includes(roleCamp as Camp) ||
    roleCamp !== campValue
  )
    return null;
  const scope = Object.freeze({
    id,
    life,
    version: aliveLifeVersion(life)!,
    role,
    roleId,
    roleCamp: roleCamp as Camp,
    camp,
    campValue: campValue as Camp,
  });
  captured.set(scope, world);
  return scope;
}
/** Paid effects may retain the first original death, never a replacement or revival. */
export function originalPlayerSameLife(
  world: World,
  s: OriginalPlayerScope,
  allowFirstDeath = false,
): boolean {
  return (
    captured.get(s) === world &&
    world.getComponent(s.id, COMPONENT.Alive) === s.life &&
    safeAlive(s.life) &&
    (s.life.alive
      ? aliveLifeVersion(s.life) === s.version
      : allowFirstDeath && aliveLifeVersion(s.life) === s.version + 1) &&
    world.getComponent(s.id, COMPONENT.Role) === s.role &&
    world.getComponent(s.id, COMPONENT.Camp) === s.camp &&
    own(s.role, "role") === s.roleId &&
    own(s.role, "camp") === s.roleCamp &&
    own(s.camp, "camp") === s.campValue
  );
}
export function originalPlayerCurrent(world: World, s: OriginalPlayerScope): boolean {
  return originalPlayerSameLife(world, s);
}
