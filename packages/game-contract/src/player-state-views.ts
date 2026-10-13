/**
 * 负责玩家可见角色、学习技能与赠枪数据的公共结构契约；输入来自各机制显式投影。
 * 输出保留原可选字段、可空选择、历史与库存摘要，本文件是这些 DTO 类型的唯一所有者。
 * 数据不继承可写角色槽、World、回调或许可句柄；字段出现不授予行动，也不证明资源已经消费。
 * 原可写字段声明保持，真正脱离与冻结由观察捕获方执行；这里不读取状态、校验新 schema 或渲染文案。
 */
import type { GravekeeperReport } from "./role-state-data";
import type { HiddenWolfCampInspectionPolicy, GuardRepeatPolicy } from "./boards";
import type { WitchSelfHealRule } from "./identity";
import type { InspectionResult } from "./inspection";
import type { RoleId } from "./role-ids";
import type { DeathGun } from "./death-ability-data";

/** 自身知识、能力与来源分别投影；这些结构不自动公开给其他玩家或复盘展示。 */
export interface PlayerGuardState {
  lastTarget: number | null;
  repeatPolicy?: GuardRepeatPolicy;
}

export interface PlayerHunterState {
  deathActionPolicy?: import("./boards").HunterDeathActionPolicy;
  canShoot: boolean;
}

export interface PlayerWolfKingState {
  deathActionPolicy?: import("./boards").DeathActionPolicy;
  canShoot: boolean;
}

export interface PlayerWhiteWolfKingState {
  canDetonate: boolean;
}

export interface PlayerKnightState {
  canDuel: boolean;
}

export interface PlayerIdiotState {
  revealed: boolean;
}

export interface PlayerDreamerState {
  protectionPolicy?: import("./boards").DreamProtectionPolicy;
  lastTarget: number | null;
  lastDay: number | null;
  history: Array<{ day: number; targetId: number }>;
}

export interface PlayerWolfBeautyState {
  charmAllowed?: boolean;
  linkAllowed?: boolean;
  deathLinkPolicy?: import("./boards").BeautyDeathLinkPolicy;
  targetId: number | null;
  lastActedDay: number | null;
  history: Array<{ day: number; targetId: number | null }>;
}

export interface PlayerBearState {
  history: Array<{ day: number; roared: boolean }>;
}

export interface PlayerSeerState {
  targetPolicy?: import("./boards").SeerTargetPolicy;
  actionPolicy?: import("./boards").SeerActionPolicy;
  lastTarget: number | null;
  lastIsWerewolf: boolean | null;
  lastResult?: InspectionResult | null;
  history: Array<{ targetId: number; isWerewolf: boolean; result?: InspectionResult }>;
}

export interface PlayerWitchState {
  knifeVisibility?: import("./boards").WitchKnifeVisibilityPolicy;
  potionPolicy?: import("./boards").WitchPotionPolicy;
  heal: number;
  poison: number;
  selfHealRule: WitchSelfHealRule;
  canSelfHeal: boolean;
  healUsedThisNight: boolean;
  poisonUsedThisNight: boolean;
}

export interface PlayerRoleInspectionState {
  inspectionPolicy?: import("./boards").InspectionPolicy;
  policy?: "gargoyle" | "psychic" | "mirror" | "pure_white" | "wolf_witch";
  lastTarget: number | null;
  lastDay: number | null;
  history: Array<{
    day: number;
    targetId: number;
    result: Extract<InspectionResult, { kind: "role" }>;
  }>;
}

export type PlayerDeathGun = Omit<DeathGun, "source"> & {
  source: { kind: "gift" | "transfer" };
  status: "pending" | "active" | "spent" | "disabled";
};

export interface PlayerGravekeeperState {
  history: GravekeeperReport[];
}

export interface PlayerCupidState {
  policy: import("./boards").CupidPolicy;
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
