/**
 * 负责把乌鸦已脱离的自身状态渲染为双语规则和最近选择提示。
 * 输入只含本族公开状态值及locale，输出使用game-text的自然语言字符串；不查询World或授予行动权限。
 * 选项先转成明确的本地化条款，用户/机制数据不作为格式模板执行。
 */
import { text, type Locale } from "@ai-werewolf-arena/game-text";
import type { CrowState } from "@ai-werewolf-arena/game-contract";
import type { ActionRequest } from "@ai-werewolf-arena/game-contract";
import type { ReadonlyBoardConfig } from "@ai-werewolf-arena/game-contract";

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

/** 只解释本轮已授予的工具与上下文，未命中时交回后续机制。 */
export function renderCrowStageHint(
  request: ActionRequest,
  queries: { locale(): Locale },
): string | undefined {
  if (
    request.allowedTools.includes("curse_exile") &&
    request.context.crow_candidates !== undefined
  ) {
    const ids = request.context.crow_candidates;
    return ids.length
      ? text(
          queries.locale(),
          ids.includes(request.actorId) ? "prompt.targets.self" : "prompt.targets.others",
          { ids: ids.join(", ") },
        )
      : text(queries.locale(), "prompt.targets.none");
  }
}

/** 已配置政策的原文片段，调用点控制组合位置。 */
export function renderCrowBoardRules(config: ReadonlyBoardConfig, locale: Locale): string[] {
  return config.crow
    ? [
        text(locale, "prompt.config.crow", {
          ballot: text(
            locale,
            config.crow.ballotPolicy === "all_ballots" ? "crow.ballot.all" : "crow.ballot.first",
          ),
          action: text(
            locale,
            config.crow.actionPolicy === "required_when_legal"
              ? "crow.action.required"
              : "crow.action.optional",
          ),
          self: text(locale, config.crow.selfTarget ? "crow.self.allowed" : "crow.self.forbidden"),
        }),
      ]
    : [];
}
