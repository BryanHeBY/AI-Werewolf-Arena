import { text, type Locale } from "@ai-werewolf-arena/game-text";
/** 文件说明：事件 -> 脚本回放文本/终端文本渲染注册表。 */
import { GameEvent } from "../../../core/domain/model";
import {
  ScriptChatLineHandlers,
  ScriptJudgeLineHandlers,
  ScriptLiveRender,
  ScriptLiveRenderHandlers,
  ScriptReplayStageHandlers,
} from "./contracts";
import { GUARD_SCRIPT_LIVE_HANDLERS } from "../roles/guard/event_presenters";
import { HUNTER_SCRIPT_JUDGE_HANDLERS } from "../roles/hunter/event_presenters";
import { SEER_SCRIPT_LIVE_HANDLERS } from "../roles/seer/event_presenters";
import { WITCH_SCRIPT_LIVE_HANDLERS } from "../roles/witch/event_presenters";
import {
  WOLF_SCRIPT_CHAT_HANDLERS,
  WOLF_SCRIPT_LIVE_HANDLERS,
} from "../roles/wolf/event_presenters";
import { LAST_WORDS_SCRIPT_JUDGE_HANDLERS } from "../last_words/event_presenters";
import { LAST_WORDS_SCRIPT_LIVE_HANDLERS } from "../last_words/event_presenters";
import { IDIOT_SCRIPT_JUDGE_HANDLERS } from "../roles/idiot/event_presenters";
import {
  SHERIFF_SCRIPT_JUDGE_HANDLERS,
  SHERIFF_SCRIPT_LIVE_HANDLERS,
} from "../sheriff/event_presenters";
import { getDefaultTextLocalizationRegistry } from "../shared/text_localization_registry";

const CHAT_HANDLERS: ScriptChatLineHandlers = {
  day_speech: (event, locale = "zh-CN") => text(locale, "console.chat.day", { actor: event.payload.actorId, speech: event.payload.text }),
  ...WOLF_SCRIPT_CHAT_HANDLERS,
};

const JUDGE_HANDLERS: ScriptJudgeLineHandlers = {
  phase_changed: (event, locale = "zh-CN") => {
    const p = event.payload;
    if (p.phase === "night") return text(locale, "console.judge.night", { day: p.day });
    if (p.phase === "day") return text(locale, "console.judge.day", { day: p.day });
    if (p.phase === "voting") return text(locale, "console.judge.voting");
    if (p.phase === "game_over") {
      const i18n = getDefaultTextLocalizationRegistry();
      return p.winner != null && p.reason != null ? text(locale, "console.judge.over", { winner: i18n.winnerName(p.winner, locale), reason: i18n.gameOverReason(p.reason, locale) }) : text(locale, "console.judge.over_short");
    }
    return null;
  },
  night_resolved: (event, locale = "zh-CN") => event.payload.deaths.length ? text(locale, "console.judge.deaths", { deaths: event.payload.deaths.join(", ") }) : text(locale, "console.judge.peace"),
  vote_summary: (event, locale = "zh-CN") => text(locale, "console.judge.votes", { votes: event.payload.votes.map(item => {
    const vote = item.abstain || item.targetId == null ? text(locale, "console.vote.abstain", { actor: item.actorId }) : text(locale, "console.vote.target", { actor: item.actorId, target: item.targetId });
    return item.weight !== 1 ? `${vote}(w=${item.weight})` : vote;
  }).join(", ") }),
  voted_out: (event, locale = "zh-CN") => text(locale, "console.judge.exile", { target: event.payload.target }),
  sheriff_badge_transferred: (event, locale = "zh-CN") => text(locale, "console.judge.badge_transfer", { from: event.payload.fromId, to: event.payload.toId }),
  sheriff_badge_destroyed: (event, locale = "zh-CN") => text(locale, "console.judge.badge_destroy", { target: event.payload.targetId }),
  wolf_self_destruct: (event, locale = "zh-CN") => text(locale, "console.judge.blast", { actor: event.payload.wolfId }),
  game_over: (event, locale = "zh-CN") => text(locale, "console.judge.result", { winner: getDefaultTextLocalizationRegistry().winnerName(event.payload.winner ?? "", locale), reason: getDefaultTextLocalizationRegistry().gameOverReason(event.payload.reason ?? "", locale) }),
  ...LAST_WORDS_SCRIPT_JUDGE_HANDLERS, ...IDIOT_SCRIPT_JUDGE_HANDLERS, ...HUNTER_SCRIPT_JUDGE_HANDLERS, ...SHERIFF_SCRIPT_JUDGE_HANDLERS,
};

const REPLAY_STAGE_HANDLERS: ScriptReplayStageHandlers = {
  phase_changed: (event) => String(event.payload.phase ?? "phase_changed"),
  day_speech: () => "day_speech",
  vote_cast: () => "voting",
  vote_summary: () => "voting",
  voted_out: () => "voting",
  idiot_revealed: () => "voting",
  wolf_discussion: () => "wolf_discussion",
  wolf_discussion_ended: () => "wolf_discussion",
  wolf_kill_vote_cast: () => "wolf_discussion",
  guard_applied: () => "guard",
  seer_checked: () => "seer",
  witch_potion_used: () => "witch",
  witch_potion_skipped: () => "witch",
  sheriff_candidate_declared: () => "sheriff",
  sheriff_candidates_finalized: () => "sheriff",
  sheriff_vote_cast: () => "sheriff",
  sheriff_elected: () => "sheriff",
};

const LIVE_HANDLERS: ScriptLiveRenderHandlers = {
  ability_changed: (event, printPrivateEvents, locale = "zh-CN") => printPrivateEvents ? [{ kind: "private", text: text(locale, "ability.change", { actor: event.payload.actorId, id: event.payload.abilityId, kind: text(locale, `ability.kind.${event.payload.kind}`), operation: text(locale, `ability.operation.${event.payload.operation}`) }) }] : [],
  god_private_game_info: (event, _private, locale = "zh-CN") => [{ kind: "god", text: text(locale, "console.live.initial", { roles: event.payload.players.map(item => `${item.seat}:${getDefaultTextLocalizationRegistry().roleName(item.role, locale)}`).join(", ") }) }],
  day_speech: (event, _private, locale = "zh-CN") => [{ kind: "system", text: text(locale, "console.live.day", { actor: event.payload.actorId, speech: event.payload.text }) }],
  game_over: (event, _private, locale = "zh-CN") => [{ kind: "god", text: text(locale, "console.live.result", { winner: getDefaultTextLocalizationRegistry().winnerName(event.payload.winner ?? "", locale), reason: getDefaultTextLocalizationRegistry().gameOverReason(event.payload.reason ?? "", locale) }) }],
  ...WOLF_SCRIPT_LIVE_HANDLERS, ...SEER_SCRIPT_LIVE_HANDLERS, ...GUARD_SCRIPT_LIVE_HANDLERS, ...WITCH_SCRIPT_LIVE_HANDLERS, ...LAST_WORDS_SCRIPT_LIVE_HANDLERS, ...SHERIFF_SCRIPT_LIVE_HANDLERS,
};

/** 脚本渲染注册表。 */
export class ScriptEventRenderRegistry {
  toChatLine(event: GameEvent, locale: Locale = "zh-CN"): string | null {
    const handler = CHAT_HANDLERS[event.type];
    return handler ? (handler as (event: GameEvent, locale: Locale) => string | null)(event, locale) : null;
  }

  toJudgeLine(event: GameEvent, locale: Locale = "zh-CN"): string | null {
    const handler = JUDGE_HANDLERS[event.type];
    return handler ? (handler as (event: GameEvent, locale: Locale) => string | null)(event, locale) : null;
  }

  toReplayStage(event: GameEvent): string {
    const handler = REPLAY_STAGE_HANDLERS[event.type];
    if (handler) {
      return (handler as (event: GameEvent) => string | null)(event) ?? event.type;
    }
    return event.type;
  }

  toLiveRender(event: GameEvent, printPrivateEvents: boolean, locale: Locale = "zh-CN"): ScriptLiveRender[] {
    const handler = LIVE_HANDLERS[event.type];
    if (handler) {
      const rendered = (handler as (event: GameEvent, printPrivateEvents: boolean, locale: Locale) => ScriptLiveRender[] | null)(event, printPrivateEvents, locale);
      if (rendered) {
        return rendered;
      }
    }
    const judge = this.toJudgeLine(event, locale);
    if (judge) {
      return [{ kind: "god", text: text(locale, "console.live.god", { line: judge }) }];
    }
    return [];
  }
}

let defaultRegistry: ScriptEventRenderRegistry | null = null;

/** 获取默认脚本渲染注册表实例。 */
export function getDefaultScriptEventRenderRegistry(): ScriptEventRenderRegistry {
  if (!defaultRegistry) {
    defaultRegistry = new ScriptEventRenderRegistry();
  }
  return defaultRegistry;
}
