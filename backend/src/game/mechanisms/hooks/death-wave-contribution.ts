/**
 * 负责声明既有死亡 hook 的具名运行扩展：在本次提案的原准备时点运行，实际标死之后发布本族事实。
 * 输入是同一死亡名单、死因、原体查询和夜间保护查询；输出只描述追加原因与公开可见性，
 * 并持有本族发布回调。具体绑定、领取回执、来源政策、夜间旗标和付款留在贡献所有者。
 * 这不是 JSON、权限品牌、资源账本或统一关系规则；失败时首异常向上传播，已经提交的前缀不回滚。
 */
import type {
  DeathCause,
  DeathSources,
  EntityId,
  GameEvent,
} from "@ai-werewolf-arena/game-contract";
import type { World } from "../../../core/domain/world";

/** 查询在原表达式位置读取；World 的原身份供具体权威核对，不复制或冻结运行对象。 */
export interface DeathWaveContributionRuntime {
  readonly world: World;
  readonly events: GameEvent[];
  /** 目标也是惰性查询，保护方法的 callee／receiver 和 World 先读取，随后才读取目标。 */
  blocksNightLinkedDeath(target: () => EntityId): unknown;
}

/** 可信运行描述，不替代标死许可；原因与公开关联分别声明，不统一不同关系的来源政策。 */
export interface LinkedDeathDescription {
  readonly targetId: EntityId;
  readonly addedCauses: readonly DeathCause[];
  /** 额外纳入公开追加名单；false 不覆盖梦牵连或无枪来源等其它既有公开条件。 */
  readonly publicAdditionalDeath: boolean;
}

/** 原准备步骤完成后的关联；发布回调仍由本族核对实际原生命死亡与已领取回执。 */
export interface PreparedDeathWaveContribution {
  readonly linkedDeaths: readonly LinkedDeathDescription[];
  publishAfterDeaths(): void;
}

/** 同一 hook 的批量贡献，按原 proposal 顺序准备；不能推迟到全部 hooks 聚合完后才执行。 */
export interface DeathWaveContribution {
  prepare(
    runtime: DeathWaveContributionRuntime,
    proposed: EntityId[],
    proposedSources: DeathSources,
    nightTargets: EntityId[],
    allSources: DeathSources,
    nativeHunterShotTargets: ReadonlySet<EntityId>,
    seen: ReadonlySet<EntityId>,
  ): PreparedDeathWaveContribution;
}
