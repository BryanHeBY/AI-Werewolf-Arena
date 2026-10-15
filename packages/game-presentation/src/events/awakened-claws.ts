/**
 * 负责狼爪私有事实的双语标签，输入纯载荷及locale，输出文案或拒绝；受众由消费方逐事件验证。
 * 消耗描述不等于实际击杀，空枪和夜间保护仍消费；公开死亡只由中立player_shot事实展示。
 * 不把内部unitId、来源receipt或剩余库存插入公开文案，也不读取World或为玩家补全秘密。
 */
import { readAwakenedClawFact } from "@ai-werewolf-arena/game-contract/facts/awakened-claws";
import { text, type Locale } from "@ai-werewolf-arena/game-text";
export function awakenedClawEventLabel(
  type: string,
  payload: unknown,
  locale: Locale = "zh-CN",
): string | null {
  const fact = readAwakenedClawFact(type, payload);
  if (!fact) return null;
  switch (fact.type) {
    case "awakened_claw_bequeathed":
      return text(locale, "event.awakened_claw_bequeathed", {
        actor: fact.payload.actorId,
        target: fact.payload.targetId,
        day: fact.payload.day,
      });
    case "awakened_claw_spent":
      return fact.payload.targetId === null
        ? text(locale, "event.awakened_claw_passed", {
            actor: fact.payload.actorId,
            day: fact.payload.day,
          })
        : text(locale, "event.awakened_claw_spent", {
            actor: fact.payload.actorId,
            target: fact.payload.targetId,
            day: fact.payload.day,
          });
    case "awakened_claws_expired":
      return text(locale, "event.awakened_claws_expired", {
        actor: fact.payload.actorId,
        day: fact.payload.day,
        count: fact.payload.unitIds.length,
      });
  }
}
