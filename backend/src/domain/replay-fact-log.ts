/**
 * 负责将真实提交事实关联到本局原事件日志。输入为 owner 提交后的纯数据及原日志；
 * 输出为独立 God-only 流和脱离快照，afterSeq 只记录当时事件数，不插入、改写或重排原事件。
 * WeakMap 不持第二份游戏状态；记录缺省不会解释成保护成功，玩家投影不读取本侧流。
 */
import type { GameEvent } from "./events";
import type { ReplayFactLog, ReplayFactPayload } from "@ai-werewolf-arena/game-contract";
const logs = new WeakMap<readonly GameEvent[], ReplayFactLog>();

export function enableReplayFacts(events: readonly GameEvent[]): void {
  if (!logs.has(events)) logs.set(events, { factCoverage: { committedDeaths: 1 }, facts: [] });
}
/** 仅声明过覆盖的真实 PhaseManager 日志接收；外部手写日志保持原规则测试／注入语义。 */
export function recordReplayFact(events: readonly GameEvent[], payload: ReplayFactPayload): void {
  const log = logs.get(events);
  if (!log) return;
  log.facts.push(
    structuredClone({ ...payload, seq: log.facts.length + 1, afterSeq: events.length }),
  );
}
export function replayFactLog(events: readonly GameEvent[]): ReplayFactLog | undefined {
  const log = logs.get(events);
  return log ? structuredClone(log) : undefined;
}
export function copyReplayFacts(source: readonly GameEvent[], target: readonly GameEvent[]): void {
  const log = replayFactLog(source);
  if (log) logs.set(target, log);
}

/** 库存仅从 owner 已持有状态的自有数据字段捕获，不执行 getter 或用初始 1/1 反算。 */
export function recordPotionStock(
  events: readonly GameEvent[],
  day: number,
  actorId: number,
  abilityId: string,
  state: object,
): void {
  if (!logs.has(events)) return;
  const heal = Object.getOwnPropertyDescriptor(state, "heal"),
    poison = Object.getOwnPropertyDescriptor(state, "poison");
  if (
    !heal ||
    !poison ||
    !("value" in heal) ||
    !("value" in poison) ||
    !Number.isSafeInteger(heal.value) ||
    heal.value < 0 ||
    !Number.isSafeInteger(poison.value) ||
    poison.value < 0
  )
    return;
  recordReplayFact(events, {
    kind: "potion_stock",
    day,
    actorId,
    abilityId,
    heal: heal.value,
    poison: poison.value,
  });
}
export function hasReplayFacts(events: readonly GameEvent[]): boolean {
  return logs.has(events);
}
