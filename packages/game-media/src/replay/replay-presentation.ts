/**
 * 负责将复盘文档映射为播放器展示序列。输入为原文档，输出保源 seq 与出处的筛选视图。
 * 仅隐藏三个有统一结算展示的逐项事件，不重编号或改原文档，也不执行玩家权限过滤。
 */
import { readReplayEventType } from "./replay-event-reader";
import type { ReplayDocument } from "@ai-werewolf-arena/replay-contract";

/**
 * 并发动作的逐项事件保留在原始 replay 中供审计使用；播放器只呈现统一结算事件，
 * 避免把同一批并发动作误播成有先后关系的长序列。
 */
const SUMMARY_ONLY_EVENT_TYPES = new Set([
  "sheriff_candidate_declared",
  "sheriff_vote_cast",
  "vote_cast",
]);

/** 展示视图保留源事件序号与 schema／视角出处；它不是可直接持久化的 ReplayDocument。 */
export interface PresentationReplay extends Omit<ReplayDocument, "schemaVersion" | "perspective"> {
  kind: "presentation";
  sourceSchemaVersion: ReplayDocument["schemaVersion"];
  sourcePerspective: ReplayDocument["perspective"];
}

export function buildPresentationReplay(replay: ReplayDocument): PresentationReplay {
  const { schemaVersion, perspective, ...content } = replay;
  return {
    ...content,
    kind: "presentation",
    sourceSchemaVersion: schemaVersion,
    sourcePerspective: perspective,
    events: replay.events.filter(
      (event) => !SUMMARY_ONLY_EVENT_TYPES.has(readReplayEventType(event) ?? ""),
    ),
  };
}
