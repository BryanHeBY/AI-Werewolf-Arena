/**
 * 负责共同对局阶段、投票、死亡汇总与终局的脚本展示。输入为原GameEvent和语言，输出原文案、阶段标签及终端分类。
 * 这里只显示已提交事实，不复算胜负或死亡，也不承接具体角色机制；读取与错误前缀保持原顺序。
 */
import type * as ScriptRendering from "./contracts";
import { text as defaultText } from "@ai-werewolf-arena/game-text";
import { type PlayerText } from "@ai-werewolf-arena/game-presentation";
import { getDefaultTextLocalizationRegistry } from "./text-localization-registry";
import { readVictoryResult } from "@ai-werewolf-arena/replay-contract";
import {
  outcomeLabel,
  outcomeWinnersLabel,
  victoryPointLabel,
} from "@ai-werewolf-arena/game-presentation";
import { type Locale } from "@ai-werewolf-arena/game-text";

function resultLabel(
  payload: unknown,
  locale: Locale,
  key: "console.judge.result" | "console.live.result",
  text: PlayerText = defaultText,
): string {
  if (
    payload &&
    typeof payload === "object" &&
    (Object.hasOwn(payload, "outcome") || Object.hasOwn(payload, "decidedAt"))
  ) {
    try {
      const decision = readVictoryResult(payload);
      return `${text(locale, "victory.finished", { result: outcomeLabel(decision.outcome, locale, text), reason: getDefaultTextLocalizationRegistry().gameOverReason(decision.reason, locale) })} · ${outcomeWinnersLabel(decision.outcome, locale, text)} · ${victoryPointLabel(decision.decidedAt, locale, text)}`;
    } catch {
      return text(locale, "replay.unknown");
    }
  }
  const old = payload as { winner?: string | null; reason?: string };
  return text(locale, key, {
    winner: getDefaultTextLocalizationRegistry().winnerName(old.winner ?? "", locale),
    reason: getDefaultTextLocalizationRegistry().gameOverReason(old.reason ?? "", locale),
  });
}
export const COMMON_EVENT_CHAT_HANDLERS: ScriptRendering.ScriptChatLineHandlers = {
  day_speech: (event, locale = "zh-CN", text: PlayerText = defaultText) =>
    text(locale, "console.chat.day", { actor: event.payload.actorId, speech: event.payload.text }),
};

export const COMMON_EVENT_JUDGE_HANDLERS: ScriptRendering.ScriptJudgeLineHandlers = {
  exile_pk_started: (event, locale = "zh-CN", text: PlayerText = defaultText) =>
    text(locale, "console.pk.exile", {
      players: event.payload.candidates
        .map((id) => text(locale, "common.player_reference", { id }))
        .join(", "),
    }),
  additional_deaths: (event, locale = "zh-CN", text: PlayerText = defaultText) =>
    text(locale, "console.additional_deaths", {
      players: event.payload.deaths
        .map((id) => text(locale, "common.player_reference", { id }))
        .join(", "),
    }),
  phase_changed: (event, locale = "zh-CN", text: PlayerText = defaultText) => {
    const p = event.payload;
    if (p.phase === "night") return text(locale, "console.judge.night", { day: p.day });
    if (p.phase === "day") return text(locale, "console.judge.day", { day: p.day });
    if (p.phase === "voting") return text(locale, "console.judge.voting");
    if (p.phase === "game_over") {
      const i18n = getDefaultTextLocalizationRegistry();
      return p.winner != null && p.reason != null
        ? text(locale, "console.judge.over", {
            winner: i18n.winnerName(p.winner, locale),
            reason: i18n.gameOverReason(p.reason, locale),
          })
        : text(locale, "console.judge.over_short");
    }
    return null;
  },
  night_resolved: (event, locale = "zh-CN", text: PlayerText = defaultText) =>
    event.payload.deaths.length
      ? text(locale, "console.judge.deaths", {
          deaths: event.payload.deaths
            .map((id) => text(locale, "common.player_reference", { id }))
            .join(", "),
        })
      : text(locale, "console.judge.peace"),
  vote_summary: (event, locale = "zh-CN", text: PlayerText = defaultText) =>
    text(locale, "console.judge.votes", {
      votes: event.payload.votes
        .map((item) => {
          const vote =
            item.abstain || item.targetId == null
              ? text(locale, "console.vote.abstain", { actor: item.actorId })
              : text(locale, "console.vote.target", { actor: item.actorId, target: item.targetId });
          return item.weight !== 1
            ? `${vote}${text(locale, "replay.vote_weight", { weight: item.weight })}`
            : vote;
        })
        .join(", "),
    }),
  voted_out: (event, locale = "zh-CN", text: PlayerText = defaultText) =>
    text(locale, "console.judge.exile", { target: event.payload.target }),
  game_over: (event, locale = "zh-CN", text: PlayerText = defaultText) =>
    resultLabel(event.payload, locale, "console.judge.result", text),
};

export const COMMON_EVENT_STAGE_HANDLERS: ScriptRendering.ScriptReplayStageHandlers = {
  phase_changed: (event) => String(event.payload.phase ?? "phase_changed"),
  day_speech: () => "day_speech",
  exile_pk_started: () => "exile_pk_speech",
  vote_cast: () => "voting",
  vote_summary: () => "voting",
  voted_out: () => "voting",
};

export const COMMON_EVENT_LIVE_HANDLERS: ScriptRendering.ScriptLiveRenderHandlers = {
  exile_pk_started: (event, _private, locale = "zh-CN", text: PlayerText = defaultText) => [
    {
      kind: "god",
      text: text(locale, "console.pk.exile", {
        players: event.payload.candidates
          .map((id) => text(locale, "common.player_reference", { id }))
          .join(", "),
      }),
    },
  ],
  additional_deaths: (event, _private, locale = "zh-CN", text: PlayerText = defaultText) => [
    {
      kind: "system",
      text: text(locale, "console.additional_deaths", {
        players: event.payload.deaths
          .map((id) => text(locale, "common.player_reference", { id }))
          .join(", "),
      }),
    },
  ],
  day_speech: (event, _private, locale = "zh-CN", text: PlayerText = defaultText) => [
    {
      kind: "system",
      text: text(locale, "console.live.day", {
        actor: event.payload.actorId,
        speech: event.payload.text,
      }),
    },
  ],
  game_over: (event, _private, locale = "zh-CN", text: PlayerText = defaultText) => [
    { kind: "god", text: resultLabel(event.payload, locale, "console.live.result", text) },
  ],
};
