import type { EntityId } from "../../../core/domain/model";
import type { World } from "../../../core/domain/world";
import type { RoleComponent } from "../../../core/domain/components/role";
import { COMPONENT } from "../../../core/domain/components/names";
import { allNightAbilities, type NightAbility } from "./abilities";

export type NightActionKind = "check" | "poison" | "guard";
export interface OwnNightAction { readonly day: number; readonly kind: NightActionKind; readonly targetId: EntityId; readonly lucky: boolean; readonly recipientPolicy?: "lucky" | "black_market" }
const histories = new WeakMap<World, Map<EntityId, OwnNightAction[]>>();

/** Only accepted effects enter this ledger, never attempted actions or another actor's targets. */
export function recordOwnNightAction(world: World, actorId: EntityId, day: number, kind: NightActionKind, targetId: EntityId, lucky: boolean, recipientPolicy: "lucky" | "black_market" = "lucky"): void {
  let actors = histories.get(world);
  if (!actors) { actors = new Map(); histories.set(world, actors); }
  const previous = actors.get(actorId) ?? [];
  actors.set(actorId, [...previous.filter(row => row.day >= day - 1), { day, kind, targetId, lucky, ...(lucky ? { recipientPolicy } : {}) }]);
}

export function ownNightActions(world: World, actorId: EntityId, day: number): OwnNightAction[] {
  return (histories.get(world)?.get(actorId) ?? []).filter(row => row.day >= day - 1 && row.day <= day).map(row => ({ ...row }));
}

/** This policy is actor-local even when an expired/spent lucky instance has been transferred away. */
export function luckyTargetAllowed(world: World, actorId: EntityId, ability: NightAbility, day: number, kind: NightActionKind, targetId: EntityId): boolean {
  const history = ownNightActions(world, actorId, day);
  const role = world.getComponent<RoleComponent>(actorId, COMPONENT.Role);
  const abilityKind = kind === "check" ? "seer_check" : kind === "poison" ? "potion" : "guard";
  const hasPolicy = (ability.activation === "lucky" || ability.activation === "black_market") || allNightAbilities(role).some(a => a.kind === abilityKind && (a.activation === "lucky" || a.activation === "black_market")) || history.some(row => row.kind === kind && row.lucky);
  if (!hasPolicy) return true;
  if ((ability.activation === "lucky" || ability.activation === "black_market") && kind === "check" && targetId === actorId) return false;
  return !history.some(row => row.kind === kind && row.targetId === targetId && (row.day === day || kind === "guard" && row.day === day - 1));
}
