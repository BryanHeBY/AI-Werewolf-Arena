/**
 * 编译期单元验证夜能力公共契约的唯一字段所有权、七种 kind/state 关联和旧出口退休。
 * 输入为实际 Git 2117e497 的原类型声明与当前声明；输出由编译器检查双向赋值、完整字段
 * 和只读／可选／可空反例；本单元拥有固定旧类型的独立预期，不是第二份生产元数据。
 * 本文件不调用投影、World、账本、模型或资源提交；玩家 status 和数据存在不授予行动权限。
 */
import type {
  AbilitySource,
  EntityId,
  NightAbilityKind,
  NightAbilityStates,
  NightAbilityReadStates,
  PairSeerState,
} from "@ai-werewolf-arena/game-contract";
import type {
  PlayerDreamerState,
  PlayerGuardState,
  PlayerRoleInspectionState,
  PlayerSeerState,
  PlayerWitchState,
} from "@ai-werewolf-arena/game-contract/player-state-views";
import type {
  NightAbilityMetadata,
  AbilityStatus,
  PlayerNightAbilityStates,
  PlayerNightAbility,
  NightActionKind,
  OwnNightAction,
} from "@ai-werewolf-arena/game-contract/night-ability-views";
import type {
  NightAbility,
  NightAbilityReadView,
} from "../../../src/game/mechanisms/roles/abilities";

// 旧类型取自固定 Git 的完整声明；保全部字段与修饰符，不能用新 Metadata 生成旧预期。
type BeforeNightAbilityUnion = {
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
    /** 本夜有限租约独立持有此阻塞，不能与持久 disabled 旗标合并。 */
    nightSuppression?: import("@ai-werewolf-arena/game-contract").EclipseSuppression;
    /** 受赠能力在其专有晚阶段执行；普通实例不带此 activation 政策。 */
    activation?: "lucky" | "black_market";
    /** 实际死亡永久到期受赠实例；转移或复活不恢复该资源。 */
    deathExpired?: boolean;
  };
}[NightAbilityKind];

type BeforeNightAbility<K extends NightAbilityKind = NightAbilityKind> = Extract<
  BeforeNightAbilityUnion,
  { kind: K }
>;

type BeforeNightAbilityReadUnion = {
  [K in NightAbilityKind]: Readonly<
    Omit<BeforeNightAbility<K>, "state" | "source" | "nightSuppression">
  > & {
    readonly state: NightAbilityReadStates[K];
    readonly source: Readonly<AbilitySource>;
    readonly nightSuppression?: Readonly<
      import("@ai-werewolf-arena/game-contract").EclipseSuppression
    >;
  };
}[NightAbilityKind];

type BeforeNightAbilityReadView<K extends NightAbilityKind = NightAbilityKind> = Extract<
  BeforeNightAbilityReadUnion,
  { kind: K }
>;

type BeforeAbilityStatus =
  "pending" | "expired" | "disabled" | "spent" | "used_this_night" | "active";

interface BeforePlayerNightAbilityStates {
  pair_check: PairSeerState;
  shelter: import("@ai-werewolf-arena/game-contract").ShelterState;
  seer_check: PlayerSeerState;
  role_check: PlayerRoleInspectionState;
  guard: PlayerGuardState;
  potion: PlayerWitchState;
  dream: PlayerDreamerState;
}

type BeforePlayerNightAbility = {
  [K in NightAbilityKind]: Omit<
    BeforeNightAbility<K>,
    "source" | "sourceDisclosed" | "state" | "nightSuppression"
  > & {
    state: BeforePlayerNightAbilityStates[K];
    source: AbilitySource | { kind: AbilitySource["kind"] };
    status: BeforeAbilityStatus;
  };
}[NightAbilityKind];

type BeforeNightActionKind = "check" | "poison" | "guard";

interface BeforeOwnNightAction {
  readonly day: number;
  readonly kind: BeforeNightActionKind;
  readonly targetId: EntityId;
  readonly lucky: boolean;
  readonly recipientPolicy?: "lucky" | "black_market";
}

type Flatten<T> = { [P in keyof T]: T[P] };
type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
type Assert<T extends true> = T;
type KindAgreement<K extends NightAbilityKind> = Equal<
  [
    Flatten<BeforeNightAbility<K>>,
    Flatten<BeforeNightAbilityReadView<K>>,
    Flatten<Extract<BeforePlayerNightAbility, { kind: K }>>,
  ],
  [
    Flatten<NightAbility<K>>,
    Flatten<NightAbilityReadView<K>>,
    Flatten<Extract<PlayerNightAbility, { kind: K }>>,
  ]
>;
type AllSevenKinds = [
  Assert<KindAgreement<"pair_check">>,
  Assert<KindAgreement<"shelter">>,
  Assert<KindAgreement<"seer_check">>,
  Assert<KindAgreement<"role_check">>,
  Assert<KindAgreement<"guard">>,
  Assert<KindAgreement<"potion">>,
  Assert<KindAgreement<"dream">>,
];
type MetadataFields = Assert<
  Equal<
    Flatten<NightAbilityMetadata>,
    Flatten<Omit<BeforeNightAbility<"seer_check">, "kind" | "state">>
  >
>;
type PublicFields = [
  Assert<Equal<AbilityStatus, BeforeAbilityStatus>>,
  Assert<Equal<PlayerNightAbilityStates, BeforePlayerNightAbilityStates>>,
  Assert<Equal<NightActionKind, BeforeNightActionKind>>,
  Assert<Equal<OwnNightAction, BeforeOwnNightAction>>,
];
function originalAndCurrentRemainAssignable(
  before: BeforePlayerNightAbility,
  current: PlayerNightAbility,
  beforeLive: BeforeNightAbilityUnion,
  live: NightAbility,
  beforeRead: BeforeNightAbilityReadView,
  read: NightAbilityReadView,
) {
  const currentDto: PlayerNightAbility = before;
  const beforeDto: BeforePlayerNightAbility = current;
  const currentLive: NightAbility = beforeLive;
  const originalLive: BeforeNightAbilityUnion = live;
  const currentRead: NightAbilityReadView = beforeRead;
  const originalRead: BeforeNightAbilityReadView = read;
  void [currentDto, beforeDto, currentLive, originalLive, currentRead, originalRead];
}

function publicDataKeepsOriginalBoundaries(
  player: PlayerNightAbility,
  live: NightAbilityReadView<"potion">,
  action: OwnNightAction,
  metadata: NightAbilityMetadata,
) {
  metadata.sourceDisclosed = true;
  metadata.maxUses = null;
  metadata.lastUsedDay = null;
  metadata.activation = "lucky";
  metadata.deathExpired = false;
  // @ts-expect-error 内部源披露标记不进入玩家 DTO。
  player.sourceDisclosed;
  // @ts-expect-error 临时抑制元数据不进入玩家 DTO。
  player.nightSuppression;
  // @ts-expect-error status 不授予 World 或提交句柄。
  player.world;
  if (player.kind === "potion") {
    player.state.heal--;
    // @ts-expect-error 普通女巫终态关窗字段不属于玩家已知瓶数 DTO。
    player.state.potionTurnClosedDay;
    // @ts-expect-error kind 精确关联状态，药水不能冒充查验历史。
    player.state.history;
  }
  if (player.kind === "seer_check") {
    player.state.lastResult = null;
    player.state.history.push({ targetId: 2, isWerewolf: true });
    // @ts-expect-error 查验 DTO 不含药瓶库存。
    player.state.poison;
  }
  // @ts-expect-error 后端只读视图不提供共同 metadata 写权。
  live.disabled = true;
  // @ts-expect-error 后端 payload 仍深只读。
  live.state.heal = 0;
  // @ts-expect-error 原自身夜行动记录字段仍 readonly。
  action.targetId = 3;
}

// 公共类型改由 package 具名出口唯一拥有；旧叶和三层既有聚合出口都不保留类型桥。
// @ts-expect-error 旧公开类型出口已退休，不从后端聚合类型反导共享包。
import type { AbilityStatus as LeafAbilityStatus } from "../../../src/game/mechanisms/roles/abilities";
// @ts-expect-error 旧公开类型出口已退休，不从后端聚合类型反导共享包。
import type { PlayerNightAbilityStates as LeafPlayerNightAbilityStates } from "../../../src/game/mechanisms/roles/abilities";
// @ts-expect-error 旧公开类型出口已退休，不从后端聚合类型反导共享包。
import type { PlayerNightAbility as LeafPlayerNightAbility } from "../../../src/game/mechanisms/roles/abilities";
// @ts-expect-error 旧公开类型出口已退休，不从后端聚合类型反导共享包。
import type { AbilityStatus as MechanismsAbilityStatus } from "../../../src/game/mechanisms";
// @ts-expect-error 旧公开类型出口已退休，不从后端聚合类型反导共享包。
import type { PlayerNightAbilityStates as MechanismsPlayerNightAbilityStates } from "../../../src/game/mechanisms";
// @ts-expect-error 旧公开类型出口已退休，不从后端聚合类型反导共享包。
import type { PlayerNightAbility as MechanismsPlayerNightAbility } from "../../../src/game/mechanisms";
// @ts-expect-error 旧公开类型出口已退休，不从后端聚合类型反导共享包。
import type { AbilityStatus as GameAbilityStatus } from "../../../src/game";
// @ts-expect-error 旧公开类型出口已退休，不从后端聚合类型反导共享包。
import type { PlayerNightAbilityStates as GamePlayerNightAbilityStates } from "../../../src/game";
// @ts-expect-error 旧公开类型出口已退休，不从后端聚合类型反导共享包。
import type { PlayerNightAbility as GamePlayerNightAbility } from "../../../src/game";
// @ts-expect-error 旧公开类型出口已退休，不从后端聚合类型反导共享包。
import type { AbilityStatus as BackendAbilityStatus } from "../../../src";
// @ts-expect-error 旧公开类型出口已退休，不从后端聚合类型反导共享包。
import type { PlayerNightAbilityStates as BackendPlayerNightAbilityStates } from "../../../src";
// @ts-expect-error 旧公开类型出口已退休，不从后端聚合类型反导共享包。
import type { PlayerNightAbility as BackendPlayerNightAbility } from "../../../src";
// @ts-expect-error 账本只保留运行函数，不保留数据类型兼容出口。
import type { NightActionKind as LedgerNightActionKind } from "../../../src/game/mechanisms/roles/night_action_history";
// @ts-expect-error 账本只保留运行函数，不保留数据类型兼容出口。
import type { OwnNightAction as LedgerOwnNightAction } from "../../../src/game/mechanisms/roles/night_action_history";
type RetiredTypes = [
  LeafAbilityStatus,
  LeafPlayerNightAbilityStates,
  LeafPlayerNightAbility,
  MechanismsAbilityStatus,
  MechanismsPlayerNightAbilityStates,
  MechanismsPlayerNightAbility,
  GameAbilityStatus,
  GamePlayerNightAbilityStates,
  GamePlayerNightAbility,
  BackendAbilityStatus,
  BackendPlayerNightAbilityStates,
  BackendPlayerNightAbility,
  LedgerNightActionKind,
  LedgerOwnNightAction,
];
type AllProofs = [AllSevenKinds, MetadataFields, PublicFields, RetiredTypes];
void (null as unknown as AllProofs);
void originalAndCurrentRemainAssignable;
void publicDataKeepsOriginalBoundaries;
