/**
 * 负责庇护和吞噬工具的观察选择；输入为本次请求的明确候选、风格与原随机选择器。
 * 输出为原具名动作和可空目标，不从真实身份推导新候选，也不直接写庇护关系或复制库存。
 * 同名工具可由不同来源的实例提供，候选观察不替代机制的实例、生命周期和付款许可检查。
 */
import type { ObservedToolHandler } from "./context";
/** 仅在本次显式名单内选择，原保守／随机空目标也是具名动作，不等于 handler 返回 null。 */
export const castShelter: ObservedToolHandler = ({ request, pick, style, random }) => ({
  name: "cast_shelter",
  args: {
    target_id:
      style === "conservative" || (style === "random" && random.next() < 0.35)
        ? null
        : (pick([...(request.context.shelter_candidates ?? [])]) ?? null),
  },
});
export const swallowSkill: ObservedToolHandler = ({ request, pick, style, random }) => ({
  name: "swallow_skill",
  args: {
    target_id:
      style === "conservative" || (style === "random" && random.next() < 0.35)
        ? null
        : (pick([...(request.context.swallow_candidates ?? [])]) ?? null),
  },
});
