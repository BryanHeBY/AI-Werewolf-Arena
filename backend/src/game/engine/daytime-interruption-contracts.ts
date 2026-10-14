/**
 * 负责定义白天流水线消费的中断窗口契约。输入只要求同步 create 的请求端口、行动者、配置、当前性
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
import type { ActionRequestConstructionPort } from "../../core/domain/actions";

/** 提交回调返回 false 则继续下一候选；无回调时只返回选择，付款与标死仍归原提交／结算路径。 */
export interface DaytimeSelfDestructOpportunity {
  execute(
    requests: ActionRequestConstructionPort,
    provider: ActionProvider,
    window: ActionWindow,
    phase: Phase,
    isCurrent?: () => boolean,
    commit?: (choice: SelfDestructSelection) => Promise<void | boolean>,
  ): Promise<SelfDestructSelection | null>;
}

/** 回调虽在类型中可选，实际有效决斗候选缺回调仍报原错误；endsDay 来自原提交结果。 */
export interface DaytimeDuelOpportunity {
  execute(
    config: ReadonlyBoardConfig,
    requests: ActionRequestConstructionPort,
    provider: ActionProvider,
    window: KnightDuelWindow,
    isCurrent: () => boolean,
    commit?: (choice: KnightDuelSelection) => Promise<KnightDuelCommit>,
  ): Promise<{ selection: KnightDuelSelection | null; endsDay: boolean }>;
}

/** 辩论结果只决定是否跳过原普通发言；密封票、处罚、付款与关闭仍归实际窗口及其权威。 */
export interface DaytimeDebateOpportunity {
  execute(
    config: ReadonlyBoardConfig,
    requests: ActionRequestConstructionPort,
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
  /** readonly 限制成员重绑定，不冻结原窗口或将执行方法与接收者分离。 */
  readonly selfDestruct: DaytimeSelfDestructOpportunity;
  readonly duel: DaytimeDuelOpportunity;
  readonly debate: DaytimeDebateOpportunity;
}
