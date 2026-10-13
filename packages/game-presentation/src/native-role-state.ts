/**
 * 负责内建角色的纯展示片段格式化。输入为纯数据展示片段与当前语言，输出保持原文字、
 * 参数校验、空值和策略分支。调用者在原读取点逐片段提交；本模块不查询 World、
 * 角色库存、请求或真实阵营，不解析私有状态、不授权或提交动作。用户自定义原文不经此入口。
 */
import type { NativeRolePresentationPart } from "@ai-werewolf-arena/game-contract";
import type { Locale } from "@ai-werewolf-arena/game-catalog";
import { text, roleName, term } from "@ai-werewolf-arena/game-text";
export function formatNativeRolePart(
  part: NativeRolePresentationPart,
  locale: Locale = "zh-CN",
): string {
  if (part.kind === "role-label") return roleName(part.role, locale);
  if (part.kind === "camp-label") return term("camp", part.camp, locale);
  if (part.kind === "death-policy")
    return text(
      locale,
      part.policy === "awa_day_deaths_v1"
        ? "role.death_action.day_deaths"
        : part.policy === "awa_knife_or_exile_v1"
          ? "role.death_action.knife_exile"
          : "role.death_action.qualified",
    );
  return text(locale, part.key, part.parameters);
}
