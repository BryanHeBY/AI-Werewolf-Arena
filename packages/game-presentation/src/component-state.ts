/**
 * 负责公开组件的纯数据展示。输入为具体展示片段与语言；输出保持原文案、术语转换、
 * 参数校验与语言失败。不读取领域组件、真实库存、World 或请求，不创建状态或授权。
 * 调用方按原顺序逐片段提交，印记列表文字只接原逐项格式化后的字符串。
 */
import type { ComponentPresentationPart } from "@ai-werewolf-arena/game-contract";
import type { Locale } from "@ai-werewolf-arena/game-catalog";
import { text, term, type MessageKey } from "@ai-werewolf-arena/game-text";

export function formatComponentPart(part: ComponentPresentationPart, locale: Locale): string {
  switch (part.kind) {
    case "alive":
      return text(locale, part.alive ? "component.alive" : "component.dead");
    case "camp":
      return text(locale, "component.camp", { camp: term("camp_team", part.camp, locale) });
    case "badge-destroyed":
      return text(locale, "component.badge_destroyed");
    case "badge-none":
      return text(locale, "component.badge_none");
    case "badge-held":
      return text(locale, "component.badge_held", { weight: part.weight });
    case "vote-none":
      return text(locale, "component.vote_none");
    case "vote-weight":
      return text(locale, "component.vote_weight", { weight: part.weight });
    case "marks-none":
      return text(locale, "component.marks_none");
    case "mark":
      return text(locale, `component.mark.${part.mark}` as MessageKey);
    case "marks":
      return text(locale, "component.marks", { marks: part.marks });
  }
}
