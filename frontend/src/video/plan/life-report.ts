/**
 * 负责将结算播报与同前缀的权威生命提交配对。输入是已校验事件、God事实及导演屏障，输出可安全合段的原事实引用。
 * 不按夜报执行死亡；只有完整同名单、单条或明确同wave才同步揭晓，缺记录、不同波或编辑边界均保持独立。
 */
import type { ReplayEvent, ReplayFact } from "@ai-werewolf-arena/replay-contract";
export function committedLifeReport(
  event: ReplayEvent,
  facts: readonly ReplayFact[],
  enabled: boolean,
): Extract<ReplayFact, { kind: "life_committed" }>[] {
  if (
    !enabled ||
    !["night_resolved", "additional_deaths"].includes(event.type) ||
    !Array.isArray(event.payload.deaths) ||
    !event.payload.deaths.length ||
    !facts.length
  )
    return [];
  const lives = facts.filter(
    (fact): fact is Extract<ReplayFact, { kind: "life_committed" }> =>
      fact.kind === "life_committed",
  );
  const ids = event.payload.deaths;
  if (
    lives.length !== facts.length ||
    new Set(ids).size !== ids.length ||
    lives.length !== ids.length ||
    lives.some(
      (fact) =>
        fact.afterSeq !== event.seq || fact.day !== event.day || !ids.includes(fact.playerId),
    ) ||
    new Set(lives.map((fact) => fact.playerId)).size !== ids.length
  )
    return [];
  if (
    lives.length > 1 &&
    (lives[0]!.waveId === undefined || lives.some((fact) => fact.waveId !== lives[0]!.waveId))
  )
    return [];
  return lives;
}
