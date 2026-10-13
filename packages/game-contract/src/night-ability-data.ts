/**
 * 负责七种既有夜能力载荷的纯数据结构。输入为安装数据或明确只读类型；输出保留
 * 原元数据、可空字段、可选政策和嵌套只读视图，各结构由本契约唯一声明。
 * 类型不保存实际库存、不校验未知数据、不补默认值，也不授予 World、租约、回执或行动权限。
 * 状态写入和玩家字段裁剪仍归原运行所有者；自定义 profile 的私有扩展键不受本结构约束。
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

/** 这里只声明同一政策的字面类型，运行常量仍归具体机制所有者。 */
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

/** 只读视图显式覆盖历史行及结果；类型限定不生成副本，也不冻结实际对象。 */
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
  /** 不用药终止或第二次行动完成的内部日次，不通过玩家 DTO 公开。 */
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

/** kind 与实际载荷一一对应；资源身份、次数和生命周期元数据在共同能力结构中表达。 */
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

/** 来源字段描述实例来历；玩家是否可知由投影裁剪，来源数据本身不能授权复制或转移。 */
export type AbilitySource =
  | { kind: "native"; role: Role }
  | { kind: "gift"; actorId: EntityId }
  | { kind: "copy"; actorId: EntityId; abilityId: string }
  | { kind: "transfer"; actorId: EntityId; abilityId: string };

/** 保留原深只读边界，包括 Pair 的历史行和目标对；读取类型不替代所属实例或当前请求复验。 */
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
