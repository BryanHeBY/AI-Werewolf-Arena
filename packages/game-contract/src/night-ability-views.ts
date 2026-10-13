/**
 * 负责夜能力共同元数据、玩家能力 DTO 和自身已接受夜行动记录的纯数据契约。
 * 输入来自后端实例类型及显式玩家投影，输出保留原字段、可选／可空值与七种 kind/state 关联；
 * 本文件唯一拥有这些共同字段和公共类型，不反向依赖后端、World、角色 authority 或词典。
 * 字段可写声明保持原结构；数据、status 与行动历史都不授予库存写权、窗口许可或付款证明。
 */
import type { EntityId } from "./identity";
import type {
  AbilitySource,
  EclipseSuppression,
  NightAbilityKind,
  PairSeerState,
  ShelterState,
} from "./night-ability-data";
import type {
  PlayerDreamerState,
  PlayerGuardState,
  PlayerRoleInspectionState,
  PlayerSeerState,
  PlayerWitchState,
} from "./player-state-views";

/** kind 与 payload 由各映射关联；这些共同元数据不创建实例、应用默认值或读取实际库存。 */
export interface NightAbilityMetadata {
  id: string;
  source: AbilitySource;
  /** 内部披露标记；玩家 DTO 不携带它，来源字段仍由运行投影按原政策裁剪。 */
  sourceDisclosed: boolean;
  startsOnDay: number;
  expiresAfterDay?: number;
  maxUses: number | null;
  uses: number;
  lastUsedDay: number | null;
  disabled: boolean;
  /** 本夜有限租约独立持有此阻塞，不能与持久 disabled 旗标合并，也不进入玩家 DTO。 */
  nightSuppression?: EclipseSuppression;
  /** 受赠能力在其专有晚阶段执行；普通实例不带此 activation 政策。 */
  activation?: "lucky" | "black_market";
  /** 实际死亡永久到期受赠实例；转移或复活不恢复该资源。 */
  deathExpired?: boolean;
}

/** 原状态标签仅是投影结果；active 不代替原生命、来源、当前窗口和提交前复验。 */
export type AbilityStatus =
  "pending" | "expired" | "disabled" | "spent" | "used_this_night" | "active";

export interface PlayerNightAbilityStates {
  pair_check: PairSeerState;
  shelter: ShelterState;
  seer_check: PlayerSeerState;
  role_check: PlayerRoleInspectionState;
  guard: PlayerGuardState;
  potion: PlayerWitchState;
  dream: PlayerDreamerState;
}

/** 只取可投影元数据，重建披露后的来源；不继承内部 payload、抑制或披露标记。 */
export type PlayerNightAbility = {
  [K in NightAbilityKind]: Omit<
    NightAbilityMetadata,
    "source" | "sourceDisclosed" | "nightSuppression"
  > & {
    kind: K;
    state: PlayerNightAbilityStates[K];
    source: AbilitySource | { kind: AbilitySource["kind"] };
    status: AbilityStatus;
  };
}[NightAbilityKind];

export type NightActionKind = "check" | "poison" | "guard";

/** 自身已接受行动知识；readonly 保留原记录结构，记录存在不表示伤害、死亡或付款完成。 */
export interface OwnNightAction {
  readonly day: number;
  readonly kind: NightActionKind;
  readonly targetId: EntityId;
  readonly lucky: boolean;
  readonly recipientPolicy?: "lucky" | "black_market";
}
