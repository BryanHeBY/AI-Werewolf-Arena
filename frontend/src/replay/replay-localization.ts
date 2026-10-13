/**
 * 负责复盘的角色、阶段、历史结果 ID 和结束状态展示。输入为事件或结果、语言和原玩家名单；输出保留原历史别名与未知／未结束回退。语言显式传入，事实校验与受众由原 reader 负责；本模块不重新判胜或改写归档。
 */
import { readReplayEvent, readReplayEventType } from "./replay-event-reader";
import { type ReplayEvent, type ReplayDocument } from "@ai-werewolf-arena/replay-contract";
import {
  roleName as sharedRoleName,
  term,
  text,
  dictionaries,
  type Locale,
  type MessageKey,
} from "@ai-werewolf-arena/game-text";
import { outcomeLabel } from "@ai-werewolf-arena/game-presentation";

export { type Locale };
export function roleName(role: string, locale: Locale = "zh-CN"): string {
  return sharedRoleName(role, locale);
}
export function campName(camp: string, locale: Locale = "zh-CN"): string {
  return term("camp_team", camp, locale);
}
export function phaseName(phase: string, locale: Locale = "zh-CN"): string {
  return term("phase", phase, locale);
}
export function stageName(stage: string, locale: Locale = "zh-CN"): string {
  const key = `replay.stage.${stage}` as MessageKey;
  return Object.hasOwn(dictionaries[locale], key)
    ? text(locale, key)
    : term("stage", stage, locale);
}
const GIFT_ACTION_EVENTS = new Set([
  "guard_applied",
  "seer_checked",
  "role_inspected",
  "witch_potion_used",
  "witch_potion_skipped",
  "dream_applied",
]);
/** 赠予实例只描述能力行动，不把受赠者误标成原生能力所属角色。 */
export function eventStageName(
  event: ReplayEvent,
  locale: Locale = "zh-CN",
  playerIds?: readonly number[],
): string {
  const fact = readReplayEvent(event, playerIds);
  if (!fact) return text(locale, "replay.unknown");
  const abilityId = fact.event.payload.abilityId;
  if (
    GIFT_ACTION_EVENTS.has(fact.event.type) &&
    typeof abilityId === "string" &&
    abilityId.startsWith("gift:")
  )
    return text(locale, "replay.stage.gift_ability");
  return stageName(fact.event.stage ?? fact.event.type, locale);
}
// 这些是历史归档原因 ID；当前记录已使用规范 ID，读取旧档时保留别名映射。
const historicalReasons: Readonly<Record<string, string>> = Object.freeze({
  wolves_eliminated: "all_wolves_eliminated",
  slaughter_side: "slaughter_side_completed",
  slaughter_city: "all_good_eliminated",
  wolf_reach_half: "wolves_reach_half",
});
export function resultReasonName(reason: string | null, locale: Locale = "zh-CN"): string {
  return reason
    ? term(
        "reason",
        Object.hasOwn(historicalReasons, reason) ? historicalReasons[reason] : reason,
        locale,
      )
    : "—";
}

export function replayResultLabel(replay: ReplayDocument, locale: Locale): string {
  if (replay.result.decision) return outcomeLabel(replay.result.decision.outcome, locale);
  const playerIds = replay.players.map((player) => player.player_id);
  const facts = replay.events.map((event) => readReplayEvent(event, playerIds));
  for (let index = replay.events.length - 1; index >= 0; index--) {
    const fact = facts[index];
    const type = fact?.event.type ?? readReplayEventType(replay.events[index]!);
    if (type === null) return text(locale, "replay.unknown");
    if (type !== "game_over") continue;
    if (!fact) return text(locale, "replay.unknown");
    const victory = fact.effects.find((effect) => effect.kind === "victory");
    if (victory?.kind === "victory") return outcomeLabel(victory.decision.outcome, locale);
  }
  if (replay.result.winner) return campName(replay.result.winner, locale);
  const ended =
    ["max_days_reached", "completed"].includes(replay.result.reason ?? "") ||
    facts.some(
      (fact) =>
        fact?.event.type === "game_over" ||
        (fact?.event.type === "phase_changed" && fact.event.payload.phase === "game_over"),
    );
  return text(locale, ended ? "replay.no_winner" : "replay.unfinished");
}
