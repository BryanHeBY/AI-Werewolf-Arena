/**
 * 负责乌鸦共享事件自然语言渲染，输入为机器类型、纯载荷与locale，输出双语文案或null。
 * 事实读器先严格校验，终端、Agent与Web共用标签；受众由调用方保留，不以展示结果扩大可见性。
 * 本模块不读取World、状态或票权，也不重算诅咒或修改用户数据。
 */
import { readCrowFact, type Locale } from "@ai-werewolf-arena/game-contract";
import { text } from "@ai-werewolf-arena/game-text";
export function crowEventLabel(
  type: string,
  payload: unknown,
  locale: Locale = "zh-CN",
): string | null {
  const fact = readCrowFact(type, payload);
  if (!fact) return null;
  return "actorId" in fact
    ? text(locale, "event.crow_curse_chosen", {
        actor: fact.actorId,
        day: fact.day,
        target: fact.targetId ?? text(locale, "crow.pass"),
      })
    : text(locale, "event.crow_curse_applied", {
        day: fact.day,
        round: fact.round,
        target: fact.targetId,
      });
}
