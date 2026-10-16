/**
 * 负责 God 事实流的公开录制准入；输入为可选数组及原事件数，输出保持提交顺序的脱离副本。
 * 事实序号独立连续，afterSeq 单调且不越过已录原事件；缺字段的历史档保持无事实，不猜测覆盖。
 */
import {
  readReplayFact,
  type ReplayFact,
  type ReplayFactLog,
} from "@ai-werewolf-arena/game-contract";
import { assertField, isRecord } from "./validation";
export type {
  ReplayFact,
  ReplayFactPayload,
  ReplayFactCoverage,
  ReplayFactLog,
} from "@ai-werewolf-arena/game-contract";
export { readReplayFact } from "@ai-werewolf-arena/game-contract";

export function readReplayFacts(value: unknown, eventCount: number): ReplayFact[] {
  assertField(Array.isArray(value), "facts");
  let afterSeq = 0;
  return value.map((entry, index) => {
    const fact = readReplayFact(entry);
    assertField(
      !!fact && fact.seq === index + 1 && fact.afterSeq >= afterSeq && fact.afterSeq <= eventCount,
      `facts[${index}]`,
    );
    afterSeq = fact.afterSeq;
    return fact;
  });
}
/** coverage 与流必须成对出现；新档空流仍声明完整死亡提交覆盖，旧档不补写。 */
export function readReplayFactLog(
  value: Record<string, unknown>,
  eventCount: number,
): ReplayFactLog | undefined {
  if (value.facts === undefined && value.factCoverage === undefined) return undefined;
  assertField(
    isRecord(value.factCoverage) &&
      value.factCoverage.committedDeaths === 1 &&
      Object.keys(value.factCoverage).length === 1,
    "factCoverage",
  );
  return { factCoverage: { committedDeaths: 1 }, facts: readReplayFacts(value.facts, eventCount) };
}
