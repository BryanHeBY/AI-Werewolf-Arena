import { scholarMentorBlocks } from "./scholar_mentor/night_frame";
import { readShelterState } from "./radiant_eclipse/state";
import { nightmareFearBlocks } from "./nightmare_shadow/night_frame";
import { INSPECTION_POLICIES } from "../../../core/domain/board";
import { nativePotionSecondTurn } from "./witch/policies";
import { Role, type EntityId, type EventPayloadMap } from "../../../core/domain/model";
import type { RoleComponent } from "../../../core/domain/components/role";
import type {
  GuardState,
  SeerState,
  WitchState,
  DreamerState,
  RoleInspectionState,
} from "./private_state";
import { COMPONENT } from "../../../core/domain/components/names";
import {
  projectDreamerState,
  projectGuardState,
  projectRoleInspectionState,
  projectSeerState,
  projectWitchState,
  type PlayerDreamerState,
  type PlayerGuardState,
  type PlayerRoleInspectionState,
  type PlayerSeerState,
  type PlayerWitchState,
} from "./player_state";
export { projectRoleInspectionState, projectSeerState, projectWitchState } from "./player_state";
import type { World } from "../../../core/domain/world";

export interface NightAbilityStates {
  shelter: import("./radiant_eclipse/state").ShelterState;
  seer_check: SeerState;
  role_check: RoleInspectionState;
  guard: GuardState;
  potion: WitchState;
  dream: DreamerState;
}
export type RoleInspectionPolicy = "gargoyle" | "psychic" | "mirror" | "pure_white" | "wolf_witch";
export const ROLE_INSPECTION_POLICY_ROLES: Readonly<Record<RoleInspectionPolicy, Role>> = {
  gargoyle: Role.Gargoyle,
  psychic: Role.Psychic,
  mirror: Role.MirrorGirl,
  pure_white: Role.PureWhiteGirl,
  wolf_witch: Role.WolfWitch,
};
export function roleInspectionPolicy(state: RoleInspectionState): RoleInspectionPolicy {
  if (state.inspectionPolicy !== undefined && !INSPECTION_POLICIES.includes(state.inspectionPolicy))
    throw new Error("role_inspection_configuration_policy_invalid");
  const policy = state.policy === undefined ? "gargoyle" : state.policy;
  if (
    policy !== "gargoyle" &&
    policy !== "psychic" &&
    policy !== "mirror" &&
    policy !== "pure_white" &&
    policy !== "wolf_witch"
  )
    throw new Error("role_inspection_policy_invalid");
  return policy;
}

export type NightAbilityKind = keyof NightAbilityStates;
function projectShelterState(value: unknown) {
  const state = readShelterState(value);
  if (!state) throw new Error("radiant_shelter_state_invalid");
  return state;
}
export type AbilitySource =
  | { kind: "native"; role: Role }
  | { kind: "gift"; actorId: EntityId }
  | { kind: "copy"; actorId: EntityId; abilityId: string }
  | { kind: "transfer"; actorId: EntityId; abilityId: string };
/** Reveal only the fields authorized by this source's declared kind. */
export function projectAbilitySource(
  origin: EventPayloadMap["ability_changed"]["source"],
  disclosed: boolean,
): EventPayloadMap["ability_changed"]["source"] | { kind: AbilitySource["kind"] } {
  return !disclosed
    ? { kind: origin.kind }
    : origin.kind === "native"
      ? { kind: origin.kind, role: origin.role }
      : origin.kind === "gift"
        ? { kind: origin.kind, actorId: origin.actorId }
        : { kind: origin.kind, actorId: origin.actorId, abilityId: origin.abilityId };
}
type NightAbilityUnion = {
  [P in NightAbilityKind]: {
    id: string;
    kind: P;
    state: NightAbilityStates[P];
    source: AbilitySource;
    sourceDisclosed: boolean;
    startsOnDay: number;
    expiresAfterDay?: number;
    maxUses: number | null;
    uses: number;
    lastUsedDay: number | null;
    disabled: boolean;
    /** A finite night lease owns this blocker independently of persistent disablement. */
    nightSuppression?: import("./radiant_eclipse/state").EclipseSuppression;
    /** Miracle gifts act in their own late slot; ordinary instances omit this policy. */
    activation?: "lucky" | "black_market";
    /** An actual death permanently expires a lucky gift, including after transfer/revival. */
    deathExpired?: boolean;
  };
}[NightAbilityKind];
export type NightAbility<K extends NightAbilityKind = NightAbilityKind> = Extract<
  NightAbilityUnion,
  { kind: K }
>;
export type AbilityStatus =
  "pending" | "expired" | "disabled" | "spent" | "used_this_night" | "active";

export interface PlayerNightAbilityStates {
  shelter: import("./radiant_eclipse/state").ShelterState;
  seer_check: PlayerSeerState;
  role_check: PlayerRoleInspectionState;
  guard: PlayerGuardState;
  potion: PlayerWitchState;
  dream: PlayerDreamerState;
}
/** The DTO contract matches its explicit projection, including already-known dream history. */
export function projectNightState(
  ability: NightAbility,
): PlayerNightAbilityStates[NightAbilityKind] {
  switch (ability.kind) {
    case "shelter":
      return projectShelterState(ability.state);
    case "seer_check":
      return projectSeerState(ability.state);
    case "potion":
      return projectWitchState(ability.state);
    case "role_check":
      return projectRoleInspectionState(ability.state);
    case "guard":
      return projectGuardState(ability.state);
    case "dream":
      return projectDreamerState(ability.state);
  }
}

/** Preserve valid JSON facts; optional undefined fields are absent on disk. */
export function copyAbilityData<T>(value: T): T {
  const result = structuredClone(value),
    ancestors = new WeakSet<object>();
  const visit = (item: unknown): void => {
    if (item === null || typeof item === "string" || typeof item === "boolean") return;
    if (typeof item === "number" && Number.isFinite(item)) return;
    if (typeof item !== "object" || !item || ancestors.has(item))
      throw new Error("ability_state_not_json");
    ancestors.add(item);
    if (Array.isArray(item)) {
      for (let index = 0; index < item.length; index++) {
        if (!Object.hasOwn(item, index)) throw new Error("ability_state_not_json");
        visit(item[index]);
      }
    } else {
      const prototype = Object.getPrototypeOf(item);
      if (prototype !== Object.prototype && prototype !== null)
        throw new Error("ability_state_not_json");
      for (const [key, entry] of Object.entries(item)) {
        if (entry === undefined) delete (item as Record<string, unknown>)[key];
        else visit(entry);
      }
    }
    ancestors.delete(item);
  };
  visit(result);
  return result;
}

/** The only resource owner is this player's stored instance; no parallel role state. */
export function allNightAbilities(role: RoleComponent | undefined): NightAbility[] {
  const stored = role?.privateState.abilities as Record<string, NightAbility> | undefined;
  return stored
    ? Object.values(stored).sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    : [];
}

/** Malformed or accessor blockers stay disabled without executing foreign getters. */
function nightAbilityDisabled(ability: NightAbility): boolean {
  const blocker = Object.getOwnPropertyDescriptor(ability, "nightSuppression");
  return ability.disabled || (!!blocker && (!("value" in blocker) || blocker.value !== undefined));
}

export function abilityStatus(ability: NightAbility, day: number): AbilityStatus {
  if (nightAbilityDisabled(ability) || ability.deathExpired) return "disabled";
  if (day < ability.startsOnDay) return "pending";
  if (ability.expiresAfterDay !== undefined && day > ability.expiresAfterDay) return "expired";
  if (ability.maxUses !== null && ability.uses >= ability.maxUses) return "spent";
  if (
    ability.lastUsedDay === day &&
    !(ability.kind === "potion" && nativePotionSecondTurn(ability, day))
  )
    return "used_this_night";
  if (
    ability.kind === "potion" &&
    ability.source.kind === "native" &&
    ability.source.role === Role.Witch &&
    ability.state.potionPolicy === "awa_both_native_experimental_v1" &&
    ability.state.potionTurnClosedDay === day
  )
    return "used_this_night";
  return "active";
}

export function findNightAbility<K extends NightAbilityKind>(
  role: RoleComponent | undefined,
  kind: K,
  id?: string,
): NightAbility<K> | undefined {
  const candidates = allNightAbilities(role).filter(
    (ability): ability is NightAbility<K> => ability.kind === kind,
  );
  if (id !== undefined) return candidates.find((ability) => ability.id === id);
  // Legacy callers select the native instance, or one unambiguous granted one.
  return (
    candidates.find((ability) => ability.source.kind === "native") ??
    (candidates.length === 1 ? candidates[0] : undefined)
  );
}

export function activeNightAbility<K extends NightAbilityKind>(
  role: RoleComponent | undefined,
  kind: K,
  day: number,
  id?: string,
): NightAbility<K> | undefined {
  const ability = findNightAbility(role, kind, id);
  return ability && abilityStatus(ability, day) === "active" ? ability : undefined;
}

export function installNativeAbility<K extends NightAbilityKind>(
  role: RoleComponent,
  kind: K,
  state: NightAbilityStates[K],
): NightAbilityStates[K] {
  const ownedState = copyAbilityData(state);
  if (kind === "role_check") roleInspectionPolicy(ownedState as RoleInspectionState);
  const stored = (role.privateState.abilities ??= {}) as Record<string, NightAbility>;
  const retired = (role.privateState.retiredAbilityIds ?? []) as string[];
  const baseId = `native:${kind}`;
  let id = baseId,
    revision = 1;
  while (retired.includes(id)) id = `${baseId}:${++revision}`;
  const existing = stored[id];
  if (existing) {
    if (
      existing.kind !== kind ||
      existing.source.kind !== "native" ||
      existing.source.role !== role.role
    )
      throw new Error("ability_native_binding_conflict");
    existing.state = ownedState;
  } else {
    stored[id] = {
      id,
      kind,
      state: ownedState,
      source: { kind: "native", role: role.role },
      sourceDisclosed: true,
      startsOnDay: 1,
      maxUses: null,
      uses: 0,
      lastUsedDay: null,
      disabled: false,
    } as NightAbility;
  }
  return ownedState;
}

export function recordNightAbilityUse(ability: NightAbility, day: number, consumed: boolean): void {
  if (abilityStatus(ability, day) !== "active") throw new Error("ability_not_active");
  ability.lastUsedDay = day;
  if (consumed) ability.uses++;
}

export function nightAbilityActors<K extends NightAbilityKind>(
  world: World,
  kind: K,
  day: number,
): Array<{ actorId: EntityId; ability: NightAbility<K> }> {
  return world
    .getAliveEntityIds()
    .filter((actorId) => !nightmareFearBlocks(world, actorId, day))
    .filter(
      (actorId) =>
        (kind !== "guard" && kind !== "seer_check") ||
        !scholarMentorBlocks(world, day, actorId, kind === "guard" ? "guard" : "check"),
    )
    .flatMap((actorId) =>
      allNightAbilities(world.getComponent<RoleComponent>(actorId, COMPONENT.Role))
        .filter(
          (ability): ability is NightAbility<K> =>
            ability.kind === kind && abilityStatus(ability, day) === "active",
        )
        .map((ability) => ({ actorId, ability })),
    );
}

export type PlayerNightAbility = {
  [K in NightAbilityKind]: Omit<
    NightAbility<K>,
    "source" | "sourceDisclosed" | "state" | "nightSuppression"
  > & {
    state: PlayerNightAbilityStates[K];
    source: AbilitySource | { kind: AbilitySource["kind"] };
    status: AbilityStatus;
  };
}[NightAbilityKind];
export function projectNightAbility(ability: NightAbility, day: number): PlayerNightAbility {
  const metadata = {
    id: ability.id,
    source: projectAbilitySource(ability.source, ability.sourceDisclosed),
    startsOnDay: ability.startsOnDay,
    ...(ability.expiresAfterDay === undefined ? {} : { expiresAfterDay: ability.expiresAfterDay }),
    maxUses: ability.maxUses,
    uses: ability.uses,
    lastUsedDay: ability.lastUsedDay,
    disabled: nightAbilityDisabled(ability),
    ...(ability.activation === undefined ? {} : { activation: ability.activation }),
    ...(ability.deathExpired === undefined ? {} : { deathExpired: ability.deathExpired }),
    status: abilityStatus(ability, day),
  };
  switch (ability.kind) {
    case "shelter":
      return { ...metadata, kind: "shelter", state: projectShelterState(ability.state) };
    case "seer_check":
      return { ...metadata, kind: "seer_check", state: projectSeerState(ability.state) };
    case "potion":
      return { ...metadata, kind: "potion", state: projectWitchState(ability.state) };
    case "role_check":
      return { ...metadata, kind: "role_check", state: projectRoleInspectionState(ability.state) };
    case "guard":
      return { ...metadata, kind: "guard", state: projectGuardState(ability.state) };
    case "dream":
      return { ...metadata, kind: "dream", state: projectDreamerState(ability.state) };
  }
}
