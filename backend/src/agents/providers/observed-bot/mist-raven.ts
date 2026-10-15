/**
 * 负责迷雾、灵蛇和鸦爪的观察选择；输入为本次请求的明确候选、日次、风格及原随机选择器。
 * 输出为原具名动作及可空目标，不从 World 补候选、推断未告知身份或消费机制资源。
 * 迷雾三人组逐次抽取并移走已抽项，灵蛇保留名单首项；真实圈域、生命和付款由原机制复验。
 */
import type { ObservedToolHandler } from "./context";

export const castMist: ObservedToolHandler = ({ request, pick, style, random }) => {
  if (
    (style === "conservative" && request.context.day === 1) ||
    (style === "random" && random.next() < 0.5)
  )
    return { name: "cast_mist", args: { target_ids: null } };
  const pool = [...(request.context.mist_candidates ?? [])],
    targets: number[] = [];
  // 只从本地候选副本移走已抽编号，保留原逐次抽取；不足三人时整个三人组为空，不补外部目标。
  while (pool.length && targets.length < 3) {
    const id = pick(pool)!;
    targets.push(id);
    pool.splice(pool.indexOf(id), 1);
  }
  return { name: "cast_mist", args: { target_ids: targets.length === 3 ? targets : null } };
};
/** 灵蛇只取已发名单首项；风格／首日短路不引入新的目标抽签或改读真实毒目标。 */
export const useSnake: ObservedToolHandler = ({ request, style, random }) => ({
  name: "use_snake",
  args: {
    target_id:
      style === "conservative" ||
      (style === "competitive" && request.context.day === 1) ||
      (style === "random" && random.next() < 0.5)
        ? null
        : (request.context.snake_candidates?.[0] ?? null),
  },
});
/** 鸦爪在原风格概率判断之后才抽请求名单；空名单仍返回具名的空目标动作。 */
export const ravenKnife: ObservedToolHandler = ({ request, pick, style, random }) => ({
  name: "raven_knife",
  args: {
    target_id:
      style === "conservative" || (style === "random" && random.next() < 0.5)
        ? null
        : (pick([...(request.context.raven_candidates ?? [])]) ?? null),
  },
});
