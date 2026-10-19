/**
 * 负责将结算播报与同前缀的权威生命提交配对。输入是已校验事件、God事实及导演屏障，输出可安全合段的原事实引用。
 * 不按夜报执行死亡；只合并事实序列开头完整同名单的单条或同wave死亡，后续连锁波保留独立镜头。
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
  const ids = event.payload.deaths;
  // 同一次结算可紧接魅惑、情侣等连锁波。只匹配连续首波，不能因后续事实存在而退回等待页，
  // 也不能过滤掉夹在前面的其他事实后越过其游标合并。
  const prefix = facts.slice(0, ids.length);
  const lives = prefix.filter(
    (fact): fact is Extract<ReplayFact, { kind: "life_committed" }> =>
      fact.kind === "life_committed",
  );
  if (
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
  const next = facts[lives.length];
  // 已知同波的剩余成员不能被拆成“另一波”；名单不完整时由原事实镜头完整展示。
  if (
    next?.kind === "life_committed" &&
    lives[0]!.waveId !== undefined &&
    next.waveId === lives[0]!.waveId
  )
    return [];
  return lives;
}

/** 只有已校验且有权威生命覆盖的非空死亡名单才可由事实镜头替代；平安夜、未知事件和坏载荷不在此过滤。 */
export function isCoveredLifeReport(event: ReplayEvent | undefined, covered: boolean): boolean {
  return Boolean(
    covered &&
    event &&
    ["night_resolved", "additional_deaths"].includes(event.type) &&
    Array.isArray(event.payload.deaths) &&
    event.payload.deaths.length > 0,
  );
}
