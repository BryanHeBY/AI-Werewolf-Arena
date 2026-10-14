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

/** 自身知识、能力与来源分别投影，不自动公开给其他玩家；可选政策只保留投影所得字段，不在 DTO 中补默认规则。 */
export interface PlayerGuardState {
  lastTarget: number | null;
  repeatPolicy?: GuardRepeatPolicy;
}

/** 枪、决斗、自爆与翻牌字段是观察时的资源／状态摘要，实际原生命、阶段及目标复验不随 DTO 一起传出。 */
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

/** 自身选择历史与政策，不携带 DreamNightLink 的原生命、已付回调或保护／死亡闭包句柄。 */
export interface PlayerDreamerState {
  protectionPolicy?: import("./boards").DreamProtectionPolicy;
  lastTarget: number | null;
  lastDay: number | null;
  history: Array<{ day: number; targetId: number }>;
}

/** 可选准入标记与自身选择历史分开表达；历史目标并非可调用的死亡连结，也不保存原体绑定。 */
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

/** 验人结果与历史是规则揭示知识，不保证等于目标真实底牌；结构不重新计算查验结果。 */
export interface PlayerSeerState {
  targetPolicy?: import("./boards").SeerTargetPolicy;
  actionPolicy?: import("./boards").SeerActionPolicy;
  lastTarget: number | null;
  lastIsWerewolf: boolean | null;
  lastResult?: InspectionResult | null;
  history: Array<{ targetId: number; isWerewolf: boolean; result?: InspectionResult }>;
}

/** 自身药瓶与当夜标记摘要；不包含内部 potionTurnClosedDay，字段缺省不能证明第二药窗口开放。 */
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

/** 政策与已获知角色结果的摘要；不执行目标、重复或必选政策，也不提供当前查验许可。 */
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

/** 赠枪／转移枪的披露摘要；来源只留 kind，status 不替代实际武装、生命或死亡因果复验。 */
export type PlayerDeathGun = Omit<DeathGun, "source"> & {
  source: { kind: "gift" | "transfer" };
  status: "pending" | "active" | "spent" | "disabled";
};

/** 已接受报告保留放逐日与收到日；投影不重新查验标签，也不把报告变成接收资格。 */
export interface PlayerGravekeeperState {
  history: GravekeeperReport[];
}

/** 自身首夜选择摘要；可写的 pairIds 类型不复用运行关系的原生命句柄或赋予重选权限。 */
export interface PlayerCupidState {
  policy: import("./boards").CupidPolicy;
  remaining: 0 | 1;
  choice: { day: 1; pairIds: [number, number] } | null;
}

export interface PlayerHybridState {
  remaining: 0 | 1;
  choice: { day: number; targetId: number } | null;
}

/** 交易库存、关闭日和已选技能各保原空值；摘要不包含已赠实例的来源证明或库存写权。 */
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

/** kind 保持不同习得技能的字段集合；机械狼的额外刀可到 expired，不能和觉醒技能的两态刀库存混同。 */
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

/** 学习起效夜、模式与关闭日是自身知识；字段存在不代表本夜窗口、来源或库存仍有效。 */
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

/** 激活夜与技能生效夜分列，可空值保持未激活含义；继承刀与习得数据不直接授予夜行动。 */
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

/** 继承刀的历史标记与本次投影所得投票资格分列；实际提交仍重新查询当前实例与狼队政策。 */
export interface PlayerHiddenWolfState {
  hasInheritedKnife: boolean;
  canVoteForKill: boolean;
  campInspection?: HiddenWolfCampInspectionPolicy;
}
