/**
 * 负责警长竞选、票汇总、警徽与发言方向的裁判／终端展示。输入为既有事件和语言；
 * 输出为原名单、票项及分类文案，空名单回退 none，放弃先于目标显示，未知方向保原字符串。
 * 只渲染事实，不计票、授徽、校验候选人或改变事件受众。
 */
import type * as ScriptRendering from "../../agents/presentation/contracts";

import { type PlayerText } from "@ai-werewolf-arena/game-presentation";
import { text as defaultText, type Locale } from "@ai-werewolf-arena/game-text";
import type {
  ScriptJudgeLineHandlers,
  ScriptLiveRenderHandlers,
} from "../../agents/presentation/contracts";

function seats(ids: number[], locale: Locale, text: PlayerText = defaultText): string {
  return (
    ids.map((id) => text(locale, "common.player", { id })).join(", ") || text(locale, "common.none")
  );
}
function votes(
  items: Array<{ actorId: number; targetId: number | null; abstain: boolean }>,
  locale: Locale,
  text: PlayerText = defaultText,
): string {
  // 纯展示保原票序；abstain先于null目标，既有票权／计票结果不在这里重算。
  return items
    .map((item) =>
      item.abstain || item.targetId === null
        ? text(locale, "console.vote.abstain", { actor: item.actorId })
        : text(locale, "console.vote.target", { actor: item.actorId, target: item.targetId }),
    )
    .join(", ");
}
function direction(value: string, locale: Locale, text: PlayerText = defaultText): string {
  return value === "counter_clockwise"
    ? text(locale, "console.direction.counter_clockwise")
    : value === "clockwise"
      ? text(locale, "console.direction.clockwise")
      : value;
}
export const SHERIFF_SCRIPT_JUDGE_HANDLERS: ScriptJudgeLineHandlers = {
  sheriff_nomination_summary: (event, locale = "zh-CN", text: PlayerText = defaultText) =>
    text(locale, "console.judge.sheriff_nomination", {
      players: seats(event.payload.candidates, locale, text),
    }),
  sheriff_withdraw_summary: (event, locale = "zh-CN", text: PlayerText = defaultText) =>
    text(locale, "console.judge.sheriff_withdraw", {
      players: seats(event.payload.withdrawn, locale, text),
    }),
  sheriff_candidates_finalized: (event, locale = "zh-CN", text: PlayerText = defaultText) =>
    event.payload.candidates.length === 0
      ? text(locale, "console.judge.sheriff_candidates_none")
      : text(locale, "console.judge.sheriff_candidates", {
          players: seats(event.payload.candidates, locale, text),
        }),
  sheriff_vote_summary: (event, locale = "zh-CN", text: PlayerText = defaultText) =>
    event.payload.winnerId == null
      ? text(locale, "console.judge.sheriff_votes_none", {
          votes: votes(event.payload.votes, locale, text),
        })
      : text(locale, "console.judge.sheriff_votes", {
          votes: votes(event.payload.votes, locale, text),
          winner: event.payload.winnerId,
        }),
  sheriff_elected: () => null,
  sheriff_badge_transferred: (event, locale = "zh-CN", text: PlayerText = defaultText) =>
    text(locale, "console.judge.badge_transfer", {
      from: event.payload.fromId,
      to: event.payload.toId,
    }),
  sheriff_badge_destroyed: (event, locale = "zh-CN", text: PlayerText = defaultText) =>
    text(locale, "console.judge.badge_destroy", { target: event.payload.targetId }),
  sheriff_direction_chosen: (event, locale = "zh-CN", text: PlayerText = defaultText) =>
    text(locale, "console.judge.direction", {
      actor: event.payload.sheriffId,
      direction: direction(event.payload.direction, locale, text),
    }),
};
const god = (
  line: string,
  locale: Locale,
  key:
    | "console.live.god"
    | "console.live.sheriff_nomination"
    | "console.live.sheriff_votes" = "console.live.god",
  text: PlayerText = defaultText,
) => [{ kind: "god" as const, text: text(locale, key, { line }) }];
export const SHERIFF_SCRIPT_LIVE_HANDLERS: ScriptLiveRenderHandlers = {
  sheriff_candidate_declared: () => [],
  sheriff_nomination_summary: (event, _private, locale = "zh-CN", text: PlayerText = defaultText) =>
    god(
      SHERIFF_SCRIPT_JUDGE_HANDLERS.sheriff_nomination_summary!(event, locale, text)!,
      locale,
      "console.live.sheriff_nomination",
      text,
    ),
  sheriff_withdraw_summary: (event, _private, locale = "zh-CN", text: PlayerText = defaultText) =>
    god(
      SHERIFF_SCRIPT_JUDGE_HANDLERS.sheriff_withdraw_summary!(event, locale, text)!,
      locale,
      "console.live.sheriff_nomination",
      text,
    ),
  sheriff_candidates_finalized: (
    event,
    _private,
    locale = "zh-CN",
    text: PlayerText = defaultText,
  ) =>
    god(
      SHERIFF_SCRIPT_JUDGE_HANDLERS.sheriff_candidates_finalized!(event, locale, text)!,
      locale,
      undefined,
      text,
    ),
  sheriff_vote_cast: (event, _private, locale = "zh-CN", text: PlayerText = defaultText) => [
    {
      kind: "action",
      text:
        event.payload.abstain || event.payload.targetId === null
          ? text(locale, "console.live.sheriff_vote_skip", { actor: event.payload.actorId })
          : text(locale, "console.live.sheriff_vote", {
              actor: event.payload.actorId,
              target: event.payload.targetId,
            }),
    },
  ],
  sheriff_vote_summary: (event, _private, locale = "zh-CN", text: PlayerText = defaultText) =>
    god(
      SHERIFF_SCRIPT_JUDGE_HANDLERS.sheriff_vote_summary!(event, locale, text)!,
      locale,
      "console.live.sheriff_votes",
      text,
    ),
  sheriff_elected: () => [],
  sheriff_direction_chosen: (event, _private, locale = "zh-CN", text: PlayerText = defaultText) =>
    god(
      SHERIFF_SCRIPT_JUDGE_HANDLERS.sheriff_direction_chosen!(event, locale, text)!,
      locale,
      undefined,
      text,
    ),
};

export const SHERIFF_EVENT_JUDGE_HANDLERS: ScriptRendering.ScriptJudgeLineHandlers = {
  sheriff_pk_started: (event, locale = "zh-CN", text: PlayerText = defaultText) =>
    text(locale, "console.pk.sheriff", {
      players: event.payload.candidates
        .map((id) => text(locale, "common.player_reference", { id }))
        .join(", "),
    }),
  sheriff_badge_transferred: (event, locale = "zh-CN", text: PlayerText = defaultText) =>
    text(locale, "console.judge.badge_transfer", {
      from: event.payload.fromId,
      to: event.payload.toId,
    }),
  sheriff_badge_destroyed: (event, locale = "zh-CN", text: PlayerText = defaultText) =>
    text(locale, "console.judge.badge_destroy", { target: event.payload.targetId }),
};

export const SHERIFF_EVENT_STAGE_HANDLERS: ScriptRendering.ScriptReplayStageHandlers = {
  sheriff_pk_started: () => "sheriff_pk_speech",
  sheriff_candidate_declared: () => "sheriff",
  sheriff_candidates_finalized: () => "sheriff",
  sheriff_vote_cast: () => "sheriff",
  sheriff_elected: () => "sheriff",
};

export const SHERIFF_EVENT_LIVE_HANDLERS: ScriptRendering.ScriptLiveRenderHandlers = {
  sheriff_pk_started: (event, _private, locale = "zh-CN", text: PlayerText = defaultText) => [
    {
      kind: "god",
      text: text(locale, "console.pk.sheriff", {
        players: event.payload.candidates
          .map((id) => text(locale, "common.player_reference", { id }))
          .join(", "),
      }),
    },
  ],
};
