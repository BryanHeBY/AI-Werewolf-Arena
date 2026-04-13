/** 文件说明：LLM 修复流程共用工具函数。 */
import { EntityId, PotionType } from "../../../domain/model";
import { World } from "../../../domain/world";

/** 将任意输入安全转换为 number 或 null。 */
export function numberOrNull(value: unknown): number | null {
  if (value === null || value === undefined) {
    return null;
  }
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

/** 选择一个存活且非当前玩家的目标。 */
export function pickAliveNotSelf(world: World, actorId: EntityId): EntityId | null {
  const target = world.getAliveEntityIds().find((id) => id !== actorId);
  return target ?? null;
}

/** 从文本中提取可能的目标玩家编号。 */
export function extractTargetId(text: string, actorId: EntityId): EntityId | null {
  const patterns = [
    /target[_\s-]*id[^0-9]*(\d+)/gi,
    /目标[^0-9]*(\d+)/gi,
    /player[^0-9]*(\d+)/gi,
    /玩家[^0-9]*(\d+)/gi,
  ];
  for (const pattern of patterns) {
    let match: RegExpExecArray | null = null;
    while ((match = pattern.exec(text)) !== null) {
      const candidate = Number(match[1]);
      if (Number.isFinite(candidate) && candidate !== actorId) {
        return candidate;
      }
    }
  }
  return null;
}

/** 从文本中提取女巫药剂类型。 */
export function extractPotion(text: string): PotionType {
  const lower = text.toLowerCase();
  if (
    lower.includes(PotionType.Poison) ||
    lower.includes("毒") ||
    lower.includes("poison")
  ) {
    return PotionType.Poison;
  }
  if (
    lower.includes(PotionType.Heal) ||
    lower.includes("救") ||
    lower.includes("heal")
  ) {
    return PotionType.Heal;
  }
  return PotionType.None;
}
