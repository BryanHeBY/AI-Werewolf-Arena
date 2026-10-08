import { readGravekeeperFeedback, readVictoryResult } from "@ai-werewolf-arena/replay-contract";
import { text, inspectionLabel, outcomeLabel, outcomeWinnersLabel, victoryPointLabel, mechanicalEventLabel, merchantEventLabel, hybridEventLabel, type Locale } from "@ai-werewolf-arena/game-text";
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

function resultLabel(payload: unknown, locale: Locale, key: "console.judge.result" | "console.live.result"): string {
  if (payload && typeof payload === "object" && (Object.hasOwn(payload, "outcome") || Object.hasOwn(payload, "decidedAt"))) {
    try {
      const decision = readVictoryResult(payload);
      return `${text(locale, "victory.finished", { result: outcomeLabel(decision.outcome, locale), reason: getDefaultTextLocalizationRegistry().gameOverReason(decision.reason, locale) })} · ${outcomeWinnersLabel(decision.outcome, locale)} · ${victoryPointLabel(decision.decidedAt, locale)}`;
    } catch { return text(locale, "replay.unknown"); }
  }
  const old = payload as { winner?: string | null; reason?: string };
  return text(locale, key, { winner: getDefaultTextLocalizationRegistry().winnerName(old.winner ?? "", locale), reason: getDefaultTextLocalizationRegistry().gameOverReason(old.reason ?? "", locale) });
}

function gravekeeperLabel(payload: unknown, locale: Locale): string {
  const report = readGravekeeperFeedback(payload);
  return report ? text(locale, "console.gravekeeper.report", { actor: report.actorId, target: report.targetId, exileDay: report.exileDay, receivedDay: report.receivedDay, result: inspectionLabel(report.result, locale) }) : text(locale, "replay.unknown");
}

const CHAT_HANDLERS: ScriptChatLineHandlers = {
  day_speech: (event, locale = "zh-CN") => text(locale, "console.chat.day", { actor: event.payload.actorId, speech: event.payload.text }),
  ...WOLF_SCRIPT_CHAT_HANDLERS,
};

const JUDGE_HANDLERS: ScriptJudgeLineHandlers = {
  player_shot: (event, locale = "zh-CN") => text(locale, "console.player_shot", { actor: event.payload.actorId, target: event.payload.targetId }),
  lucky_ability_skipped: (event,locale="zh-CN") => text(locale,"console.lucky.skipped",{actor:event.payload.actorId,day:event.payload.day,ability:event.payload.abilityId}),
  gargoyle_awakened:(event,locale="zh-CN")=>text(locale,"console.gargoyle.awakened",{actor:event.payload.actorId,day:event.payload.day}),
  role_inspection_skipped:(event,locale="zh-CN")=>text(locale,"console.role_inspection.skipped",{actor:event.payload.actorId,day:event.payload.day,reason:text(locale,event.payload.reason==="passed"?"inspection.skip.passed":"inspection.skip.no_targets")}),
  role_inspected:(event,locale="zh-CN")=>text(locale,"console.role_inspected",{actor:event.payload.actorId,target:event.payload.targetId,result:inspectionLabel(event.payload.result,locale)}),
  hidden_wolf_awakened:(event,locale="zh-CN")=>text(locale,"console.hidden_wolf.awakened",{actor:event.payload.actorId,day:event.payload.day}),
  bear_roared:(event,locale="zh-CN")=>text(locale,"console.bear.report",{day:event.payload.day,result:text(locale,event.payload.roared?"bear.roar":"bear.quiet")}),
  charm_applied:(event,locale="zh-CN")=>text(locale,"console.charm.applied",{actor:event.payload.actorId,target:event.payload.targetId??text(locale,"common.none"),day:event.payload.day}),
  charm_death:(event,locale="zh-CN")=>text(locale,"console.charm.death",{actor:event.payload.actorId,target:event.payload.targetId}),
  charm_blocked:(event,locale="zh-CN")=>text(locale,"console.charm.blocked",{actor:event.payload.actorId,target:event.payload.targetId}),
  additional_deaths:(event,locale="zh-CN")=>text(locale,"console.additional_deaths",{players:event.payload.deaths.join(", ")}),
  dream_applied: (event,locale="zh-CN")=>text(locale,"console.dream.applied",{actor:event.payload.actorId,target:event.payload.targetId,day:event.payload.day,consecutive:text(locale,event.payload.consecutive?"common.yes":"common.no")}),
  dream_death: (event,locale="zh-CN")=>text(locale,"console.dream.death",{actor:event.payload.actorId,target:event.payload.targetId,day:event.payload.day,reason:text(locale,event.payload.reason==="consecutive"?"console.dream.consecutive":"console.dream.linked")}),
  death_shot_blocked: (event,locale="zh-CN")=>text(locale,"console.shot.blocked",{actor:event.payload.actorId,target:event.payload.targetId}),
  gravekeeper_reported: (event, locale = "zh-CN") => gravekeeperLabel(event.payload, locale),
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
  white_wolf_king_self_destruct: (event, locale = "zh-CN") => event.payload.targetId === null ? text(locale, "console.white_wolf_king.blast_none", { actor: event.payload.actorId }) : text(locale, "console.white_wolf_king.blast", { actor: event.payload.actorId, target: event.payload.targetId }),
  knight_duel: (event, locale = "zh-CN") => text(locale, event.payload.result === "wolf" ? "console.knight.wolf" : "console.knight.miss", { actor: event.payload.actorId, target: event.payload.targetId }),
  wolf_king_shot: (event, locale = "zh-CN") => text(locale, "console.judge.wolf_king_shot", { actor: event.payload.actorId, target: event.payload.targetId }),
  game_over: (event, locale = "zh-CN") => resultLabel(event.payload, locale, "console.judge.result"),
  ...LAST_WORDS_SCRIPT_JUDGE_HANDLERS, ...IDIOT_SCRIPT_JUDGE_HANDLERS, ...HUNTER_SCRIPT_JUDGE_HANDLERS, ...SHERIFF_SCRIPT_JUDGE_HANDLERS,
};

const REPLAY_STAGE_HANDLERS: ScriptReplayStageHandlers = {
  player_shot: () => "death_shot",
  gargoyle_awakened:()=>"gargoyle_awakened",role_inspected:()=>"role_inspected",role_inspection_skipped:()=>"role_inspection_skipped",
  hidden_wolf_awakened:()=>"hidden_wolf_awakened",
  bear_roared:()=>"bear_roared",
  dream_applied: ()=>"dreamer", dream_death: ()=>"dream_death",
  gravekeeper_reported: () => "gravekeeper_feedback",
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
  player_shot: (event, _private, locale = "zh-CN") => [{ kind: "action", text: text(locale, "console.player_shot", { actor: event.payload.actorId, target: event.payload.targetId }) }],
  gargoyle_awakened:(event,privateEvents,locale="zh-CN")=>privateEvents?[{kind:"private",text:text(locale,"console.gargoyle.awakened",{actor:event.payload.actorId,day:event.payload.day})}]:[],
  role_inspection_skipped:(event,privateEvents,locale="zh-CN")=>privateEvents?[{kind:"private",text:text(locale,"console.role_inspection.skipped",{actor:event.payload.actorId,day:event.payload.day,reason:text(locale,event.payload.reason==="passed"?"inspection.skip.passed":"inspection.skip.no_targets")})}]:[],
  role_inspected:(event,privateEvents,locale="zh-CN")=>privateEvents?[{kind:"private",text:text(locale,"console.role_inspected",{actor:event.payload.actorId,target:event.payload.targetId,result:inspectionLabel(event.payload.result,locale)})}]:[],
  hidden_wolf_awakened:(event,privateEvents,locale="zh-CN")=>privateEvents?[{kind:"private",text:text(locale,"console.hidden_wolf.awakened",{actor:event.payload.actorId,day:event.payload.day})}]:[],
  bear_roared:(event,_private,locale="zh-CN")=>[{kind:"system",text:text(locale,"console.bear.report",{day:event.payload.day,result:text(locale,event.payload.roared?"bear.roar":"bear.quiet")})}],
  charm_applied:(event,privateEvents,locale="zh-CN")=>privateEvents?[{kind:"private",text:text(locale,"console.charm.applied",{actor:event.payload.actorId,target:event.payload.targetId??text(locale,"common.none"),day:event.payload.day})}]:[],
  charm_death:(event,privateEvents,locale="zh-CN")=>privateEvents?[{kind:"private",text:text(locale,"console.charm.death",{actor:event.payload.actorId,target:event.payload.targetId})}]:[],
  charm_blocked:(event,privateEvents,locale="zh-CN")=>privateEvents?[{kind:"private",text:text(locale,"console.charm.blocked",{actor:event.payload.actorId,target:event.payload.targetId})}]:[],
  additional_deaths:(event,_private,locale="zh-CN")=>[{kind:"system",text:text(locale,"console.additional_deaths",{players:event.payload.deaths.join(", ")})}],
  dream_applied: (event,privateEvents,locale="zh-CN")=>privateEvents?[{kind:"private",text:text(locale,"console.dream.applied",{actor:event.payload.actorId,target:event.payload.targetId,day:event.payload.day,consecutive:text(locale,event.payload.consecutive?"common.yes":"common.no")})}]:[],
  dream_death: (event,privateEvents,locale="zh-CN")=>privateEvents?[{kind:"private",text:text(locale,"console.dream.death",{actor:event.payload.actorId,target:event.payload.targetId,day:event.payload.day,reason:text(locale,event.payload.reason==="consecutive"?"console.dream.consecutive":"console.dream.linked")})}]:[],
  death_shot_blocked: (event,_private,locale="zh-CN")=>[{kind:"system",text:text(locale,"console.shot.blocked",{actor:event.payload.actorId,target:event.payload.targetId})}],
  gravekeeper_reported: (event, printPrivateEvents, locale = "zh-CN") => printPrivateEvents ? [{ kind: "private", text: gravekeeperLabel(event.payload, locale) }] : [],
  ability_changed: (event, printPrivateEvents, locale = "zh-CN") => printPrivateEvents ? [{ kind: "private", text: text(locale, "ability.change", { actor: event.payload.actorId, id: event.payload.abilityId, kind: text(locale, `ability.kind.${event.payload.kind}`), operation: text(locale, `ability.operation.${event.payload.operation}`) }) }] : [],
  god_private_game_info: (event, _private, locale = "zh-CN") => [{ kind: "god", text: text(locale, "console.live.initial", { roles: event.payload.players.map(item => `${item.seat}:${getDefaultTextLocalizationRegistry().roleName(item.role, locale)}`).join(", ") }) }],
  day_speech: (event, _private, locale = "zh-CN") => [{ kind: "system", text: text(locale, "console.live.day", { actor: event.payload.actorId, speech: event.payload.text }) }],
  wolf_king_shot: (event, _private, locale = "zh-CN") => [{ kind: "system", text: text(locale, "console.judge.wolf_king_shot", { actor: event.payload.actorId, target: event.payload.targetId }) }],
  white_wolf_king_self_destruct: (event, _private, locale = "zh-CN") => [{ kind: "system", text: event.payload.targetId === null ? text(locale, "console.white_wolf_king.blast_none", { actor: event.payload.actorId }) : text(locale, "console.white_wolf_king.blast", { actor: event.payload.actorId, target: event.payload.targetId }) }],
  knight_duel: (event, _private, locale = "zh-CN") => [{ kind: "system", text: text(locale, event.payload.result === "wolf" ? "console.knight.wolf" : "console.knight.miss", { actor: event.payload.actorId, target: event.payload.targetId }) }],
  game_over: (event, _private, locale = "zh-CN") => [{ kind: "god", text: resultLabel(event.payload, locale, "console.live.result") }],
  ...WOLF_SCRIPT_LIVE_HANDLERS, ...SEER_SCRIPT_LIVE_HANDLERS, ...GUARD_SCRIPT_LIVE_HANDLERS, ...WITCH_SCRIPT_LIVE_HANDLERS, ...LAST_WORDS_SCRIPT_LIVE_HANDLERS, ...SHERIFF_SCRIPT_LIVE_HANDLERS,
};

/** 脚本渲染注册表。 */
export class ScriptEventRenderRegistry {
  toChatLine(event: GameEvent, locale: Locale = "zh-CN"): string | null {
    const handler = CHAT_HANDLERS[event.type];
    return handler ? (handler as (event: GameEvent, locale: Locale) => string | null)(event, locale) : null;
  }

  toJudgeLine(event: GameEvent, locale: Locale = "zh-CN"): string | null {
    const hybrid = hybridEventLabel(event.type, event.payload, locale); if (hybrid !== null) return hybrid;
    const merchant = merchantEventLabel(event.type, event.payload, locale); if (merchant !== null) return merchant;
    const mechanical = mechanicalEventLabel(event.type, event.payload, locale);
    if (mechanical !== null) return mechanical;
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
    const hybrid = hybridEventLabel(event.type, event.payload, locale);
    if (hybrid !== null) return printPrivateEvents ? [{ kind: event.type === "hybrid_affiliation_resolved" ? "god" : "private", text: hybrid }] : [];
    const merchant = merchantEventLabel(event.type, event.payload, locale);
    if (merchant !== null) return printPrivateEvents ? [{ kind: event.type === "merchant_trade_resolved" ? "god" : "private", text: merchant }] : [];
    if (event.type === "lucky_ability_skipped") return printPrivateEvents ? [{ kind:"private", text:text(locale,"console.lucky.skipped",{actor:event.payload.actorId,day:event.payload.day,ability:event.payload.abilityId}) }] : [];
    const mechanical = mechanicalEventLabel(event.type, event.payload, locale);
    if (mechanical !== null) {
      if (event.type === "mechanical_shot") return [{ kind: "action", text: mechanical }];
      return printPrivateEvents ? [{ kind: event.type === "mechanical_poison_reflected" ? "god" : "private", text: mechanical }] : [];
    }
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
