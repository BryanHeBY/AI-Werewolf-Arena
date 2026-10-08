import type { EntityId, Role } from "../../../core/domain/model";
import type { RoleComponent } from "../../../core/domain/components/role";
import type { GuardState, SeerState, WitchState, DreamerState,RoleInspectionState } from "./private_state";
import { COMPONENT } from "../../../core/domain/components/names";
import type { World } from "../../../core/domain/world";

export interface NightAbilityStates { seer_check: SeerState;role_check:RoleInspectionState; guard: GuardState; potion: WitchState; dream: DreamerState }
export type NightAbilityKind = keyof NightAbilityStates;
export type AbilitySource =
  | { kind: "native"; role: Role }
  | { kind: "gift"; actorId: EntityId }
  | { kind: "copy"; actorId: EntityId; abilityId: string }
  | { kind: "transfer"; actorId: EntityId; abilityId: string };
type NightAbilityUnion = {
  [P in NightAbilityKind]: {
    id: string; kind: P; state: NightAbilityStates[P]; source: AbilitySource; sourceDisclosed: boolean;
    startsOnDay: number; expiresAfterDay?: number; maxUses: number | null;
    uses: number; lastUsedDay: number | null; disabled: boolean;
  }
}[NightAbilityKind];
export type NightAbility<K extends NightAbilityKind = NightAbilityKind> = Extract<NightAbilityUnion, { kind: K }>;
export type AbilityStatus = "pending" | "expired" | "disabled" | "spent" | "used_this_night" | "active";

/** Preserve valid JSON facts; optional undefined fields are absent on disk. */
export function copyAbilityData<T>(value: T): T {
  const result = structuredClone(value), ancestors = new WeakSet<object>();
  const visit = (item: unknown): void => {
    if (item === null || typeof item === "string" || typeof item === "boolean") return;
    if (typeof item === "number" && Number.isFinite(item)) return;
    if (typeof item !== "object" || !item || ancestors.has(item)) throw new Error("ability_state_not_json");
    ancestors.add(item);
    if (Array.isArray(item)) {
      for (let index = 0; index < item.length; index++) {
        if (!Object.hasOwn(item, index)) throw new Error("ability_state_not_json");
        visit(item[index]);
      }
    }
    else {
      const prototype = Object.getPrototypeOf(item);
      if (prototype !== Object.prototype && prototype !== null) throw new Error("ability_state_not_json");
      for (const [key, entry] of Object.entries(item)) {
        if (entry === undefined) delete (item as Record<string, unknown>)[key]; else visit(entry);
      }
    }
    ancestors.delete(item);
  };
  visit(result); return result;
}

/** The only resource owner is this player's stored instance; no parallel role state. */
export function allNightAbilities(role: RoleComponent | undefined): NightAbility[] {
  const stored = role?.privateState.abilities as Record<string, NightAbility> | undefined;
  return stored ? Object.values(stored).sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0) : [];
}

export function abilityStatus(ability: NightAbility, day: number): AbilityStatus {
  if (ability.disabled) return "disabled";
  if (day < ability.startsOnDay) return "pending";
  if (ability.expiresAfterDay !== undefined && day > ability.expiresAfterDay) return "expired";
  if (ability.maxUses !== null && ability.uses >= ability.maxUses) return "spent";
  if (ability.lastUsedDay === day) return "used_this_night";
  return "active";
}

export function findNightAbility<K extends NightAbilityKind>(role: RoleComponent | undefined, kind: K, id?: string): NightAbility<K> | undefined {
  const candidates = allNightAbilities(role).filter((ability): ability is NightAbility<K> => ability.kind === kind);
  if (id !== undefined) return candidates.find(ability => ability.id === id);
  // Legacy callers select the native instance, or one unambiguous granted one.
  return candidates.find(ability => ability.source.kind === "native") ?? (candidates.length === 1 ? candidates[0] : undefined);
}

export function activeNightAbility<K extends NightAbilityKind>(role: RoleComponent | undefined, kind: K, day: number, id?: string): NightAbility<K> | undefined {
  const ability = findNightAbility(role, kind, id);
  return ability && abilityStatus(ability, day) === "active" ? ability : undefined;
}

export function installNativeAbility<K extends NightAbilityKind>(role: RoleComponent, kind: K, state: NightAbilityStates[K]): NightAbilityStates[K] {
  const ownedState = copyAbilityData(state);
  const stored = (role.privateState.abilities ??= {}) as Record<string, NightAbility>;
  const retired = (role.privateState.retiredAbilityIds ?? []) as string[];
  const baseId = `native:${kind}`;
  let id = baseId, revision = 1;
  while (retired.includes(id)) id = `${baseId}:${++revision}`;
  const existing = stored[id];
  if (existing) {
    if (existing.kind !== kind || existing.source.kind !== "native" || existing.source.role !== role.role) throw new Error("ability_native_binding_conflict");
    existing.state = ownedState;
  } else {
    stored[id] = { id, kind, state: ownedState, source: { kind: "native", role: role.role }, sourceDisclosed: true, startsOnDay: 1, maxUses: null, uses: 0, lastUsedDay: null, disabled: false } as NightAbility;
  }
  return ownedState;
}

export function recordNightAbilityUse(ability: NightAbility, day: number, consumed: boolean): void {
  if (abilityStatus(ability, day) !== "active") throw new Error("ability_not_active");
  ability.lastUsedDay = day;
  if (consumed) ability.uses++;
}

export function nightAbilityActors<K extends NightAbilityKind>(world: World, kind: K, day: number): Array<{ actorId: EntityId; ability: NightAbility<K> }> {
  return world.getAliveEntityIds().flatMap(actorId => allNightAbilities(world.getComponent<RoleComponent>(actorId, COMPONENT.Role))
    .filter((ability): ability is NightAbility<K> => ability.kind === kind && abilityStatus(ability, day) === "active")
    .map(ability => ({ actorId, ability })));
}

export type PlayerNightAbility = {
  [K in NightAbilityKind]: Omit<NightAbility<K>, "source" | "sourceDisclosed"> & { source: AbilitySource | { kind: AbilitySource["kind"] }; status: AbilityStatus }
}[NightAbilityKind];
export function projectNightAbility(ability: NightAbility, day: number): PlayerNightAbility {
  const { sourceDisclosed, source, ...facts } = ability;
  return structuredClone({ ...facts, source: sourceDisclosed ? source : { kind: source.kind }, status: abilityStatus(ability, day) }) as PlayerNightAbility;
}
