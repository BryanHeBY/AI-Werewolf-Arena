/**
 * 负责受限机器人在具名守卫/骑士窗口选择动作。输入只有已投影候选、风格和自己的随机流，输出未提交的动作。
 * 不查询World或隐藏camp；wait不保证有未来窗口，普通null与继续链null的效果由真实owner区分。
 */
import type { ObservedToolHandler } from "./context";
export const awakenedProtect: ObservedToolHandler = ({ request, style, random, pick }) => {
  const o = request.context.awakened_protect_options;
  if (!o) return { name: "awakened_protect", args: { mode: "wait", target_id: null } };
  if (style === "conservative" || (style === "random" && random.next() < 0.35))
    return { name: "awakened_protect", args: { mode: "wait", target_id: null } };
  const target = pick([...o.targetIds]);
  return target === undefined
    ? { name: "awakened_protect", args: { mode: "pass", target_id: null } }
    : { name: "awakened_protect", args: { mode: "protect", target_id: target } };
};
export const awakenedDuel: ObservedToolHandler = ({ request, style, random, pick }) => {
  const o = request.context.awakened_duel_options;
  const abstain =
    style === "conservative" ||
    (style === "random" && random.next() < 0.35) ||
    (o?.continuing === true && random.next() < 0.3);
  return {
    name: "awakened_duel",
    args: { target_id: abstain ? null : (pick([...(o?.targetIds ?? [])]) ?? null) },
  };
};
