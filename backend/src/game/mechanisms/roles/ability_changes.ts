/**
 * Owns ability grant, installation, enable/expiry and explicit knowledge transfer changes.
 * Inputs are source instances and copied grant data; outputs are stored instances and lifecycle
 * events. Transfer requires its own state policy and never silently clones spent resources or
 * changes the recipient role.
 */
import { isDeepStrictEqual } from "node:util";
import { DREAM_PROTECTION_POLICIES } from "../../../core/domain/board";
import { COMPONENT } from "../../../core/domain/components/names";
import type { RoleComponent } from "../../../core/domain/components/role";
import type { EntityId, GameEvent } from "../../../core/domain/model";
import type { World } from "../../../core/domain/world";
import {
  allNightAbilities,
  copyAbilityData,
  roleInspectionPolicy,
  projectNightState,
  type AbilitySource,
  type NightAbility,
  type NightAbilityKind,
  type NightAbilityStates,
} from "./abilities";
import { captureNightLife, livingNightLife } from "../../../core/domain/night_effects";

export interface AbilityGrant<K extends NightAbilityKind> {
  id: string;
  kind: K;
  state: NightAbilityStates[K];
  source: Extract<AbilitySource, { kind: "gift" | "copy" }>;
  startsOnDay: number;
  expiresAfterDay?: number;
  maxUses: number | null;
  sourceDisclosed?: boolean;
  activation?: "lucky" | "black_market";
}
const roleOf = (world: World, actorId: EntityId): RoleComponent => {
  const role = world.getComponent(actorId, COMPONENT.Role);
  if (!role) throw new Error("ability_actor_missing");
  return role;
};
const emit = (
  events: GameEvent[],
  actorId: EntityId,
  ability: NightAbility,
  operation: "granted" | "disabled" | "enabled" | "transferred_out",
) =>
  events.push({
    timestamp: Date.now(),
    type: "ability_changed",
    payload: {
      actorId,
      abilityId: ability.id,
      kind: ability.kind,
      operation,
      source: structuredClone(ability.source),
      sourceDisclosed: ability.sourceDisclosed,
      startsOnDay: ability.startsOnDay,
      ...(ability.expiresAfterDay === undefined
        ? {}
        : { expiresAfterDay: ability.expiresAfterDay }),
      maxUses: ability.maxUses,
    },
  });

/** Rule code supplies the state/resource policy explicitly; no target history is copied implicitly. */
export function grantNightAbility<K extends NightAbilityKind>(
  world: World,
  actorId: EntityId,
  input: AbilityGrant<K>,
  events: GameEvent[],
): NightAbility<K> {
  if (input.kind === "pair_check") throw Error("ability_pair_native_only");
  if (input.source.kind !== "gift" && input.source.kind !== "copy")
    throw new Error("ability_grant_source_invalid");
  const ability = copyAbilityData({
    ...input,
    sourceDisclosed: input.sourceDisclosed ?? false,
    uses: 0,
    lastUsedDay: null,
    disabled: false,
  }) as unknown as NightAbility<K>;
  return installAbility(world, actorId, ability, events) as NightAbility<K>;
}

function installAbility(
  world: World,
  actorId: EntityId,
  ability: NightAbility,
  events: GameEvent[],
): NightAbility {
  const input = ability;
  if (input.kind === "pair_check") throw Error("ability_pair_native_only");
  if (input.kind === "role_check") roleInspectionPolicy(input.state);
  if (
    input.kind === "dream" &&
    input.state.protectionPolicy !== undefined &&
    !DREAM_PROTECTION_POLICIES.includes(input.state.protectionPolicy)
  )
    throw new Error("ability_dream_policy_invalid");
  const source = input.source;
  if (
    input.kind === "role_check" &&
    roleInspectionPolicy(input.state) === "mirror" &&
    source.kind !== "transfer" &&
    (Object.keys(input.state)
      .filter((key) => key !== "inspectionPolicy")
      .sort()
      .join() !== "history,lastDay,lastTarget,policy" ||
      input.state.lastTarget !== null ||
      input.state.lastDay !== null ||
      !Array.isArray(input.state.history) ||
      input.state.history.length !== 0 ||
      Object.keys(input.state.history).length !== 0 ||
      input.uses !== 0 ||
      input.lastUsedDay !== null ||
      input.disabled)
  )
    throw new Error("ability_mirror_initial_state_invalid");
  if (source.kind === "native") throw new Error("ability_grant_source_invalid");
  const role = roleOf(world, actorId);
  if (
    !/^[a-z][a-z0-9:_-]{0,127}$/.test(input.id) ||
    input.id.startsWith("native:") ||
    !Number.isSafeInteger(input.startsOnDay) ||
    input.startsOnDay < 1 ||
    (input.expiresAfterDay !== undefined &&
      (!Number.isSafeInteger(input.expiresAfterDay) ||
        input.expiresAfterDay < input.startsOnDay)) ||
    (input.maxUses !== null && (!Number.isSafeInteger(input.maxUses) || input.maxUses < 0))
  )
    throw new Error("ability_grant_invalid");
  roleOf(world, source.actorId);
  if (
    input.activation === "black_market" &&
    (source.kind === "copy" ||
      input.sourceDisclosed !== false ||
      input.id !== "gift:black-market" ||
      role.camp !== "good" ||
      input.startsOnDay < 2)
  )
    throw new Error("ability_black_market_policy_invalid");
  const origin =
    source.kind === "copy"
      ? allNightAbilities(roleOf(world, source.actorId)).find(
          (ability) => ability.id === source.abilityId,
        )
      : undefined;
  if (origin?.activation === "lucky" || origin?.activation === "black_market")
    throw new Error("ability_copy_lucky_not_supported");
  if (
    input.activation !== undefined &&
    (!["lucky", "black_market"].includes(input.activation) ||
      !(
        input.activation === "black_market"
          ? ["seer_check", "potion"]
          : ["seer_check", "potion", "guard"]
      ).includes(input.kind) ||
      input.maxUses !== 1)
  )
    throw new Error("ability_lucky_policy_invalid");
  if (
    allNightAbilities(role).some((ability) => ability.id === input.id) ||
    ((role.privateState.retiredAbilityIds ?? []) as string[]).includes(input.id)
  )
    throw new Error("ability_id_duplicate");
  if (
    source.kind !== "gift" &&
    !allNightAbilities(roleOf(world, source.actorId)).some(
      (ability) => ability.id === source.abilityId && ability.kind === input.kind,
    )
  )
    throw new Error("ability_source_mismatch");
  const stored = (role.privateState.abilities ??= {}) as Record<string, NightAbility>;
  stored[ability.id] = ability;
  emit(events, actorId, ability, "granted");
  return ability;
}

export function setNightAbilityEnabled(
  world: World,
  actorId: EntityId,
  id: string,
  enabled: boolean,
  events: GameEvent[],
): void {
  const ability = allNightAbilities(roleOf(world, actorId)).find((ability) => ability.id === id);
  if (!ability) throw new Error("ability_instance_missing");
  if (enabled && ability.deathExpired) throw new Error("ability_lucky_expired_on_death");
  if (ability.disabled === !enabled) return;
  ability.disabled = !enabled;
  emit(events, actorId, ability, enabled ? "enabled" : "disabled");
}

/** Death expiry follows an instance through revival/transfer; applied night effects remain committed. */
export function expireLuckyAbilitiesOnDeath(
  world: World,
  actorId: EntityId,
  events: GameEvent[],
): void {
  for (const ability of allNightAbilities(world.getComponent(actorId, COMPONENT.Role))) {
    if (
      (ability.activation !== "lucky" && ability.activation !== "black_market") ||
      ability.deathExpired
    )
      continue;
    ability.deathExpired = true;
    ability.disabled = true;
    emit(events, actorId, ability, "disabled");
  }
}

/** Validate destination before removing the old owner; preserve counters and the current night. */
export function transferNightAbility<K extends NightAbilityKind>(
  world: World,
  fromId: EntityId,
  toId: EntityId,
  id: string,
  targetId: string,
  events: GameEvent[],
  options: {
    kind: K;
    statePolicy: (state: Readonly<NightAbilityStates[K]>) => NightAbilityStates[K];
    sourceDisclosed?: boolean;
  },
): void {
  if (fromId === toId) throw new Error("ability_transfer_same_owner");
  const source = roleOf(world, fromId),
    ability = allNightAbilities(source).find((ability) => ability.id === id);
  if (!ability) throw new Error("ability_instance_missing");
  if (ability.kind === "pair_check") throw Error("ability_pair_native_only");
  if (!options || options.kind !== ability.kind || typeof options.statePolicy !== "function")
    throw new Error("ability_transfer_policy_required");
  const black = ability.activation === "black_market",
    target = roleOf(world, toId),
    fromLife = captureNightLife(world, fromId),
    toLife = captureNightLife(world, toId),
    originalState = ability.state,
    originalSource = ability.source,
    sourcePrivate = source.privateState,
    targetPrivate = target.privateState,
    originalRole = source.role,
    targetRole = target.role;
  if (
    black &&
    (!fromLife ||
      !toLife ||
      source.camp !== "good" ||
      target.camp !== "good" ||
      targetId !== id ||
      options.sourceDisclosed === true)
  )
    throw new Error("ability_black_market_transfer_invalid");
  const before = black
    ? copyAbilityData({
        id: ability.id,
        kind: ability.kind,
        source: ability.source,
        startsOnDay: ability.startsOnDay,
        expiresAfterDay: ability.expiresAfterDay,
        maxUses: ability.maxUses,
        uses: ability.uses,
        lastUsedDay: ability.lastUsedDay,
        disabled: ability.disabled,
        deathExpired: ability.deathExpired,
        activation: ability.activation,
        sourceDisclosed: ability.sourceDisclosed,
        state: projectNightState(ability),
      })
    : undefined;
  const targetState = copyAbilityData(
    options.statePolicy(
      copyAbilityData(black ? projectNightState(ability) : ability.state) as NightAbilityStates[K],
    ),
  );
  if (
    black &&
    (options.kind !== ability.kind ||
      options.sourceDisclosed === true ||
      world.getComponent(fromId, COMPONENT.Role) !== source ||
      source.role !== originalRole ||
      source.camp !== "good" ||
      source.privateState !== sourcePrivate ||
      world.getComponent(toId, COMPONENT.Role) !== target ||
      target.role !== targetRole ||
      target.camp !== "good" ||
      target.privateState !== targetPrivate ||
      !livingNightLife(world, fromLife!) ||
      !livingNightLife(world, toLife!) ||
      allNightAbilities(source).find((candidate) => candidate.id === id) !== ability ||
      ability.state !== originalState ||
      ability.source !== originalSource ||
      !isDeepStrictEqual(
        before,
        copyAbilityData({
          id: ability.id,
          kind: ability.kind,
          source: ability.source,
          startsOnDay: ability.startsOnDay,
          expiresAfterDay: ability.expiresAfterDay,
          maxUses: ability.maxUses,
          uses: ability.uses,
          lastUsedDay: ability.lastUsedDay,
          disabled: ability.disabled,
          deathExpired: ability.deathExpired,
          activation: ability.activation,
          sourceDisclosed: ability.sourceDisclosed,
          state: projectNightState(ability),
        }),
      ))
  )
    throw new Error("ability_black_market_transfer_revoked");
  if (
    (ability.activation === "lucky" || ability.activation === "black_market") &&
    !isDeepStrictEqual(targetState, black ? projectNightState(ability) : ability.state)
  )
    throw new Error("ability_transfer_lucky_state_changed");
  // Transfer preserves resources. A seer_check policy may reset knowledge;
  // role_check retains its full history, and other policies cannot refill resources.
  if (
    ability.kind === "guard" &&
    (targetState as NightAbilityStates["guard"]).lastTarget !== ability.state.lastTarget
  )
    throw new Error("ability_transfer_resources_changed");
  if (
    ability.kind === "dream" &&
    ((targetState as NightAbilityStates["dream"]).lastTarget !== ability.state.lastTarget ||
      (targetState as NightAbilityStates["dream"]).lastDay !== ability.state.lastDay ||
      (targetState as NightAbilityStates["dream"]).protectionPolicy !==
        ability.state.protectionPolicy)
  )
    throw new Error("ability_transfer_resources_changed");
  if (
    ability.kind === "potion" &&
    [
      "heal",
      "poison",
      "selfHealRule",
      "canSelfHeal",
      "healUsedThisNight",
      "poisonUsedThisNight",
    ].some(
      (key) =>
        (targetState as unknown as Record<string, unknown>)[key] !==
        (ability.state as unknown as Record<string, unknown>)[key],
    )
  )
    throw new Error("ability_transfer_resources_changed");
  if (ability.kind === "role_check" && !isDeepStrictEqual(targetState, ability.state))
    throw new Error("ability_transfer_role_inspection_history_changed");
  const received = copyAbilityData({
    ...ability,
    state: targetState,
    id: targetId,
    sourceDisclosed: options.sourceDisclosed ?? false,
    source: { kind: "transfer", actorId: fromId, abilityId: id },
  }) as NightAbility;
  installAbility(world, toId, received, events);
  delete (source.privateState.abilities as Record<string, NightAbility>)[id];
  ((source.privateState.retiredAbilityIds ??= []) as string[]).push(id);
  emit(events, fromId, ability, "transferred_out");
}
