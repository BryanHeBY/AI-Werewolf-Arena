/**
 * Defines pure data structures for the seven existing night ability payloads.
 * Inputs are installation data or finite read aliases; outputs preserve their
 * original metadata, nullable fields, optional policies and nested readonly views.
 * These types never store live resources, validate data, apply defaults or grant
 * World, lease, receipt or action authority. Feature state commands and player
 * redaction remain their runtime owners; custom profile private keys stay open.
 */
import type { EntityId, Role, WitchSelfHealRule } from "./identity";
import type { InspectionResult } from "./inspection";
import type {
  SeerTargetPolicy,
  SeerActionPolicy,
  InspectionPolicy,
  GuardRepeatPolicy,
  WitchKnifeVisibilityPolicy,
  WitchPotionPolicy,
  DreamProtectionPolicy,
} from "./boards";
import type { FRAGRANT_PAIR_POLICY, FragrantPair } from "./facts/fragrant-pair-seer";

/** The runtime policy constant remains at its feature owner. */
type RadiantEclipsePolicy = "awa_radiant_eclipse_v1";

export interface SeerState {
  targetPolicy?: SeerTargetPolicy;
  actionPolicy?: SeerActionPolicy;
  lastTarget: EntityId | null;
  lastIsWerewolf: boolean | null;
  lastResult?: InspectionResult | null;
  history: Array<{
    targetId: EntityId;
    isWerewolf: boolean;
    result?: InspectionResult;
  }>;
}

export type SeerReadState = Readonly<Omit<SeerState, "lastResult" | "history">> & {
  readonly lastResult?: Readonly<NonNullable<SeerState["lastResult"]>> | null;
  readonly history: readonly (Readonly<Omit<SeerState["history"][number], "result">> & {
    readonly result?: Readonly<NonNullable<SeerState["history"][number]["result"]>>;
  })[];
};

export interface RoleInspectionState {
  inspectionPolicy?: InspectionPolicy;
  policy?: RoleInspectionPolicy;
  lastTarget: EntityId | null;
  lastDay: number | null;
  history: Array<{
    day: number;
    targetId: EntityId;
    result: Extract<InspectionResult, { kind: "role" }>;
  }>;
}

export type RoleInspectionReadState = Readonly<Omit<RoleInspectionState, "history">> & {
  readonly history: readonly (Readonly<Omit<RoleInspectionState["history"][number], "result">> & {
    readonly result: Readonly<RoleInspectionState["history"][number]["result"]>;
  })[];
};

export interface GuardState {
  readonly lastTarget: EntityId | null;
  repeatPolicy?: GuardRepeatPolicy;
}

export type GuardReadState = Readonly<GuardState>;

export interface WitchState {
  knifeVisibility?: WitchKnifeVisibilityPolicy;
  potionPolicy?: WitchPotionPolicy;
  /** Terminal pass or completed second turn, never exposed through the player DTO. */
  potionTurnClosedDay?: number;
  heal: number;
  poison: number;
  selfHealRule: WitchSelfHealRule;
  canSelfHeal: boolean;
  healUsedThisNight: boolean;
  poisonUsedThisNight: boolean;
}

export type WitchReadState = Readonly<WitchState>;

export interface DreamerState {
  protectionPolicy?: DreamProtectionPolicy;
  lastTarget: EntityId | null;
  lastDay: number | null;
  history: Array<{ day: number; targetId: EntityId }>;
}

export type DreamerReadState = Readonly<Omit<DreamerState, "history">> & {
  readonly history: readonly Readonly<DreamerState["history"][number]>[];
};

export type Pair = FragrantPair;

export interface PairCheck {
  day: number;
  targetIds: Pair;
  containsWerewolf: boolean;
}

export interface PairSeerState {
  policy: typeof FRAGRANT_PAIR_POLICY;
  history: readonly PairCheck[];
}

export interface EclipseSuppression {
  policy: RadiantEclipsePolicy;
  day: number;
}

export interface ShelterState {
  policy: RadiantEclipsePolicy;
  lastTarget: number | null;
  lastDay: number | null;
}

export interface NightAbilityStates {
  pair_check: PairSeerState;
  shelter: ShelterState;
  seer_check: SeerState;
  role_check: RoleInspectionState;
  guard: GuardState;
  potion: WitchState;
  dream: DreamerState;
}

export type RoleInspectionPolicy = "gargoyle" | "psychic" | "mirror" | "pure_white" | "wolf_witch";

export type NightAbilityKind = keyof NightAbilityStates;

export type AbilitySource =
  | { kind: "native"; role: Role }
  | { kind: "gift"; actorId: EntityId }
  | { kind: "copy"; actorId: EntityId; abilityId: string }
  | { kind: "transfer"; actorId: EntityId; abilityId: string };

export interface NightAbilityReadStates {
  pair_check: Readonly<Omit<PairSeerState, "history">> & {
    readonly history: readonly (Readonly<Omit<PairSeerState["history"][number], "targetIds">> & {
      readonly targetIds: Readonly<PairSeerState["history"][number]["targetIds"]>;
    })[];
  };
  shelter: Readonly<NightAbilityStates["shelter"]>;
  seer_check: SeerReadState;
  role_check: RoleInspectionReadState;
  guard: GuardReadState;
  potion: WitchReadState;
  dream: DreamerReadState;
}

export type NightAbilityReadState<K extends NightAbilityKind = NightAbilityKind> =
  NightAbilityReadStates[K];
