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

export function buildPresentationReplay(replay: ReplayDocument): ReplayDocument {
  return {
    ...replay,
    events: replay.events.filter((event) => !SUMMARY_ONLY_EVENT_TYPES.has(event.type)),
  };
}
