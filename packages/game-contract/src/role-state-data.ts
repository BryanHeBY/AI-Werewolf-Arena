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

/** 原生枪、决斗与自爆的资源标记由各族写入；可选死亡政策缺省时，资格解释仍归原调用方。 */
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

/** 放逐反馈保留当时捕获的标签；receivedDay 是收到报告的日期，与反馈中的放逐日分开记录。 */
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

/** 咆哮历史记录已经报告的日次与结果，不包含夜初或黎明的现场存活名单。 */
export interface BearState {
  history: Array<{ day: number; roared: boolean }>;
}

/** 继承刀标记与查验政策分列；是否参与当前狼队聊天、投票或刀口仍由运行查询决定。 */
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

/** kind 区分学习后的实际数据形状；库存、守护上次目标、武装标记与查验历史各保原嵌套可写性。 */
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

/** 交易选择保存目标与技能种类；枪的武装／失效和夜能力实例的来源、次数不存放在这条选择中。 */
export interface BlackMarketState {
  remaining: 0 | 1;
  closedDay: number | null;
  choice: { day: number; targetId: number; skill: BlackMarketSkill } | null;
}

/** 简单槽的读取类型保原字段；历史型槽以下另显式约束行与结果，均不在运行时生成或冻结对象。 */
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

/** 首夜选择与一次库存分别记录；丘比特的 pairIds 是选择数据，原生命关系及 Victory 归属另由关系所有者保存。 */
export interface CupidState {
  policy: CupidPolicy;
  remaining: 0 | 1;
  choice: { day: 1; pairIds: [number, number] } | null;
}

export interface HybridState {
  remaining: 0 | 1;
  choice: { day: number; targetId: number } | null;
}

/** 选择、转换与活跃状态分列；eligibleNight 和 activeFromNight 分别记录资格夜与实际激活夜，可空值不补默认夜号。 */
export interface WildChildState {
  policy: "awa_lui_meme_wild_child_v1";
  remaining: 0 | 1;
  status: "pending" | "chosen" | "transformed" | "active" | "closed";
  choice: { day: 1; targetId: number } | null;
  eligibleNight: number | null;
  activeFromNight: number | null;
}

/** choice 的 0／1 是额外牌槽索引，null 不等于仍有库存；保留原身份与换牌的消费分支由首夜所有者区分。 */
export interface ThiefState {
  policy: "lui_meme_thief_two_extra_villagers_v1";
  remaining: 0 | 1;
  choice: 0 | 1 | null;
}

/** 千面人与盗贼虽有相同字段宽度，政策与消费／失败补偿仍各归本族，不能由数据形状合并。 */
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

/** packReady 与恐惧目标分开记录；已有日次的 null 目标可记录不行动，原历史一致性仍由槽 reader 校验。 */
export interface NightmareShadowState {
  policy: "awa_nightmare_dreamer_v1";
  fearActionPolicy: FearActionPolicy;
  wolfActionPolicy: NightmareWolfActionPolicy;
  packReady: boolean;
  lastDay: number | null;
  lastTarget: EntityId | null;
  history: { day: number; targetId: EntityId | null }[];
}

/** 三种交换历史均保日次和可空目标对；null 记录该次未交换，各族生效阶段与目标映射不由共同形状决定。 */
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

/** triggeredDay 是内部触发日；玩家历史截止日及耗尽的延后披露另由投影计算，不直接公开此字段。 */
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

/** 增强／削弱各有原次数，历史也保留不行动的空选择；碰撞结算读取已提交选择，不凭剩余次数反推结果。 */
export interface ModifierState {
  policy: "awa_scholar_mentor_twelve_v1";
  caster: ModifierCaster;
  remaining: { enhance: number; weaken: number };
  history: ModifierChoice[];
}

/** 有限板规则所用的玩家数据，不携带 World 组件或原生命；名单与选择合法性仍由规则及 frame 在原时点核对。 */
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

/** 自爆日、放逐日与到期已结算标记分别保留；到期死亡和末狼策略仍由原生命周期处理，不在类型中推进。 */
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
