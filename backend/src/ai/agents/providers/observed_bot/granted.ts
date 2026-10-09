import type { ObservedToolHandler } from "./context";

export const bestow_ability: ObservedToolHandler = (context) => {
  const { request, others, pick, random, style } = context;
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
