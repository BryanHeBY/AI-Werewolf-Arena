/**
 * 负责受限机器人的调毒选择与秘密协作。输入已投影观察中的目标/资格，输出候选动作；不读取World或真实身份。
 * 选择可能被正式窗口拒绝；一人否决仍消费已付资源，风格仅影响候选，不伪造协作结果。
 */
import { text } from "@ai-werewolf-arena/game-text";
import type { ObservedToolHandler } from "./context";
export const awakenedBrew: ObservedToolHandler = ({ request, pick, style, random }) => {
  const o = request.context.awakened_brew_options;
  if (o?.canHeal && typeof o.wolfTarget === "number")
    return {
      name: "awakened_brew",
      args: { mode: "heal", target_id: o.wolfTarget, assistant_ids: [] },
    };
  if (o?.canPoison && style !== "conservative" && (style !== "random" || random.next() >= 0.3)) {
    const target = pick([...o.targetIds]),
      pool = [...o.assistantIds],
      assistants: number[] = [];
    while (pool.length && assistants.length < o.requiredAssistants) {
      const id = pick(pool)!;
      assistants.push(id);
      pool.splice(pool.indexOf(id), 1);
    }
    if (target !== undefined && assistants.length === o.requiredAssistants)
      return {
        name: "awakened_brew",
        args: { mode: "poison", target_id: target, assistant_ids: assistants },
      };
  }
  return { name: "awakened_brew", args: { mode: "pass", target_id: null, assistant_ids: [] } };
};
export const brewDiscuss: ObservedToolHandler = ({ locale }) => ({
  name: "brew_discuss",
  args: { text: text(locale, "bot.brew.discuss") },
});
export const brewApprove: ObservedToolHandler = ({ style, random }) => ({
  name: "brew_approve",
  args: { approve: style !== "conservative" && (style !== "random" || random.next() >= 0.3) },
});
