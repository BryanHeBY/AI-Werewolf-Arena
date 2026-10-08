import { COMPONENT } from "../../../core/domain/components/names";
import type { RoleComponent } from "../../../core/domain/components/role";
import type { EntityId, GameEvent } from "../../../core/domain/model";
import type { World } from "../../../core/domain/world";
import { allNightAbilities, copyAbilityData, type AbilitySource, type NightAbility, type NightAbilityKind, type NightAbilityStates } from "./abilities";

export interface AbilityGrant<K extends NightAbilityKind> {
  id: string; kind: K; state: NightAbilityStates[K]; source: Extract<AbilitySource, { kind: "gift" | "copy" }>;
  startsOnDay: number; expiresAfterDay?: number; maxUses: number | null;
  sourceDisclosed?: boolean;
}
const roleOf = (world: World, actorId: EntityId): RoleComponent => {
  const role = world.getComponent<RoleComponent>(actorId, COMPONENT.Role);
  if (!role) throw new Error("ability_actor_missing");
  return role;
};
const emit = (events: GameEvent[], actorId: EntityId, ability: NightAbility, operation: "granted" | "disabled" | "enabled" | "transferred_out") => events.push({ timestamp: Date.now(), type: "ability_changed", payload: {
  actorId, abilityId: ability.id, kind: ability.kind, operation, source: structuredClone(ability.source),
  sourceDisclosed: ability.sourceDisclosed,
  startsOnDay: ability.startsOnDay, ...(ability.expiresAfterDay === undefined ? {} : { expiresAfterDay: ability.expiresAfterDay }), maxUses: ability.maxUses,
} });

/** Rule code supplies the state/resource policy explicitly; no target history is copied implicitly. */
export function grantNightAbility<K extends NightAbilityKind>(world: World, actorId: EntityId, input: AbilityGrant<K>, events: GameEvent[]): NightAbility<K> {
  if (input.source.kind !== "gift" && input.source.kind !== "copy") throw new Error("ability_grant_source_invalid");
  const ability = copyAbilityData({ ...input, sourceDisclosed: input.sourceDisclosed ?? false, uses: 0, lastUsedDay: null, disabled: false }) as unknown as NightAbility<K>;
  return installAbility(world, actorId, ability, events) as NightAbility<K>;
}

function installAbility(world: World, actorId: EntityId, ability: NightAbility, events: GameEvent[]): NightAbility {
  const input = ability;
  const source = input.source;
  if (source.kind === "native") throw new Error("ability_grant_source_invalid");
  const role = roleOf(world, actorId);
  if (!/^[a-z][a-z0-9:_-]{0,127}$/.test(input.id) || input.id.startsWith("native:") ||
      !Number.isSafeInteger(input.startsOnDay) || input.startsOnDay < 1 ||
      (input.expiresAfterDay !== undefined && (!Number.isSafeInteger(input.expiresAfterDay) || input.expiresAfterDay < input.startsOnDay)) ||
      (input.maxUses !== null && (!Number.isSafeInteger(input.maxUses) || input.maxUses < 0))) throw new Error("ability_grant_invalid");
  roleOf(world, source.actorId);
  if (allNightAbilities(role).some(ability => ability.id === input.id) || ((role.privateState.retiredAbilityIds ?? []) as string[]).includes(input.id)) throw new Error("ability_id_duplicate");
  if (source.kind !== "gift" && !allNightAbilities(roleOf(world, source.actorId)).some(ability => ability.id === source.abilityId && ability.kind === input.kind)) throw new Error("ability_source_mismatch");
  const stored = (role.privateState.abilities ??= {}) as Record<string, NightAbility>;
  stored[ability.id] = ability;
  emit(events, actorId, ability, "granted");
  return ability;
}

export function setNightAbilityEnabled(world: World, actorId: EntityId, id: string, enabled: boolean, events: GameEvent[]): void {
  const ability = allNightAbilities(roleOf(world, actorId)).find(ability => ability.id === id);
  if (!ability) throw new Error("ability_instance_missing");
  if (ability.disabled === !enabled) return;
  ability.disabled = !enabled; emit(events, actorId, ability, enabled ? "enabled" : "disabled");
}

/** Validate destination before removing the old owner; preserve counters and the current night. */
export function transferNightAbility<K extends NightAbilityKind>(world: World, fromId: EntityId, toId: EntityId, id: string, targetId: string, events: GameEvent[], options: {
  kind: K;
  statePolicy: (state: Readonly<NightAbilityStates[K]>) => NightAbilityStates[K];
  sourceDisclosed?: boolean;
}): void {
  if (fromId === toId) throw new Error("ability_transfer_same_owner");
  const source = roleOf(world, fromId), ability = allNightAbilities(source).find(ability => ability.id === id);
  if (!ability) throw new Error("ability_instance_missing");
  if (!options || options.kind !== ability.kind || typeof options.statePolicy !== "function") throw new Error("ability_transfer_policy_required");
  const targetState = options.statePolicy(copyAbilityData(ability.state) as NightAbilityStates[K]);
  // Transfer preserves resources. The policy can reset inspection knowledge;
  // it cannot refill potions or clear a protection cooldown.
  if (ability.kind === "guard" && (targetState as NightAbilityStates["guard"]).lastTarget !== ability.state.lastTarget) throw new Error("ability_transfer_resources_changed");
  if (ability.kind === "dream" && ((targetState as NightAbilityStates["dream"]).lastTarget !== ability.state.lastTarget || (targetState as NightAbilityStates["dream"]).lastDay !== ability.state.lastDay)) throw new Error("ability_transfer_resources_changed");
  if (ability.kind === "potion" && ["heal", "poison", "selfHealRule", "canSelfHeal", "healUsedThisNight", "poisonUsedThisNight"].some(key => (targetState as unknown as Record<string, unknown>)[key] !== (ability.state as unknown as Record<string, unknown>)[key])) throw new Error("ability_transfer_resources_changed");
  const received = copyAbilityData({ ...ability, state: targetState, id: targetId, sourceDisclosed: options.sourceDisclosed ?? false, source: { kind: "transfer", actorId: fromId, abilityId: id } }) as NightAbility;
  installAbility(world, toId, received, events);
  delete (source.privateState.abilities as Record<string, NightAbility>)[id];
  ((source.privateState.retiredAbilityIds ??= []) as string[]).push(id);
  emit(events, fromId, ability, "transferred_out");
}
