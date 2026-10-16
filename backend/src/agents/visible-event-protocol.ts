/**
 * 负责 SDK／Pi／ACP 提示中的玩家可见事件形状整理和固定元组编码；输入来自请求上下文，输出为排序事件或 JSON 文本。
 * 可见性与受众投影归上游，增量游标和发送失败归各提示会话；本模块不读取全局事件、补发秘密或授予动作权限。
 * 解析只核基本字段，未知 type 仍保留，payload 持同引用；不是 Proxy／getter 安全边界，访问或序列化异常直接传播。
 */
import { PlayerVisibleEvent } from "../domain";

/** 非数组返回空；有效的正整数 seq 后写覆盖前写，再升序返回，既不验证连续性也不补缺号。 */
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
    // 保留原payload引用；无效条目被跳过，只有后续有效同序号事件才覆盖已接受值。
    bySeq.set(event.seq, {
      seq: event.seq,
      type: event.type,
      payload: event.payload as Record<string, unknown>,
    });
  }
  return [...bySeq.values()].sort((left, right) => left.seq - right.seq);
}

/** 固定顺序为玩家局部序号、机器事件名和原payload；tuple中不附全局序号或展示文案。 */
type PlayerVisibleEventTuple = [seq: number, type: string, payload: Record<string, unknown>];

function toTuple(event: PlayerVisibleEvent): PlayerVisibleEventTuple {
  return [event.seq, event.type, event.payload];
}

/** 单事件沿原 event 外壳编码；字段与payload原文不随locale改变，也不再次过滤受众。 */
export function encodePlayerVisibleEvent(event: PlayerVisibleEvent): string {
  return JSON.stringify({ event: toTuple(event) });
}

/** 原 events 外壳按调用方顺序编码；ACP调用方负责选取增量，本函数不排序、去重或推进游标。 */
export function encodePlayerVisibleEventBatch(events: PlayerVisibleEvent[]): string {
  return JSON.stringify({ events: events.map(toTuple) });
}
