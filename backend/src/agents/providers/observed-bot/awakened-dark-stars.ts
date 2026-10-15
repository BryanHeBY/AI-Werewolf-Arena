/**
 * 负责受限机器人对暗夜星辰两工具的选择。输入已投影候选、固定风格和本人的随机流，输出候选动作。
 * 魅惑只用请求给的候选；巡猎仅选择方向，不查询World、真实狼位或自行提交target_id。
 */
import type { ObservedToolHandler } from "./context";
export const awakenedCharm: ObservedToolHandler = ({ request, style, random, pick }) => ({
  name: "awakened_charm",
  args: {
    target_id:
      style === "conservative" || (style === "random" && random.next() < 0.35)
        ? null
        : (pick([...(request.context.awakened_charm_candidates ?? [])]) ?? null),
  },
});
export const awakenedPatrol: ObservedToolHandler = ({ style, random }) => ({
  name: "patrol",
  args: {
    direction:
      style === "conservative"
        ? null
        : style === "competitive"
          ? "counter_clockwise"
          : style === "random" && random.next() < 0.5
            ? "counter_clockwise"
            : "clockwise",
  },
});
