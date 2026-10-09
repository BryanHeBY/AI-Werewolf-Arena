import { COMPONENT } from "../../../core/domain/components/names";
import type { RoleComponent } from "../../../core/domain/components/role";
import { Camp, type EntityId, type GameEvent } from "../../../core/domain/model";
import { aliveLifeVersion, type AliveComponent } from "../../../core/domain/components/alive";
import type { World } from "../../../core/domain/world";
import { RuleError } from "@ai-werewolf-arena/game-catalog";
import type { ValidationRuleContext } from "../validation/contracts";
import type { AbilitySource } from "./abilities";
import { validateDeathShot } from "./death_shot";

/** A passive single-use resource. Night abilities and native role stocks stay separate. */
export interface DeathGun {
  id: string; kind: "gun"; source: Extract<AbilitySource, { kind: "gift" | "transfer" }>;
  sourceDisclosed: false; grantedNight: number; armedOnNight: number | null;
  remaining: 0 | 1; disabled: boolean; deathExpired: boolean;
}
export type PlayerDeathGun = Omit<DeathGun, "source"> & { source: { kind: "gift" | "transfer" }; status: "pending" | "active" | "spent" | "disabled" };
interface GunOwner { world: World; actorId: number; role: RoleComponent; roleKind: RoleComponent["role"]; camp: Camp; privateState: RoleComponent["privateState"]; life: AliveComponent; version: number; id: string; source: DeathGun["source"]; sourceKind: DeathGun["source"]["kind"]; sourceActor: number; sourceId?: string; grantedNight: number; armedOnNight: number | null }
const owners = new WeakMap<DeathGun, GunOwner>(), counters = new WeakMap<World, number>();
export function allDeathGuns(role: RoleComponent | undefined): DeathGun[] { return Object.values((role?.privateState.deathAbilities ?? {}) as Record<string, DeathGun>).sort((a, b) => a.id.localeCompare(b.id)); }
export function findDeathGun(role: RoleComponent | undefined, id: string): DeathGun | undefined { return allDeathGuns(role).find(gun => gun.id === id); }
export function projectDeathGun(gun: DeathGun): PlayerDeathGun {
  return { id: gun.id, kind: "gun", source: { kind: gun.source.kind }, sourceDisclosed: false, grantedNight: gun.grantedNight, armedOnNight: gun.armedOnNight,
    remaining: gun.remaining, disabled: gun.disabled, deathExpired: gun.deathExpired, status: gun.disabled || gun.deathExpired ? "disabled" : gun.remaining === 0 ? "spent" : gun.armedOnNight === null ? "pending" : "active" };
}
function bind(world: World, actorId: number, gun: DeathGun): void {
  const role = world.getComponent<RoleComponent>(actorId, COMPONENT.Role), life = world.getComponent<AliveComponent>(actorId, COMPONENT.Alive), version = life && aliveLifeVersion(life);
  if (!role || role.camp !== Camp.Good || !life?.alive || version === undefined) throw new Error("death_ability_owner_invalid");
  owners.set(gun, { world, actorId, role, roleKind: role.role, camp: role.camp, privateState: role.privateState, life, version, id: gun.id, source: gun.source, sourceKind: gun.source.kind, sourceActor: gun.source.actorId, ...(gun.source.kind === "transfer" ? { sourceId: gun.source.abilityId } : {}), grantedNight: gun.grantedNight, armedOnNight: gun.armedOnNight });
}
export function deathGunOwnerCurrent(world: World, actorId: number, gun: DeathGun, onDeath = false): boolean {
  const owner = owners.get(gun); if (!owner || owner.world !== world || owner.actorId !== actorId) return false;
  const version = aliveLifeVersion(owner.life);
  return gun.id === owner.id && gun.kind === "gun" && gun.source === owner.source && gun.source.kind === owner.sourceKind && gun.source.actorId === owner.sourceActor && (gun.source.kind === "gift" || gun.source.abilityId === owner.sourceId) && gun.sourceDisclosed === false && gun.grantedNight === owner.grantedNight && gun.armedOnNight === owner.armedOnNight && world.getComponent(actorId, COMPONENT.Role) === owner.role && owner.role.role === owner.roleKind && owner.role.camp === owner.camp && owner.role.privateState === owner.privateState &&
    findDeathGun(owner.role, gun.id) === gun && world.getComponent(actorId, COMPONENT.Alive) === owner.life && (onDeath ? !owner.life.alive && version === owner.version + 1 : owner.life.alive && version === owner.version);
}
function emit(events: GameEvent[], actorId: number, gun: Pick<DeathGun, "id" | "grantedNight" | "armedOnNight" | "remaining" | "disabled" | "deathExpired">, operation: "granted" | "armed" | "disabled" | "enabled" | "transferred_out", abilityId = gun.id): void {
  events.push({ timestamp: Date.now(), type: "death_ability_changed", payload: { actorId, abilityId, operation, grantedNight: gun.grantedNight, armedOnNight: gun.armedOnNight, remaining: gun.remaining, disabled: gun.disabled, deathExpired: gun.deathExpired } });
}
export function grantDeathGun(world: World, fromId: EntityId, toId: EntityId, night: number, events: GameEvent[]): DeathGun {
  const from = world.getComponent<RoleComponent>(fromId, COMPONENT.Role), to = world.getComponent<RoleComponent>(toId, COMPONENT.Role);
  if (fromId === toId || !from || from.camp !== Camp.Good || !world.getComponent<AliveComponent>(fromId, COMPONENT.Alive)?.alive || !to || to.camp !== Camp.Good || !world.getComponent<AliveComponent>(toId, COMPONENT.Alive)?.alive || !Number.isSafeInteger(night) || night < 1) throw new Error("death_ability_grant_invalid");
  if (allDeathGuns(to).length) throw new Error("death_ability_gun_already_owned");
  const next = (counters.get(world) ?? 0) + 1, id = `gift-gun:${next}`;
  if ((to.privateState.retiredDeathAbilityIds as string[] | undefined)?.includes(id)) throw new Error("death_ability_id_retired");
  const gun: DeathGun = { id, kind: "gun", source: { kind: "gift", actorId: fromId }, sourceDisclosed: false, grantedNight: night, armedOnNight: null, remaining: 1, disabled: false, deathExpired: false };
  bind(world, toId, gun); const stored = (to.privateState.deathAbilities ??= {}) as Record<string, DeathGun>; stored[id] = gun; counters.set(world, next); emit(events, toId, gun, "granted"); return gun;
}
export function armDeathGun(world: World, actorId: number, gun: DeathGun, night: number, events: GameEvent[]): void {
  if (!Number.isSafeInteger(night) || night < gun.grantedNight) throw new Error("death_ability_activation_invalid");
  if (!deathGunOwnerCurrent(world, actorId, gun) || gun.armedOnNight !== null || gun.disabled || gun.deathExpired || gun.remaining === 0) return;
  gun.armedOnNight = night; owners.get(gun)!.armedOnNight = night; emit(events, actorId, gun, "armed");
}
export function activeDeathGun(world: World, actorId: number, id: string, day: number, onDeath = false): DeathGun | undefined {
  const gun = findDeathGun(world.getComponent<RoleComponent>(actorId, COMPONENT.Role), id);
  return gun && deathGunOwnerCurrent(world, actorId, gun, onDeath) && gun.armedOnNight !== null && gun.armedOnNight <= day && gun.remaining === 1 && !gun.disabled && !gun.deathExpired ? gun : undefined;
}
export function captureDeathGun(world: World, actorId: number, gun: DeathGun, day: number, current: () => boolean) {
  const id = gun.id, kind = gun.kind, source = gun.source, sourceKind = source.kind, sourceActor = source.actorId, sourceId = source.kind === "transfer" ? source.abilityId : undefined;
  const disclosed = gun.sourceDisclosed, granted = gun.grantedNight, armed = gun.armedOnNight;
  const disabled = gun.disabled, expired = gun.deathExpired;
  const isCurrent = () => current() && gun.id === id && gun.kind === kind && gun.source === source && gun.source.kind === sourceKind && gun.source.actorId === sourceActor && (gun.source.kind === "gift" || gun.source.abilityId === sourceId) && gun.sourceDisclosed === disclosed && gun.grantedNight === granted && gun.armedOnNight === armed && gun.disabled === disabled && gun.deathExpired === expired && deathGunOwnerCurrent(world, actorId, gun, true);
  return { isCurrent, isEligible: () => isCurrent() && activeDeathGun(world, actorId, id, day, true) === gun };
}
/** Capture before running death callbacks; permanent expiry cannot revoke the pending shot early. */
export function firstDeathGuns(world: World, actorId: number): Array<{ actorId: number; gun: DeathGun; id: string; grantedNight: number; armedOnNight: number | null }> {
  return allDeathGuns(world.getComponent<RoleComponent>(actorId, COMPONENT.Role)).filter(gun => !gun.deathExpired && deathGunOwnerCurrent(world, actorId, gun, true)).map(gun => ({ actorId, gun, id: gun.id, grantedNight: gun.grantedNight, armedOnNight: gun.armedOnNight }));
}
export function finishDeathGuns(rows: ReturnType<typeof firstDeathGuns>, events: GameEvent[]): void {
  for (const { actorId, gun, id, grantedNight, armedOnNight } of rows) { if (gun.deathExpired) continue; gun.remaining = 0; gun.disabled = true; gun.deathExpired = true; emit(events, actorId, { id, grantedNight, armedOnNight, remaining: 0, disabled: true, deathExpired: true }, "disabled", id); }
}
export function setDeathGunEnabled(world: World, actorId: number, id: string, enabled: boolean, events: GameEvent[]): void {
  const gun = findDeathGun(world.getComponent<RoleComponent>(actorId, COMPONENT.Role), id);
  if (!gun || !deathGunOwnerCurrent(world, actorId, gun)) throw new Error("death_ability_instance_unavailable");
  if (enabled && gun.deathExpired) throw new Error("death_ability_expired");
  if (gun.disabled === !enabled) return; gun.disabled = !enabled; emit(events, actorId, gun, enabled ? "enabled" : "disabled");
}
export function transferDeathGun(world: World, fromId: number, toId: number, id: string, events: GameEvent[]): DeathGun {
  const source = world.getComponent<RoleComponent>(fromId, COMPONENT.Role), target = world.getComponent<RoleComponent>(toId, COMPONENT.Role), gun = findDeathGun(source, id);
  if (!gun || fromId === toId || !deathGunOwnerCurrent(world, fromId, gun) || !target || target.camp !== Camp.Good || !world.getComponent<AliveComponent>(toId, COMPONENT.Alive)?.alive || allDeathGuns(target).length || (target.privateState.retiredDeathAbilityIds as string[] | undefined)?.includes(id)) throw new Error("death_ability_transfer_invalid");
  const received: DeathGun = { ...projectDeathGun(gun), source: { kind: "transfer", actorId: fromId, abilityId: id } }; delete (received as DeathGun & { status?: string }).status;
  bind(world, toId, received); ((target.privateState.deathAbilities ??= {}) as Record<string, DeathGun>)[id] = received;
  delete (source!.privateState.deathAbilities as Record<string, DeathGun>)[id]; ((source!.privateState.retiredDeathAbilityIds ??= []) as string[]).push(id); emit(events, fromId, gun, "transferred_out"); emit(events, toId, received, "granted"); return received;
}
export function copyDeathGun(): never { throw new Error("death_ability_copy_not_supported"); }
export function validateGiftGun(ctx: ValidationRuleContext) {
  if (!ctx.abilityId || ctx.day === undefined) return { code: RuleError.ShootUnavailable };
  return validateDeathShot(ctx, !!activeDeathGun(ctx.world, ctx.actorId, ctx.abilityId, ctx.day, true));
}
