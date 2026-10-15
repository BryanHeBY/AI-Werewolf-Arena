/**
 * 负责赤月延迟到期的完整同步查询、到期前候选和死亡后提交发布。输入为原 World／registry／配置的晚读视图及原日期。
 * 输出仅交出需要追加死亡的原玩家编号，最后返回原胜负候选引用；无候选时才请求死亡，不创建 Promise 或标死。
 * 原生库存和审计仍归猎魔权威。经理持原追加死亡等待、可读性／当前性复验、夜报、封盘与 finally。
 * 只有经理成功完成死亡及复验后才恢复提交；恢复时先核已死，再提交到期、发布事件、记录操作，后项失败保原前缀不退款。
 */
import { bindVictoryQueries } from "./victory/default-specs";
import type {
  ReadonlyBoardConfig,
  VictoryCheckpoint,
  WinDecision,
} from "@ai-werewolf-arena/game-contract";
import { COMPONENT } from "../domain/components/names";
import { DeathCause, Phase, type EntityId, type GameEvent } from "../domain/model";
import type { World } from "../domain/world";
import type { ConditionRegistry } from "../domain/registries/condition-registry";
import { demonRedMoonExpiry, commitDemonRedMoonTransition } from "../features/demon-hunter/ports";
import { TERMINAL_VICTORY_POLICY } from "./terminal-victory-policy";
import { safeRecordLogicOp } from "../recording/session/recorder";

/** 视图只声明晚读成员，保持原引用；不是冻结数据或额外的授权屏障。 */
export interface RedMoonExpiryRuntime {
  readonly world: World;
  readonly events: GameEvent[];
  readonly registry: ConditionRegistry;
  readonly config: ReadonlyBoardConfig;
  readonly checkpoint: VictoryCheckpoint;
}

/**
 * 只在确需到期死亡时 yield 一次原编号。DR 抛错或复验失效时，经理不恢复本序列；
 * 没有原生板子／到期者或已赢候选时直接同步完成，不增加任何 await 或结算回执。
 */
export function* settleRedMoonExpiry(
  runtime: RedMoonExpiryRuntime,
  ownsDemon: boolean,
  nightDay: number,
): Generator<EntityId, WinDecision | null, void> {
  const expiryActor = ownsDemon ? demonRedMoonExpiry(runtime.world, nightDay) : null;
  // 延期的最后一狼仍参与本次普通夜的胜负判断。
  const beforeExpiryResult =
    expiryActor === null
      ? null
      : runtime.registry.evaluateMany(
          bindVictoryQueries(runtime.world),
          TERMINAL_VICTORY_POLICY.conditions({
            world: () => runtime.world,
            config: () => runtime.config,
          }),
          runtime.checkpoint,
        );
  if (expiryActor !== null && !beforeExpiryResult) {
    yield expiryActor;
    if (runtime.world.getComponent(expiryActor, COMPONENT.Alive)?.alive !== false)
      throw new Error("red_moon_expiry_death_unsettled");
    if (!commitDemonRedMoonTransition(runtime.world, expiryActor, "expire", nightDay))
      throw new Error("red_moon_expiry_commit_revoked");
    const fact = { actorId: expiryActor, day: nightDay };
    runtime.events.push({
      timestamp: Date.now(),
      type: "red_moon_delay_expired",
      payload: fact,
    });
    safeRecordLogicOp({
      scope: "resolution",
      op: "red_moon_expiry_settled",
      phase: Phase.Night,
      status: "ok",
      output: { ...fact, cause: DeathCause.RedMoonExpiry },
    });
  }
  return beforeExpiryResult;
}
