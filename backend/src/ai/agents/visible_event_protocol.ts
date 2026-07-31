import { PlayerVisibleEvent } from "../../core/domain/model";

/** 解析、去重并按全局 seq 排序玩家可见事件。 */
export function parsePlayerVisibleEvents(value: unknown): PlayerVisibleEvent[] {
  if (!Array.isArray(value)) return [];
  const bySeq = new Map<number, PlayerVisibleEvent>();
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const event = item as Record<string, unknown>;
    if (
      typeof event.seq !== "number" ||
      !Number.isInteger(event.seq) ||
      event.seq <= 0 ||
      typeof event.type !== "string" ||
      !event.payload ||
      typeof event.payload !== "object" ||
      Array.isArray(event.payload)
    ) {
      continue;
    }
    bySeq.set(event.seq, {
      seq: event.seq,
      type: event.type,
      payload: event.payload as Record<string, unknown>,
    });
  }
  return [...bySeq.values()].sort((left, right) => left.seq - right.seq);
}

type PlayerVisibleEventTuple = [
  seq: number,
  type: string,
  payload: Record<string, unknown>,
];

function toTuple(event: PlayerVisibleEvent): PlayerVisibleEventTuple {
  return [event.seq, event.type, event.payload];
}

/** 单事件使用固定 JSON 元组编码，减少重复键并保持消息前缀稳定。 */
export function encodePlayerVisibleEvent(event: PlayerVisibleEvent): string {
  return JSON.stringify({ event: toTuple(event) });
}

/** ACP 是持久会话，每轮只发送新增事件批次，减少协议固定字段重复。 */
export function encodePlayerVisibleEventBatch(events: PlayerVisibleEvent[]): string {
  return JSON.stringify({ events: events.map(toTuple) });
}
