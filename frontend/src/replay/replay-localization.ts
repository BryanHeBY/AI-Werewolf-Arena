import { readReplayEvent } from "./replay-event-reader";
import { type ReplayEvent, type ReplayDocument } from "@ai-werewolf-arena/replay-contract";
import {
  roleName as sharedRoleName,
  term,
  text,
  dictionaries,
  outcomeLabel,
  type Locale,
  type MessageKey,
} from "@ai-werewolf-arena/game-text";

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
/** Explicit gift instances describe an action without attributing the recipient's physical role. */
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
// These are archived reason IDs; current records already use the canonical IDs.
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
    if (replay.events[index]!.type !== "game_over") continue;
    const fact = facts[index];
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
