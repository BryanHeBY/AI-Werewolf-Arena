/**
 * 负责定义白天流水线消费的中断窗口契约。输入保留原请求工厂、行动者、配置、当前性
 * 与提交回调，输出分别为自爆选择、决斗结果或是否跳过普通发言。
 * 本契约只有窄类型视图，不拥有具体角色状态、窗口许可、付款、阶段变化或判胜；
 * 窗口返回候选或接受结果，不表示后续死亡链和终局已经完成。
 */
import type { ReadonlyBoardConfig } from "@ai-werewolf-arena/game-contract";
import type {
  ActionProvider,
  ActionWindow,
  EntityId,
  KnightDuelCommit,
  KnightDuelSelection,
  KnightDuelWindow,
  Phase,
  SelfDestructSelection,
} from "../../core/domain/model";
import type { GameActionRequestFactory } from "./action_request_factory";

export interface DaytimeSelfDestructOpportunity {
  execute(
    requests: GameActionRequestFactory,
    provider: ActionProvider,
    window: ActionWindow,
    phase: Phase,
    isCurrent?: () => boolean,
    commit?: (choice: SelfDestructSelection) => Promise<void | boolean>,
  ): Promise<SelfDestructSelection | null>;
}

export interface DaytimeDuelOpportunity {
  execute(
    config: ReadonlyBoardConfig,
    requests: GameActionRequestFactory,
    provider: ActionProvider,
    window: KnightDuelWindow,
    isCurrent: () => boolean,
    commit?: (choice: KnightDuelSelection) => Promise<KnightDuelCommit>,
  ): Promise<{ selection: KnightDuelSelection | null; endsDay: boolean }>;
}

export interface DaytimeDebateOpportunity {
  execute(
    config: ReadonlyBoardConfig,
    requests: GameActionRequestFactory,
    provider: ActionProvider,
    targetId: EntityId,
    day: number,
    isCurrent: () => boolean,
  ): Promise<{ skipSpeech: boolean }>;
}

/** 三个端口仍是原窗口实例；不绑定 execute 或复制返回值，原方法接收者保持不变。 */
export interface DaytimeInterruptionComposition {
  /** 每次执行最先检查重入；不能用 isCurrent=false 绕过仍开启的辩论。 */
  assertEntry(): void;
  readonly selfDestruct: DaytimeSelfDestructOpportunity;
  readonly duel: DaytimeDuelOpportunity;
  readonly debate: DaytimeDebateOpportunity;
}
