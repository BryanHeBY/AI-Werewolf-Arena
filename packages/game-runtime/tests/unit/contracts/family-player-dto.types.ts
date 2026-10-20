/**
 * 单元编译边界测试验证贵族／秘密之身与炼金／狼鸦五个纯 DTO 的公共所有者。
 * 输入为原完整形状、运行政策常量的字面类型及旧出口；输出是双向类型兼容与旧出口拒绝。
 * 原外层只读、嵌套可写和 nullable 字段分别检查；不运行投影、库存、reader 或模型，
 * 也不把类型接受当作知识通知、冻结或行动许可。
 */
import type {
  NobleKnowledge,
  SecretBodyKnowledge,
  NoblePlayerState,
  SecretBodyPlayerState,
  NobleBodyNightNotice,
} from "@ai-werewolf-arena/game-contract/facts/noble-secret-body";
import type {
  PlayerAlchemistState,
  PlayerRavenState,
} from "@ai-werewolf-arena/game-contract/facts/mist-raven";
import type { BoardConfig } from "@ai-werewolf-arena/game-contract/boards";
import type { MIST_RAVEN_POLICY } from "../../../src/features/mist-raven/state";

// @ts-expect-error 玩家纯结构已归公共事实契约，旧运行投影叶不再转发。
import type { NoblePlayerState as RetiredNoble } from "../../../src/features/noble-secret-body/player-projection";
// @ts-expect-error 玩家纯结构已归公共事实契约，旧运行投影叶不再转发。
import type { SecretBodyPlayerState as RetiredBody } from "../../../src/features/noble-secret-body/player-projection";
// @ts-expect-error 通知纯结构已归公共事实契约，旧运行投影叶不再转发。
import type { NobleBodyNightNotice as RetiredNotice } from "../../../src/features/noble-secret-body/player-projection";
// @ts-expect-error 既有知识类型退出旧转发入口，直接消费其原公共所有者。
import type { NobleKnowledge as RetiredNobleKnowledge } from "../../../src/features/noble-secret-body/player-projection";
// @ts-expect-error 既有知识类型退出旧转发入口，直接消费其原公共所有者。
import type { SecretBodyKnowledge as RetiredBodyKnowledge } from "../../../src/features/noble-secret-body/player-projection";
// @ts-expect-error 玩家纯结构已归公共事实契约，旧运行投影叶不再转发。
import type { PlayerAlchemistState as RetiredAlchemist } from "../../../src/features/mist-raven/player-projection";
// @ts-expect-error 玩家纯结构已归公共事实契约，旧运行投影叶不再转发。
import type { PlayerRavenState as RetiredRaven } from "../../../src/features/mist-raven/player-projection";

type OriginalBody = Readonly<SecretBodyKnowledge & { awaitingNightReport: boolean }>;
type OriginalNoble = Readonly<NobleKnowledge & { awaitingNightReport: boolean }>;
type OriginalNotice =
  | Readonly<{ kind: "secret_body"; actorId: number; day: number; known: SecretBodyKnowledge }>
  | Readonly<{ kind: "night_noble"; actorId: number; day: number; known: NobleKnowledge }>;
interface OriginalAlchemist {
  policy: typeof MIST_RAVEN_POLICY;
  mistRemaining: number;
  healRemaining: number;
  mistHistory: Array<{ day: number; targetIds: number[] | null }>;
  healHistory: Array<{ day: number; targetId: number | null }>;
}
interface OriginalRaven {
  policy: typeof MIST_RAVEN_POLICY;
  awakened: boolean;
  extraRemaining: number;
  knownTeammateIds: number[];
  extraHistory: Array<{ day: number; targetId: number | null }>;
}
type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
type Expect<T extends true> = T;

export type OriginalAndPublicShapes = [
  Expect<Equal<OriginalBody, SecretBodyPlayerState>>,
  Expect<Equal<OriginalNoble, NoblePlayerState>>,
  Expect<Equal<OriginalNotice, NobleBodyNightNotice>>,
  Expect<Equal<OriginalAlchemist, PlayerAlchemistState>>,
  Expect<Equal<OriginalRaven, PlayerRavenState>>,
  Expect<Equal<NonNullable<BoardConfig["mistRaven"]>["policy"], typeof MIST_RAVEN_POLICY>>,
  Expect<OriginalBody extends SecretBodyPlayerState ? true : false>,
  Expect<SecretBodyPlayerState extends OriginalBody ? true : false>,
  Expect<OriginalNoble extends NoblePlayerState ? true : false>,
  Expect<NoblePlayerState extends OriginalNoble ? true : false>,
  Expect<OriginalNotice extends NobleBodyNightNotice ? true : false>,
  Expect<NobleBodyNightNotice extends OriginalNotice ? true : false>,
  Expect<OriginalAlchemist extends PlayerAlchemistState ? true : false>,
  Expect<PlayerAlchemistState extends OriginalAlchemist ? true : false>,
  Expect<OriginalRaven extends PlayerRavenState ? true : false>,
  Expect<PlayerRavenState extends OriginalRaven ? true : false>,
];

// 旧名字实际使用，避免以 noUnused 导入错误冒充旧出口退休证明。
export type RetiredProjectionExits = [
  RetiredNoble,
  RetiredBody,
  RetiredNotice,
  RetiredNobleKnowledge,
  RetiredBodyKnowledge,
  RetiredAlchemist,
  RetiredRaven,
];

/** 只被类型检查：保原外层只读，嵌套契约和 Mist DTO 的可写性不静默加强。 */
export function checkOriginalMutability(
  noble: NoblePlayerState,
  body: SecretBodyPlayerState,
  alchemist: PlayerAlchemistState,
  raven: PlayerRavenState,
): void {
  // @ts-expect-error 原 Noble 外层只读。
  noble.awaitingNightReport = false;
  // @ts-expect-error 原 SecretBody 外层只读。
  body.resource = "spent";
  // @ts-expect-error 原 readonly contracts 数组不能追加，但成员并非深只读。
  noble.contracts.push({
    id: "x",
    targetId: 2,
    createdNight: 1,
    expiresNight: 2,
    status: { kind: "pending" },
  });
  noble.contracts[0]!.status = { kind: "pending" };
  alchemist.policy = "awa_mist_raven_v1";
  alchemist.mistHistory.push({ day: 1, targetIds: null });
  alchemist.healHistory.push({ day: 1, targetId: null });
  raven.knownTeammateIds.push(2);
  raven.extraHistory.push({ day: 1, targetId: null });
}
