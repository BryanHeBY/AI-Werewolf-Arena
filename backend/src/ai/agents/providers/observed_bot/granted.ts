/**
 * 负责商人赠予与黑市交易的观察候选选择；输入为已公布存活的他人列表、日次、风格和原随机流。
 * 输出为原目标／技能动作或 null；这里只选受赠者和技能，不写库存、授予能力或判断对手真实阵营。
 * 首夜保守偏好与抽取顺序保持，赠予／交易资格、次数、对方接收和付款仍由各机制检查。
 */
import type { ObservedToolHandler } from "./context";

export const bestow_ability: ObservedToolHandler = (context) => {
  const { request, others, pick, random, style } = context;
  // 首夜保守先返回；其余先抽受赠者，只有实际目标存在时才抽技能，不消耗赠予库存。
  if (style === "conservative" && request.context.day === 1) return null;
  const target = pick(others),
    skills = ["check", "poison", "guard"] as const;
  return target === undefined
    ? null
    : {
        name: "bestow_ability",
        args: {
          target_id: target,
          skill: skills[Math.floor(random.next() * skills.length)],
        },
      };
};

export const black_market_trade: ObservedToolHandler = (context) => {
  const { request, others, pick, random, style } = context;
  // 首夜保守先返回；其余先抽受赠者，只有实际目标存在时才抽技能，不消耗赠予库存。
  if (style === "conservative" && request.context.day === 1) return null;
  const target = pick(others),
    skills = ["check", "poison", "gun"] as const;
  return target === undefined
    ? null
    : {
        name: "black_market_trade",
        args: {
          target_id: target,
          skill: skills[Math.floor(random.next() * skills.length)],
        },
      };
};
