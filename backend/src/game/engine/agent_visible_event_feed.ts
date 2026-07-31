import { EntityId, GameEvent, PlayerVisibleEvent } from "../../core/domain/model";
import { World } from "../../core/domain/world";
import { getDefaultAgentEventVisibilityRegistry } from "../mechanisms";

/**
 * 把领域事件投影为指定玩家可见的紧凑结构化事件。
 *
 * seq 使用领域事件数组中的全局单调序号。时间戳、日次和阶段不在每条事件中重复：
 * 当前回合已经单独携带这些状态，省略它们可以降低长局 token 消耗。
 * 未在可见性白名单中的新事件默认不可见，避免新增机制意外泄露私有信息。
 */
export function buildAgentVisibleEvent(
  world: World,
  event: GameEvent,
  actorId: EntityId,
  seq: number,
): PlayerVisibleEvent | null {
  const visibility = getDefaultAgentEventVisibilityRegistry();
  if (!visibility.canView(world, event, actorId)) {
    return null;
  }
  return {
    seq,
    type: event.type,
    payload: projectPayload(event),
  };
}

/** 只移除可由同一事件其余字段直接推导的冗余数据，不改动事实语义。 */
function projectPayload(event: GameEvent): Record<string, unknown> {
  if (event.type === "vote_summary") {
    const { tally: _derivedTally, ...payload } = event.payload;
    return payload;
  }
  return event.payload;
}

/**
 * 返回只读追加的玩家事件流。这里不截断；Provider 使用 seq 取增量，并在送模时
 * 控制消息窗口，避免“数组截断 + 长度游标”造成新事件永久丢失。
 */
export function buildAgentVisibleEventFeed(
  world: World,
  events: GameEvent[],
  actorId: EntityId,
): PlayerVisibleEvent[] {
  const visible: PlayerVisibleEvent[] = [];
  for (let index = 0; index < events.length; index += 1) {
    const projected = buildAgentVisibleEvent(world, events[index], actorId, index + 1);
    if (projected) visible.push(projected);
  }
  return visible;
}
