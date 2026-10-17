/**
 * 负责视频编译中的原事件索引、独立事实前缀及只读视图缓存。输入为已读取归档和展示名单，输出明确游标及原投影视图。
 * 事件数组下标、事件 seq 和事实 seq 分开命名；镜头跳剪不删除历史，事实状态仍只由 replay-projection 拥有。
 */
import type { ReplayDocument, ReplayFact } from "@ai-werewolf-arena/replay-contract";
import { buildReplayEventView, type ReplayEventViewInput } from "../../replay/replay-event-view";
import { createReplayCursorIndex } from "../../replay/replay-projection";
import type { EventAnchor, PotionInventoryState, VideoEventView, VideoShot } from "../types";
import { fail } from "./validation";

export interface VideoSourceCursor {
  readonly eventIndex: number;
  readonly throughSeq: number;
  readonly throughFactSeq: number;
}
export function createVideoSourceIndex(replay: ReplayDocument, renderInput: ReplayEventViewInput) {
  const snapshots = createReplayCursorIndex(replay);
  const facts = replay.facts ?? [];
  const factCounts = Array.from({ length: replay.events.length + 1 }, () => 0);
  for (const fact of facts) factCounts[fact.afterSeq] = fact.seq;
  for (let seq = 1; seq < factCounts.length; seq++)
    factCounts[seq] = Math.max(factCounts[seq]!, factCounts[seq - 1]!);
  // 资源索引只复制God事实值，不推减库存或判断行动许可；逐帧不重扫事实历史。
  const inventoryPrefixes: Map<string, Extract<PotionInventoryState, { status: "known" }>>[] = [
    new Map(),
  ];
  for (const fact of facts) {
    const previous = inventoryPrefixes.at(-1)!;
    const next = fact.kind === "potion_stock" ? new Map(previous) : previous;
    if (fact.kind === "potion_stock")
      next.set(`${fact.actorId}:${fact.abilityId}`, {
        status: "known",
        actorId: fact.actorId,
        abilityId: fact.abilityId,
        heal: fact.heal,
        poison: fact.poison,
        sourceFactSeq: fact.seq,
        afterSeq: fact.afterSeq,
        day: fact.day,
      });
    inventoryPrefixes.push(next);
  }
  function inventoryAt(
    throughFactSeq: number,
    actorId: number,
    abilityId?: string,
  ): PotionInventoryState {
    const states = [
      ...(inventoryPrefixes[throughFactSeq] ?? inventoryPrefixes[0]!).values(),
    ].filter(
      (state) =>
        state.actorId === actorId && (abilityId === undefined || state.abilityId === abilityId),
    );
    // 未标abilityId且存在多个实例时不能把库存相加，也不能猜原生或复制实例。
    return states.length === 1
      ? { ...states[0]! }
      : { status: "unknown", actorId, ...(abilityId === undefined ? {} : { abilityId }) };
  }
  const views = new Map<string, VideoEventView>();
  const eventIndexes = new Map(replay.events.map((event, index) => [event.seq, index]));
  const factsAfter = new Map<number, ReplayFact[]>();
  for (const fact of facts)
    factsAfter.set(fact.afterSeq, [...(factsAfter.get(fact.afterSeq) ?? []), fact]);
  const factSeqAt = (throughSeq: number) => factCounts[throughSeq] ?? 0;
  const cursorAt = (
    eventIndex: number,
    throughFactSeq = factSeqAt(eventIndex + 1),
  ): VideoSourceCursor => ({
    eventIndex,
    throughSeq: eventIndex + 1,
    throughFactSeq,
  });
  function viewAt(cursor: VideoSourceCursor): VideoEventView {
    const { eventIndex, throughSeq, throughFactSeq } = cursor;
    const key = `${eventIndex}:${throughFactSeq}`;
    if (!views.has(key)) {
      const latestFact = facts[throughFactSeq - 1];
      const snapshot =
        latestFact?.afterSeq === throughSeq
          ? snapshots.facts[throughFactSeq - 1]!
          : eventIndex < 0
            ? snapshots.initial
            : snapshots.events[eventIndex]!;
      views.set(key, buildReplayEventView(renderInput, eventIndex, snapshot));
    }
    return views.get(key)!;
  }
  function anchorIndex(anchor: EventAnchor): number {
    const index = eventIndexes.get(anchor?.seq);
    if (index === undefined || replay.events[index].type !== anchor.type)
      fail(`anchor_mismatch:${anchor?.seq}`);
    return index;
  }
  return { replay, facts, factsAfter, factSeqAt, cursorAt, viewAt, anchorIndex, inventoryAt };
}
export type VideoSourceIndex = ReturnType<typeof createVideoSourceIndex>;

/** 选择镜头出处与前后游标；独立 fact 镜头不能借用事件 seq 空间或提前吸收同前缀的其他 fact。 */
export function selectVideoShotSource(
  source: VideoSourceIndex,
  index: number,
  kind: VideoShot["kind"],
  sourceIndexes: number[],
  committedFacts: ReplayFact[],
) {
  const committedFact = committedFacts[0];
  const event = source.replay.events[index];
  const endIndex = committedFact || kind === "hold" ? index : Math.max(index, ...sourceIndexes);
  const throughSeq = endIndex + 1;
  const after = source.cursorAt(
    endIndex,
    committedFacts.at(-1)?.seq ??
      source.factSeqAt(kind === "hold" ? throughSeq : Math.max(0, throughSeq - 1)),
  );
  const primary =
    endIndex === index ? after : source.cursorAt(index, source.factSeqAt(Math.max(0, index)));
  const beforeIndex = committedFact ? index : Math.max(-1, Math.min(...sourceIndexes) - 1);
  const before = source.cursorAt(
    beforeIndex,
    committedFact ? committedFact.seq - 1 : source.factSeqAt(Math.max(0, beforeIndex + 1)),
  );
  return {
    event,
    index,
    endIndex,
    committedFact,
    committedFacts,
    resolutionEvent:
      endIndex > index && source.replay.events[endIndex]?.type === "voted_out"
        ? source.replay.events[endIndex]
        : undefined,
    sourceEvents: sourceIndexes
      .map((item) => source.replay.events[item])
      .filter((item) => item !== undefined),
    before,
    primary,
    after,
    // 原实现按 after、primary 顺序捕获视图；保持标签/投影错误的发生顺序。
    view: source.viewAt(after),
    primaryView: source.viewAt(primary),
  };
}
export type VideoShotSource = ReturnType<typeof selectVideoShotSource>;
