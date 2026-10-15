/**
 * 负责把乌鸦已脱离的自身状态渲染为双语规则和最近选择提示。
 * 输入只含本族公开状态值及locale，输出使用game-text的自然语言字符串；不查询World或授予行动权限。
 * 选项先转成明确的本地化条款，用户/机制数据不作为格式模板执行。
 */
import { text, type Locale } from "@ai-werewolf-arena/game-text";
import type { CrowState } from "@ai-werewolf-arena/game-contract";
export function crowPromptState(s: CrowState | undefined, locale: Locale): string {
  const last = s?.history.at(-1);
  return (
    text(locale, "role.crow.brief") +
    " " +
    text(locale, "role.crow.state", {
      ballot: text(
        locale,
        s?.ballotPolicy === "all_ballots" ? "crow.ballot.all" : "crow.ballot.first",
      ),
      action: text(
        locale,
        s?.actionPolicy === "required_when_legal" ? "crow.action.required" : "crow.action.optional",
      ),
      self: text(locale, s?.selfTarget ? "crow.self.allowed" : "crow.self.forbidden"),
      target: last?.targetId ?? text(locale, "crow.pass"),
      day: last?.day ?? text(locale, "crow.pass"),
    })
  );
}
