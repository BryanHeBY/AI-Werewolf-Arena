import type { ReplayDocument } from "@ai-werewolf-arena/replay-contract";
import {
  ReplayManifest,
  ReplayPublicEvent,
} from "./types";

/** 浏览器播放器与视频渲染器直接消费的离线复盘文件。 */
export type { ReplayDocument } from "@ai-werewolf-arena/replay-contract";

/**
 * 从 record 的规范数据构造前端投影。
 *
 * events 不做筛选、合并或重排，确保领域事件无丢失；派生的阶段窗口、
 * 最终存活状态及 Agent 审计轨迹不重复写入前端文件。
 */
export function createReplayDocument(input: {
  manifest: ReplayManifest;
  events: ReplayPublicEvent[];
}): ReplayDocument {
  assertCanonicalEventSequence(input.events);
  assertUniquePlayers(input.manifest.players);

  return {
    perspective: "god",
    sessionId: input.manifest.session_id,
    meta: {
      board: input.manifest.board,
      startedAt: input.manifest.started_at,
      endedAt: input.manifest.ended_at,
    },
    result: {
      winner: input.manifest.winner,
      reason: input.manifest.finish_reason || null,
    },
    players: input.manifest.players.map(({ player_id, role, camp }) => ({
      player_id,
      role,
      camp,
    })),
    events: input.events,
  };
}

function assertCanonicalEventSequence(events: ReplayPublicEvent[]): void {
  for (let index = 0; index < events.length; index += 1) {
    if (events[index].seq !== index + 1) {
      throw new Error(
        `replay_document_non_canonical_event_sequence:index=${index},seq=${events[index].seq}`,
      );
    }
  }
}

function assertUniquePlayers(players: ReplayManifest["players"]): void {
  const ids = new Set<number>();
  for (const player of players) {
    if (ids.has(player.player_id)) {
      throw new Error(`replay_document_duplicate_player:${player.player_id}`);
    }
    ids.add(player.player_id);
  }
}
