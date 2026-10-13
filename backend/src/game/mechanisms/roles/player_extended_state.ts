/**
 * Defines detached player data structures for advanced role projections.
 * Inputs are explicitly disclosed journal/skill fields; outputs preserve existing
 * copied histories, nullable choices and player-visible stock metadata.
 * These DTOs keep their original write contracts and never expose live role,
 * lease or private slot authority; projection/validation stays at its owner.
 */

import type { GravekeeperReport } from "@ai-werewolf-arena/game-contract";
import type { HiddenWolfCampInspectionPolicy } from "../../../core/domain/board";
import type { InspectionResult, RoleId } from "@ai-werewolf-arena/game-catalog";

/** Public player-state contracts are independent of mutable engine storage types. */
export interface PlayerGravekeeperState {
  history: GravekeeperReport[];
}
export interface PlayerCupidState {
  policy: import("../../../core/domain/board").CupidPolicy;
  remaining: 0 | 1;
  choice: { day: 1; pairIds: [number, number] } | null;
}
export interface PlayerHybridState {
  remaining: 0 | 1;
  choice: { day: number; targetId: number } | null;
}
export interface PlayerMerchantState {
  remaining: 0 | 1;
  closedDay: number | null;
  choice: { day: number; targetId: number; skill: "check" | "poison" | "guard" } | null;
}
export interface PlayerBlackMarketState {
  remaining: 0 | 1;
  closedDay: number | null;
  choice: { day: number; targetId: number; skill: "check" | "poison" | "gun" } | null;
}
export type PlayerMechanicalSkill =
  | { kind: "villager" }
  | {
      kind: "inspection";
      history: Array<{
        day: number;
        targetId: number;
        result: Extract<InspectionResult, { kind: "role" }>;
      }>;
    }
  | { kind: "poison"; remaining: 0 | 1 }
  | { kind: "guard"; lastTarget: number | null; lastGuardDay: number | null }
  | { kind: "hunter"; canShoot: boolean; armed: boolean }
  | { kind: "wolf"; extraKnife: "available" | "spent" | "expired" };
export interface PlayerMechanicalState {
  learned: {
    targetId: number;
    role: RoleId;
    day: number;
    readyOnNight: number;
    skill: PlayerMechanicalSkill;
  } | null;
  mimicClosedDay: number | null;
  mode: { day: number; kind: "kill" | "skill" } | null;
  hasInheritedKnife: boolean;
  firstKnifeNight: number | null;
  skillClosedDay: number | null;
}
export type PlayerAwakenedSkill =
  | { kind: "villager" }
  | { kind: "inspection"; abilityId: string | null }
  | { kind: "poison"; remaining: 0 | 1 }
  | { kind: "guard"; lastTarget: number | null; lastGuardDay: number | null }
  | { kind: "hunter"; canShoot: boolean; armed: boolean }
  | { kind: "wolf"; extraKnife: "available" | "spent" };
export interface PlayerAwakenedState {
  learned: {
    targetId: number;
    role: "villager" | "mirror_girl" | "witch" | "guard" | "hunter" | "wolf";
    day: number;
    activationNight: number | null;
    activeFromNight: number | null;
    skill: PlayerAwakenedSkill;
  } | null;
  mimicClosedDay: number | null;
  skillClosedDay: number | null;
  hasInheritedKnife: boolean;
  firstKnifeNight: number | null;
}

export interface PlayerHiddenWolfState {
  hasInheritedKnife: boolean;
  canVoteForKill: boolean;
  campInspection?: HiddenWolfCampInspectionPolicy;
}
