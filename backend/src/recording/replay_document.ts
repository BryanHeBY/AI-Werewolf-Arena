/**
 * 负责从规范清单与完整公共事件数组构造离线复盘文件；输入录制结果，输出经 canonical 契约断言的 God 视角文档。
 * 先核连续序号和玩家 ID 不重复，再组装并作完整断言；失败原样抛出，不补序号、清洗事件或写盘。
 * events 保输入数组同引用，玩家行新建，最终 decision 独立 structuredClone；文件类型／序列化不授予运行行动权限。
 */
import { assertReplayDocument, REPLAY_SCHEMA_VERSION } from "@ai-werewolf-arena/replay-contract";
import type { ReplayDocument } from "@ai-werewolf-arena/replay-contract";
import { ReplayManifest, ReplayPublicEvent } from "./contracts";

/** 浏览器播放器与视频渲染器直接消费的离线复盘文件。 */
export type { ReplayDocument } from "@ai-werewolf-arena/replay-contract";

/**
 * 从 record 的规范数据构造前端投影。
 *
 * events 不做筛选、合并或重排，保输入完整序列；派生的阶段窗口、
 * 最终存活状态及 Agent 审计轨迹不重复写入前端文件。
 */
export function createReplayDocument(input: {
  manifest: ReplayManifest;
  events: ReplayPublicEvent[];
}): ReplayDocument {
  assertCanonicalEventSequence(input.events);
  assertUniquePlayers(input.manifest.players);

  const document: ReplayDocument = {
    schemaVersion: REPLAY_SCHEMA_VERSION,
    perspective: "god",
    sessionId: input.manifest.session_id,
    meta: {
      board: input.manifest.board,
      ...(input.manifest.locale === undefined ? {} : { locale: input.manifest.locale }),
      startedAt: input.manifest.started_at,
      endedAt: input.manifest.ended_at,
    },
    result: {
      winner: input.manifest.winner,
      reason: input.manifest.finish_reason || null,
      ...(input.manifest.game_result
        ? { decision: structuredClone(input.manifest.game_result) }
        : {}),
    },
    players: input.manifest.players.map(({ player_id, role, camp, name }) => ({
      player_id,
      role,
      camp,
      ...(name !== undefined ? { name } : {}),
    })),
    events: input.events,
  };
  // 对已组装文档执行原序列化数据／schema 检查；不复制或冻结 events，克隆／断言失败仍沿原路径传播。
  assertReplayDocument(document);
  return document;
}

/** 每个 seq 必须严格等于数组位置+1；不排序或修补已消耗／缺失的序号，首个失配立即抛原错误。 */
function assertCanonicalEventSequence(events: ReplayPublicEvent[]): void {
  for (let index = 0; index < events.length; index += 1) {
    if (events[index].seq !== index + 1) {
      throw new Error(
        `replay_document_non_canonical_event_sequence:index=${index},seq=${events[index].seq}`,
      );
    }
  }
}

/** 此处只拒绝重复 player_id；字段合法性继续交后面的完整文档断言，不把 Set 当角色库存或许可。 */
function assertUniquePlayers(players: ReplayManifest["players"]): void {
  const ids = new Set<number>();
  for (const player of players) {
    if (ids.has(player.player_id)) {
      throw new Error(`replay_document_duplicate_player:${player.player_id}`);
    }
    ids.add(player.player_id);
  }
}
