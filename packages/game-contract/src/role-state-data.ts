/**
 * 负责普通角色私有槽的纯数据结构与有限只读类型。输入为原安装／复制数据，输出保留
 * 政策、可空选择、历史和学习技能的原可写／只读边界，本契约唯一声明这些公共结构。
 * 声明不验证角色、不保存活跃库存、不渲染玩家知识，也不授予 World、租约、回执或命令权。
 * 原引用、安装校验和生命周期仍归具体状态／效果所有者；这里不新增自定义初始化键的运行限制。
 */
import type { EntityId } from "./identity";
import type { RoleId } from "./role-ids";
import type { InspectionResult } from "./inspection";
import type { ExileFeedback } from "./events";
import type {
  CupidPolicy,
  DebaterPolicy,
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

/** 学习来源标签与 readyOnNight 分列；外层 readonly 不冻结 skill 内库存，实际资格仍由本族晚核。 */
export interface MechanicalLearning {
  readonly targetId: EntityId;
  readonly role: RoleId;
  readonly day: number;
  readonly readyOnNight: number;
  readonly skill: MechanicalSkill;
}

/** 模式、关闭日和继承历史不替代当前请求／生命许可；learned 与 skill 仍是原资源结构。 */
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

/** activationNight 记录激活夜，activeFromNight 记录后续起效夜；可空声明不自动激活或执行技能。 */
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

/** remaining 与 closedDay 分别记录本族库存和流程关闭；choice 为 null 不足以证明可以再交易。 */
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
/** 以下读取类型显式保留原嵌套边界；readonly 只约束类型读取，不复制、深冻结或授予提交权限。 */
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

export interface CupidState {
  policy: CupidPolicy;
  remaining: 0 | 1;
  choice: { day: 1; pairIds: [number, number] } | null;
}

export interface HybridState {
  remaining: 0 | 1;
  choice: { day: number; targetId: number } | null;
}

export interface WildChildState {
  policy: "awa_lui_meme_wild_child_v1";
  remaining: 0 | 1;
  status: "pending" | "chosen" | "transformed" | "active" | "closed";
  choice: { day: 1; targetId: number } | null;
  eligibleNight: number | null;
  activeFromNight: number | null;
}

export interface ThiefState {
  policy: "lui_meme_thief_two_extra_villagers_v1";
  remaining: 0 | 1;
  choice: 0 | 1 | null;
}

export interface ShapeshifterState {
  policy: "awa_netease_shapeshifter_two_extra_villagers_v1";
  remaining: 0 | 1;
  choice: 0 | 1 | null;
}

export interface DebaterState {
  policy: DebaterPolicy;
  remaining: 0 | 1;
  choice: { day: number; targetId: number } | null;
}

export type EvilKnightShotPolicy = "night_shot_immune" | "hunter_shot_bypasses";

export interface EvilKnightState {
  policy: "awa_evil_knight_v1";
  shotPolicy: EvilKnightShotPolicy;
  reflectionRemaining: 0 | 1;
}

export type FearActionPolicy = "optional" | "required_when_legal";

export type NightmareWolfActionPolicy = "standard" | "no_blast_no_self_knife";

export interface NightmareShadowState {
  policy: "awa_nightmare_dreamer_v1";
  fearActionPolicy: FearActionPolicy;
  wolfActionPolicy: NightmareWolfActionPolicy;
  packReady: boolean;
  lastDay: number | null;
  lastTarget: EntityId | null;
  history: { day: number; targetId: EntityId | null }[];
}

export interface MagicianChoice {
  day: number;
  pair: [number, number] | null;
}

export interface MagicianState {
  policy: "awa_magician_wolf_king_v1";
  firstNight: 1 | 2;
  deathShotTargetPolicy: "original" | "exchanged";
  history: MagicianChoice[];
}

export interface TricksterChoice {
  day: number;
  pair: [number, number] | null;
}

export interface TricksterState {
  policy: "awa_trickster_exile_v1";
  history: TricksterChoice[];
}

export interface WolfSorcererChoice {
  day: number;
  pair: [number, number] | null;
}

export interface WolfSorcererState {
  policy: "awa_wolf_sorcerer_seats_v1";
  firstNight: 1 | 2;
  history: WolfSorcererChoice[];
}

export type ReflectionScope = "whole_night" | "first_effect";

export interface TimeConsortChoice {
  day: number;
  targetId: number | null;
}

export interface TimeConsortState {
  policy: "awa_time_consort_reflection_v1";
  reflectionScope: ReflectionScope;
  history: TimeConsortChoice[];
  triggeredDay: number | null;
}

export type ReflectableSkill = "check" | "guard" | "poison";

export type ModifierCaster = "day_scholar" | "night_mentor";

export type ModifierMode = "enhance" | "weaken";

export interface ModifierChoice {
  day: number;
  mode: ModifierMode | null;
  targetId: number | null;
}

export interface ModifierState {
  policy: "awa_scholar_mentor_twelve_v1";
  caster: ModifierCaster;
  remaining: { enhance: number; weaken: number };
  history: ModifierChoice[];
}

export interface ModifierPlayer {
  id: number;
  role: string;
  camp: "good" | "wolf";
  alive: boolean;
}

export interface CommittedModifier {
  actorId: number;
  caster: ModifierCaster;
  mode: ModifierMode;
  targetId: number;
}

/** 增益解析结果包含死亡提案和效果描述；这些数据不直接标死、付款或取代原体回执。 */
export interface ModifierResolution {
  pendingDeaths: number[];
  conflict: "same_good" | "both_wolves" | null;
  goodEffects: Array<{ targetId: number; role: "seer" | "guard" | "witch"; mode: ModifierMode }>;
  bonusKnifeActorId: number | null;
  blockWolfKnife: boolean;
}

export interface LonelyGirlState {
  policy: "awa_netease_lonely_girl_v1";
  remaining: 0 | 1;
  choice: { day: 1; targetId: number } | null;
}

export type LastWolfBlastPolicy = "ends_game" | "forbidden";

export interface RedMoonState {
  policy: "awa_red_moon_demon_v1";
  lastWolfBlastPolicy: LastWolfBlastPolicy;
  blastDay: number | null;
  exileDay: number | null;
  expirySettled: boolean;
}

export type CupidReadState = Readonly<Omit<CupidState, "choice">> & {
  readonly choice: { readonly day: 1; readonly pairIds: readonly [number, number] } | null;
};
export type HybridReadState = Readonly<Omit<HybridState, "choice">> & {
  readonly choice: { readonly day: number; readonly targetId: number } | null;
};
export type WildChildReadState = Readonly<Omit<WildChildState, "choice">> & {
  readonly choice: { readonly day: 1; readonly targetId: number } | null;
};
export type ThiefReadState = Readonly<ThiefState>;
export type ShapeshifterReadState = Readonly<ShapeshifterState>;
export type DebaterReadState = Readonly<Omit<DebaterState, "choice">> & {
  readonly choice: { readonly day: number; readonly targetId: number } | null;
};
export type EvilKnightReadState = Readonly<EvilKnightState>;
export type NightmareShadowReadState = Readonly<Omit<NightmareShadowState, "history">> & {
  readonly history: readonly Readonly<NightmareShadowState["history"][number]>[];
};
export type MagicianReadChoice = Readonly<Omit<MagicianChoice, "pair">> & {
  readonly pair: readonly [number, number] | null;
};
export type MagicianReadState = Readonly<Omit<MagicianState, "history">> & {
  readonly history: readonly MagicianReadChoice[];
};
export type TricksterReadChoice = Readonly<Omit<TricksterChoice, "pair">> & {
  readonly pair: readonly [number, number] | null;
};
export type TricksterReadState = Readonly<Omit<TricksterState, "history">> & {
  readonly history: readonly TricksterReadChoice[];
};
export type WolfSorcererReadChoice = Readonly<Omit<WolfSorcererChoice, "pair">> & {
  readonly pair: readonly [number, number] | null;
};
export type WolfSorcererReadState = Readonly<Omit<WolfSorcererState, "history">> & {
  readonly history: readonly WolfSorcererReadChoice[];
};
export type TimeConsortReadState = Readonly<Omit<TimeConsortState, "history">> & {
  readonly history: readonly Readonly<TimeConsortChoice>[];
};
export type ModifierReadState = Readonly<Omit<ModifierState, "remaining" | "history">> & {
  readonly remaining: Readonly<ModifierState["remaining"]>;
  readonly history: readonly Readonly<ModifierChoice>[];
};
export type LonelyGirlReadState = Readonly<Omit<LonelyGirlState, "choice">> & {
  readonly choice: { readonly day: 1; readonly targetId: number } | null;
};
export type RedMoonReadState = Readonly<RedMoonState>;
