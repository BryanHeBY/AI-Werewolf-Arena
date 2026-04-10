import { EntityId, GameEvent } from "../domain/model";
import { World } from "../domain/world";
import {
  getDefaultAgentEventLineRegistry,
  getDefaultVisibilityRegistry,
} from "../mechanisms";

/**
 * 构建“单个玩家可见”的广播消息流（聊天格式行）。
 * 规则：
 * - 公开事件：全体可见；
 * - 狼队事件：仅狼人可见；
 * - 私有行动：仅行动发起者可见；
 * - 放逐阶段逐票公开（vote_cast）与最终放逐结果（voted_out）均可见。
 */
export function buildAgentBroadcastFeed(
  world: World,
  events: GameEvent[],
  actorId: EntityId,
  limit: number = 80,
): string[] {
  const isWolf = getDefaultVisibilityRegistry().isWolfPlayer(world, actorId);
  const lineRegistry = getDefaultAgentEventLineRegistry();
  const lines: string[] = [];
  const voteBatch: GameEvent[] = [];

  const flushVoteBatch = () => {
    if (voteBatch.length === 0) {
      return;
    }
    const line = renderMergedVoteBatch(voteBatch);
    if (line) {
      lines.push(line);
    }
    voteBatch.length = 0;
  };

  for (const event of events) {
    if (event.type === "vote_cast") {
      voteBatch.push(event);
      continue;
    }
    flushVoteBatch();
    const line = lineRegistry.toLine(event, { actorId, isWolf });
    if (line) {
      lines.push(line);
    }
  }
  flushVoteBatch();

  return lines.slice(-limit);
}

function renderMergedVoteBatch(voteEvents: GameEvent[]): string | null {
  if (voteEvents.length === 0) {
    return null;
  }
  const parts = voteEvents.map((event) => {
    const p = event.payload as Record<string, any>;
    const actorId = Number(p.actorId);
    const weight = Number(p.weight ?? 1);
    if (p.abstain === true) {
      return weight !== 1 ? `${actorId}号->弃票(w=${weight})` : `${actorId}号->弃票`;
    }
    const targetId = Number(p.targetId);
    return weight !== 1
      ? `${actorId}号->${targetId}号(w=${weight})`
      : `${actorId}号->${targetId}号`;
  });
  return `[系统][公开] 放逐票型：${parts.join("，")}`;
}
