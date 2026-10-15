/**
 * 负责内建基线对觉醒女巫及任意身份协助者的工具选择。输入为真实请求已告知选项和语言，
 * 输出候选动作或undefined；候选不是付款，正式生命/资格仍由网关和实际窗口复验。
 */
import type { ActionRequest, ToolCall } from "@ai-werewolf-arena/game-contract";
import { text, type Locale } from "@ai-werewolf-arena/game-text";
export function awakenedWitchBaseline(
  request: ActionRequest,
  locale: Locale,
): ToolCall | undefined {
  if (request.allowedTools.includes("brew_discuss"))
    return { name: "brew_discuss", args: { text: text(locale, "bot.brew.discuss") } };
  if (request.allowedTools.includes("brew_approve"))
    return { name: "brew_approve", args: { approve: true } };
  if (!request.allowedTools.includes("awakened_brew")) return undefined;
  const o = request.context.awakened_brew_options;
  if (o?.canHeal && typeof o.wolfTarget === "number")
    return {
      name: "awakened_brew",
      args: { mode: "heal", target_id: o.wolfTarget, assistant_ids: [] },
    };
  const target = o?.targetIds.find((id) => id !== request.actorId);
  if (o?.canPoison && target !== undefined)
    return {
      name: "awakened_brew",
      args: {
        mode: "poison",
        target_id: target,
        assistant_ids: o.assistantIds.slice(0, o.requiredAssistants),
      },
    };
  return { name: "awakened_brew", args: { mode: "pass", target_id: null, assistant_ids: [] } };
}
