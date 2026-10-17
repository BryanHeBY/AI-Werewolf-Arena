/**
 * 负责本机制的公开政策和当前请求提示；输入只读配置、已授权请求及语言查询，输出双语说明。
 * 不读取 World 或重新推导目标，保持原字段读取顺序；提示不授予技能或行动权限。
 */
import { text, type Locale } from "@ai-werewolf-arena/game-text";
import type { ActionRequest, ReadonlyBoardConfig } from "@ai-werewolf-arena/game-contract";
import { settlesNightBeforeDay } from "../../rulesets/night-death-timing";

/** undefined 表示非警长阶段；对象中的空说明保留“已匹配但无需补充”的含义。 */
export function renderSheriffStageHint(
  request: ActionRequest,
  stage: string,
  day: number,
  queries: { locale(): Locale; boardConfig(): ReadonlyBoardConfig | undefined },
): { text: string | undefined } | undefined {
  // 板子 getter 在原两个表达式分别读取；! 仅消除类型缩窄丢失，不缓存或新增运行时拒绝。
  const firstDaySheriffTiming =
    day === 1 &&
    queries.boardConfig()?.enableSheriff === true &&
    !settlesNightBeforeDay(queries.boardConfig()!) &&
    ["sheriff_nomination", "sheriff_campaign_speech", "sheriff_withdraw", "sheriff_vote"].includes(
      stage,
    )
      ? text(queries.locale(), "prompt.stage.sheriff_timing")
      : undefined;
  if (stage === "sheriff_nomination") {
    return {
      text: [text(queries.locale(), "prompt.stage.sheriff_nomination"), firstDaySheriffTiming]
        .filter(Boolean)
        .join(" "),
    };
  }
  if (stage === "sheriff_campaign_speech") {
    return { text: firstDaySheriffTiming };
  }
  if (stage === "sheriff_withdraw") {
    return {
      text: [text(queries.locale(), "prompt.stage.sheriff_withdraw"), firstDaySheriffTiming]
        .filter(Boolean)
        .join(" "),
    };
  }
  if (stage === "sheriff_vote" || stage === "sheriff_pk_vote") {
    const pk = queries.boardConfig()?.sheriff?.electionPolicy === "awa_nomination_offstage_pk_v1";
    const eligibility =
      stage === "sheriff_pk_vote" || request.context.round === 2
        ? "prompt.stage.sheriff_vote_pk_second"
        : pk
          ? "prompt.stage.sheriff_vote_pk_first"
          : "prompt.stage.sheriff_vote";
    return {
      text: [text(queries.locale(), eligibility), firstDaySheriffTiming].filter(Boolean).join(" "),
    };
  }
}

/** 已配置政策的原文片段，调用点控制组合位置。 */
export function renderSheriffBoardStatus(
  config: ReadonlyBoardConfig,
  locale: Locale,
  sheriffEnabled: boolean,
): string {
  return text(locale, "prompt.config.sheriff", {
    rules: sheriffEnabled
      ? text(locale, "prompt.config.sheriff_enabled", {
          weight: config.sheriff?.voteWeight ?? 1.5,
        })
      : text(locale, "common.disabled"),
  });
}

/** 已配置政策的原文片段，调用点控制组合位置。 */
export function renderSheriffTimingRules(
  config: ReadonlyBoardConfig,
  locale: Locale,
  sheriffEnabled: boolean,
): string[] {
  return sheriffEnabled
    ? [
        text(
          locale,
          config.mistRaven
            ? "prompt.config.mist_raven_timing"
            : settlesNightBeforeDay(config)
              ? "prompt.config.night_before_sheriff"
              : "prompt.config.sheriff_timing",
        ),
        text(
          locale,
          config.sheriff?.badgePolicy === "awa_holder_choice_v1"
            ? "prompt.config.badge_choice"
            : "prompt.config.badge_next",
        ),
      ]
    : [];
}

/** 已配置政策的原文片段，调用点控制组合位置。 */
export function renderSheriffElectionRules(
  config: ReadonlyBoardConfig,
  locale: Locale,
  sheriffEnabled: boolean,
): string[] {
  return sheriffEnabled
    ? [
        text(
          locale,
          config.sheriff?.electionPolicy === "awa_nomination_offstage_pk_v1"
            ? "prompt.config.sheriff_pk"
            : "prompt.config.sheriff_direct",
        ),
      ]
    : [];
}
