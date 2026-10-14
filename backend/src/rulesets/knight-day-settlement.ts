/**
 * 负责骑士原白天提交和死亡前后日裁决的同步组合。输入为原运行查询与选择；输出为原裁决或同提案／元数据引用。
 * 当前性和夜已结算先短路，原资源与事件提交仍归骑士；无原型元数据仅含原execution，不隐式带夜保护。
 * 只有原提案成立才yield一次，经理在原点await真实死亡；失败不恢复，成功后才复查current、调用经理判胜并读endsDay。
 * 不标死、改阶段或缓存库存，也不添加Promise／许可；后项失败保已付资源和已发表事实。
 */
import { Phase, type KnightDuelSelection, type KnightDuelCommit, type GameEvent } from "../core/domain/model";
import type { World } from "../core/domain/world";
import { commitKnightDuel } from "../game/mechanisms/roles/knight/ports";

/** 原回调和成员在实际位置才读取；只声明所需接口，不把只读类型当运行权限隔离。 */
export interface KnightDaySettlementRuntime {
  readonly world: World;
  readonly events: GameEvent[];
  readonly isCurrent: () => boolean;
  readonly nightSettled: boolean;
  readonly dayRevision: number;
  checkResult(): boolean;
}

/** 只持原引用，不读duel字段、不复制或序列化；执行包保原null prototype和单一execution字段。 */
export interface KnightDayDeathStep {
  readonly duel: NonNullable<ReturnType<typeof commitKnightDuel>>;
  readonly duelMetadata: { execution: { phaseRevision: number } };
}

/** yield先于原DR等待；经理只在原resolve成功后恢复，current失败先于判胜和endsDay读取。 */
export function* settleKnightDay(
  runtime: KnightDaySettlementRuntime,
  choice: KnightDuelSelection,
): Generator<KnightDayDeathStep, KnightDuelCommit, void> {
  if (!runtime.isCurrent() || !runtime.nightSettled) return "rejected";
  const duel = commitKnightDuel(runtime.world, choice, Phase.Day, runtime.events);
  if (!duel) return "rejected";
  // 原决斗没有 nightEffects；新元数据包无原型，不让缺项读取继承的回调／保护 getter。
  const duelMetadata = Object.create(null) as { execution: { phaseRevision: number } };
  duelMetadata.execution = { phaseRevision: runtime.dayRevision };
  yield { duel, duelMetadata };
  if (!runtime.isCurrent()) return "terminal";
  if (runtime.checkResult()) return "terminal";
  return duel.endsDay ? "night" : "continue";
}
