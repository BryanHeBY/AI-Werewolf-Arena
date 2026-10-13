/**
 * 负责将原事件取得安全的 Node 纯数据副本，并按玩家事件流生成局部连续 seq。
 * 输入为 World 和已提交领域事件；输出为按发表时 audience 授权的脱离事件。
 * 反射前拒绝 Proxy，保留原 descriptor、数组、循环和失败边界；全家族读取与裁剪归共用投影 owner。
 * 窄回调仅在原分支查找原可见性方法或来源函数，不提前读取 World，也不授予状态写权限。
 * 这里不提交行动或补发旧秘密；隐藏事件不会留下全局序号缺口。
 */
import { types } from "node:util";
import type { EntityId, GameEvent, PlayerVisibleEvent } from "@ai-werewolf-arena/game-contract";
import type { World } from "../../core/domain/world";
import { getDefaultAgentEventVisibilityRegistry } from "../mechanisms";
import { projectAbilitySource } from "../mechanisms/roles/abilities";
import { projectAgentEvent } from "../observation/agent-event-projection";

/** 原 Node ingress 程序；不对浏览器 unknown Proxy 承诺零 trap。 */
function snapshotEvent(event: GameEvent): GameEvent | null {
  const ancestors = new Set<object>();
  const inert = (value: unknown, depth: number): boolean => {
    // 声明中的可选字段在 JSON 编码前仍允许 undefined。
    if (
      value === undefined ||
      value === null ||
      typeof value === "string" ||
      typeof value === "boolean"
    )
      return true;
    if (typeof value === "number") return Number.isFinite(value);
    if (
      !value ||
      typeof value !== "object" ||
      depth > 32 ||
      types.isProxy(value) ||
      ancestors.has(value)
    )
      return false;
    const array = Array.isArray(value),
      proto = Object.getPrototypeOf(value);
    if (
      (array ? proto !== Array.prototype : proto !== Object.prototype && proto !== null) ||
      Object.getOwnPropertySymbols(value).length
    )
      return false;
    const fields = Object.getOwnPropertyDescriptors(value);
    if (array) {
      const length = fields.length?.value;
      if (
        !Number.isSafeInteger(length) ||
        length > 1024 ||
        Object.keys(fields).length !== length + 1 ||
        !Array.from({ length }, (_, i) => Object.hasOwn(fields, i)).every(Boolean)
      )
        return false;
    }
    ancestors.add(value);
    try {
      return Object.entries(fields).every(
        ([key, field]) =>
          (array && key === "length") ||
          (field.enumerable && Object.hasOwn(field, "value") && inert(field.value, depth + 1)),
      );
    } finally {
      ancestors.delete(value);
    }
  };
  try {
    if (!inert(event, 0)) return null;
    const copy = structuredClone(event);
    return typeof copy.type === "string" &&
      typeof copy.timestamp === "number" &&
      copy.payload !== null &&
      typeof copy.payload === "object" &&
      !Array.isArray(copy.payload)
      ? copy
      : null;
  } catch {
    return null;
  }
}

/** Node 在任何事实读器前取得同一副本；后续授权及输出不会再回读原始事件。 */
export function buildAgentVisibleEvent(
  world: World,
  event: GameEvent,
  actorId: EntityId,
  visibleSeq: number,
): PlayerVisibleEvent | null {
  const detached = snapshotEvent(event);
  if (!detached) return null;
  event = detached;
  return projectAgentEvent(event, actorId, visibleSeq, {
    canView(event, actorId) {
      const visibility = getDefaultAgentEventVisibilityRegistry();
      return visibility.canView(world, event, actorId);
    },
    projectAbilitySource(origin, disclosed) {
      return projectAbilitySource(origin(), disclosed());
    },
  });
}

/**
 * 返回只读追加的玩家事件流。seq 仅按投影后仍可见的事件递增，因此不同数量的
 * 隐藏事件不会改变玩家协议。这里不截断；Provider 使用 seq 取增量，并在送模时
 * 控制消息窗口，避免“数组截断 + 长度游标”造成新事件永久丢失。
 */
export function buildAgentVisibleEventFeed(
  world: World,
  events: GameEvent[],
  actorId: EntityId,
): PlayerVisibleEvent[] {
  const visible: PlayerVisibleEvent[] = [];
  for (let index = 0; index < events.length; index += 1) {
    const projected = buildAgentVisibleEvent(world, events[index], actorId, visible.length + 1);
    if (projected) visible.push(projected);
  }
  return visible;
}
