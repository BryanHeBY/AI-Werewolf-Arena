/**
 * 负责公开双人原体捕获绑定及“是否含狼”的唯一聚合查询。输入为原 World 与两个严格数组数据项；
 * 输出为 boolean，结构或原体不合时为 null。先复验两人 current 再读已捕获阵营，
 * 不返回单人阵营、目标身份或新行动许可；原体算法由 OriginalPlayerScope 的同绑定出口拥有。
 */
import { types } from "node:util";
import type { World } from "../../../../domain/world";
import { Camp } from "../../../../domain/identity";
import { originalPlayerCurrent as pairTargetCurrent } from "../original_player_scope";
import type { OriginalPlayerScope as PairTargetScope } from "../original_player_scope";
export {
  captureOriginalPlayer as capturePairTarget,
  originalPlayerSameLife as pairTargetOriginal,
  originalPlayerCurrent as pairTargetCurrent,
} from "../original_player_scope";
export type { OriginalPlayerScope as PairTargetScope } from "../original_player_scope";

/** 两个原体均须 current 且 ID 不同，才产生唯一聚合布尔值；不返回各人的阵营。 */
export function capturedPairContainsWolf(
  world: World,
  targets: readonly PairTargetScope[],
): boolean | null {
  if (
    types.isProxy(targets) ||
    !Array.isArray(targets) ||
    Object.getPrototypeOf(targets) !== Array.prototype
  )
    return null;
  // 只接纳精确两数据项与 length 的原数组形状，不主动求值元素 getter。
  const fields: Record<string, PropertyDescriptor> = Object.getOwnPropertyDescriptors(
    targets as object,
  );
  if (
    Reflect.ownKeys(fields).length !== 3 ||
    fields.length?.value !== 2 ||
    !("value" in (fields["0"] ?? {})) ||
    !("value" in (fields["1"] ?? {}))
  )
    return null;
  const first = fields["0"]!.value as PairTargetScope,
    second = fields["1"]!.value as PairTargetScope;
  if (
    !pairTargetCurrent(world, first) ||
    !pairTargetCurrent(world, second) ||
    first.id === second.id
  )
    return null;
  return first.campValue === Camp.Wolf || second.campValue === Camp.Wolf;
}
