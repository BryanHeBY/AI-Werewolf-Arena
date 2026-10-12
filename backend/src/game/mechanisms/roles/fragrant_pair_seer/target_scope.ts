import { types } from "node:util";
import type { World } from "../../../../core/domain/world";
import type { RoleComponent } from "../../../../core/domain/components/role";
import type { CampComponent } from "../../../../core/domain/components/camp";
import {
  aliveLifeDescriptor,
  aliveLifeVersion,
  type AliveComponent,
} from "../../../../core/domain/components/alive";
import { COMPONENT } from "../../../../core/domain/components/names";
import { isRoleId, type RoleId } from "@ai-werewolf-arena/game-catalog";
import { Camp } from "../../../../core/domain/identity";
export interface PairTargetScope {
  readonly id: number;
  readonly life: AliveComponent;
  readonly version: number;
  readonly role: RoleComponent;
  readonly roleId: RoleId;
  readonly roleCamp: Camp;
  readonly camp: CampComponent;
  readonly campValue: Camp;
}
const captured = new WeakMap<PairTargetScope, World>();
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
export function capturePairTarget(world: World, id: number): PairTargetScope | null {
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
export function pairTargetCurrent(world: World, s: PairTargetScope): boolean {
  return (
    captured.get(s) === world &&
    world.getComponent(s.id, COMPONENT.Alive) === s.life &&
    safeAlive(s.life) &&
    aliveLifeVersion(s.life) === s.version &&
    s.life.alive &&
    world.getComponent(s.id, COMPONENT.Role) === s.role &&
    world.getComponent(s.id, COMPONENT.Camp) === s.camp &&
    own(s.role, "role") === s.roleId &&
    own(s.role, "camp") === s.roleCamp &&
    own(s.camp, "camp") === s.campValue
  );
}
/** Both original identities must be live before producing the sole aggregate boolean. */
export function capturedPairContainsWolf(
  world: World,
  targets: readonly PairTargetScope[],
): boolean | null {
  if (
    types.isProxy(targets) ||
    !Array.isArray(targets) ||
    Object.getPrototypeOf(targets) !== Array.prototype
  )
    return null;
  const fields: Record<string, PropertyDescriptor> = Object.getOwnPropertyDescriptors(
    targets as object,
  );
  if (
    Reflect.ownKeys(fields).length !== 3 ||
    fields.length?.value !== 2 ||
    !("value" in (fields["0"] ?? {})) ||
    !("value" in (fields["1"] ?? {}))
  )
    return null;
  const first = fields["0"]!.value as PairTargetScope,
    second = fields["1"]!.value as PairTargetScope;
  if (
    !pairTargetCurrent(world, first) ||
    !pairTargetCurrent(world, second) ||
    first.id === second.id
  )
    return null;
  return first.campValue === Camp.Wolf || second.campValue === Camp.Wolf;
}
