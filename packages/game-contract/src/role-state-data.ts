/**
 * Defines pure data structures and finite read views for ordinary private role slots.
 * Inputs are original installation/copy data; outputs preserve policy, nullable
 * selection/history and learned-skill shapes with their existing write contracts.
 * These declarations never validate a role, store live resources, render player
 * facts or grant World/lease/receipt/command authority. Runtime slot and effect
 * owners preserve references; custom initialization keys remain unrestricted.
 */
import type { EntityId } from "./identity";
import type { RoleId } from "./role-ids";
import type { InspectionResult } from "./inspection";
import type { ExileFeedback } from "./events";
import type {
  HunterDeathActionPolicy,
  DeathActionPolicy,
  BeautyDeathLinkPolicy,
  HiddenWolfCampInspectionPolicy,
} from "./boards";

export interface HunterState {
  deathActionPolicy?: HunterDeathActionPolicy;
  canShoot: boolean;
}

export interface WolfKingState {
  deathActionPolicy?: DeathActionPolicy;
  canShoot: boolean;
}

export interface WhiteWolfKingState {
  readonly canDetonate: boolean;
}

export interface KnightState {
  readonly canDuel: boolean;
}

export interface GravekeeperReport extends ExileFeedback {
  receivedDay: number;
}

export interface GravekeeperState {
  history: GravekeeperReport[];
}

export interface WolfBeautyState {
  deathLinkPolicy?: BeautyDeathLinkPolicy;
  targetId: EntityId | null;
  lastActedDay: number | null;
  history: Array<{ day: number; targetId: EntityId | null }>;
}

export interface BearState {
  history: Array<{ day: number; roared: boolean }>;
}

export interface HiddenWolfState {
  readonly hasInheritedKnife: boolean;
  campInspection?: HiddenWolfCampInspectionPolicy;
}

export interface GargoyleState {
  readonly hasInheritedKnife: boolean;
}

export interface IdiotState {
  revealed: boolean;
}

export type MechanicalMode = "kill" | "skill";

export type MechanicalSkill =
  | { kind: "villager" }
  | {
      kind: "inspection";
      history: Array<{
        day: number;
        targetId: EntityId;
        result: Extract<InspectionResult, { kind: "role" }>;
      }>;
    }
  | { kind: "poison"; remaining: 0 | 1 }
  | { kind: "guard"; lastTarget: EntityId | null; lastGuardDay: number | null }
  | { kind: "hunter"; canShoot: boolean; armed: boolean }
  | { kind: "wolf"; extraKnife: "available" | "spent" | "expired" };

export interface MechanicalLearning {
  readonly targetId: EntityId;
  readonly role: RoleId;
  readonly day: number;
  readonly readyOnNight: number;
  readonly skill: MechanicalSkill;
}

export interface MechanicalState {
  learned: MechanicalLearning | null;
  mimicClosedDay: number | null;
  mode: { day: number; kind: MechanicalMode } | null;
  hasInheritedKnife: boolean;
  firstKnifeNight: number | null;
  skillClosedDay: number | null;
}

export type AwakenedSkill =
  | { kind: "villager" }
  | { kind: "inspection"; abilityId: string | null }
  | { kind: "poison"; remaining: 0 | 1 }
  | { kind: "guard"; lastTarget: EntityId | null; lastGuardDay: number | null }
  | { kind: "hunter"; canShoot: boolean; armed: boolean }
  | { kind: "wolf"; extraKnife: "available" | "spent" };

export type AwakenedActiveSkill = Extract<AwakenedSkill, { kind: "poison" | "guard" | "wolf" }>;

export type AwakenedTemplateRole = Extract<
  RoleId,
  "villager" | "mirror_girl" | "witch" | "guard" | "hunter" | "wolf"
>;

export interface AwakenedLearning {
  readonly targetId: EntityId;
  readonly role: AwakenedTemplateRole;
  readonly day: number;
  activationNight: number | null;
  activeFromNight: number | null;
  readonly skill: AwakenedSkill;
}

export interface AwakenedState {
  learned: AwakenedLearning | null;
  mimicClosedDay: number | null;
  skillClosedDay: number | null;
  hasInheritedKnife: boolean;
  firstKnifeNight: number | null;
}

export type MiracleSkill = "check" | "poison" | "guard";

export interface MerchantState {
  remaining: 0 | 1;
  closedDay: number | null;
  choice: { day: number; targetId: number; skill: MiracleSkill } | null;
}

export type BlackMarketSkill = "check" | "poison" | "gun";

export interface BlackMarketState {
  remaining: 0 | 1;
  closedDay: number | null;
  choice: { day: number; targetId: number; skill: BlackMarketSkill } | null;
}

export type HunterReadState = Readonly<HunterState>;
export type WolfKingReadState = Readonly<WolfKingState>;
export type WhiteWolfKingReadState = Readonly<WhiteWolfKingState>;
export type KnightReadState = Readonly<KnightState>;
export type IdiotReadState = Readonly<IdiotState>;
export type HiddenWolfReadState = Readonly<HiddenWolfState>;
export type GargoyleReadState = Readonly<GargoyleState>;
export type BearReadState = { readonly history: readonly Readonly<BearState["history"][number]>[] };
export type WolfBeautyReadState = Readonly<Omit<WolfBeautyState, "history">> & {
  readonly history: readonly Readonly<WolfBeautyState["history"][number]>[];
};
export type GravekeeperReadReport = Readonly<Omit<GravekeeperReport, "result">> & {
  readonly result: Readonly<GravekeeperReport["result"]>;
};
export type GravekeeperReadState = { readonly history: readonly GravekeeperReadReport[] };
export type MechanicalReadSkill =
  | Readonly<
      Extract<MechanicalSkill, { kind: "villager" | "poison" | "guard" | "hunter" | "wolf" }>
    >
  | (Readonly<Omit<Extract<MechanicalSkill, { kind: "inspection" }>, "history">> & {
      readonly history: readonly (Readonly<
        Omit<Extract<MechanicalSkill, { kind: "inspection" }>["history"][number], "result">
      > & {
        readonly result: Readonly<
          Extract<MechanicalSkill, { kind: "inspection" }>["history"][number]["result"]
        >;
      })[];
    });
export type MechanicalReadLearning = Readonly<Omit<MechanicalLearning, "skill">> & {
  readonly skill: MechanicalReadSkill;
};
export type MechanicalReadState = Readonly<Omit<MechanicalState, "learned" | "mode">> & {
  readonly learned: MechanicalReadLearning | null;
  readonly mode: Readonly<NonNullable<MechanicalState["mode"]>> | null;
};
export type AwakenedReadSkill = Readonly<AwakenedSkill>;
export type AwakenedReadActiveSkill = Extract<
  AwakenedReadSkill,
  { kind: "poison" | "guard" | "wolf" }
>;
export type AwakenedReadLearning = Readonly<Omit<AwakenedLearning, "skill">> & {
  readonly skill: AwakenedReadSkill;
};
export type AwakenedReadState = Readonly<Omit<AwakenedState, "learned">> & {
  readonly learned: AwakenedReadLearning | null;
};
export type MerchantReadState = Readonly<Omit<MerchantState, "choice">> & {
  readonly choice: Readonly<NonNullable<MerchantState["choice"]>> | null;
};
export type BlackMarketReadState = Readonly<Omit<BlackMarketState, "choice">> & {
  readonly choice: Readonly<NonNullable<BlackMarketState["choice"]>> | null;
};
