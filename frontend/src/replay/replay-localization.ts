import { readVictoryResult, type ReplayDocument } from "@ai-werewolf-arena/replay-contract";
import { roleName as sharedRoleName, term, text, dictionaries, outcomeLabel, type Locale, type MessageKey } from "@ai-werewolf-arena/game-text";

export { type Locale };
export function roleName(role: string, locale: Locale = "zh-CN"): string { return sharedRoleName(role, locale); }
export function campName(camp: string, locale: Locale = "zh-CN"): string { return term("camp_team", camp, locale); }
export function phaseName(phase: string, locale: Locale = "zh-CN"): string { return term("phase", phase, locale); }
export function stageName(stage: string, locale: Locale = "zh-CN"): string {
  const key = `replay.stage.${stage}` as MessageKey;
  return Object.hasOwn(dictionaries[locale], key) ? text(locale, key) : term("stage", stage, locale);
}
// These are archived reason IDs; current records already use the canonical IDs.
const historicalReasons: Readonly<Record<string, string>> = Object.freeze({
  wolves_eliminated: "all_wolves_eliminated", slaughter_side: "slaughter_side_completed",
  slaughter_city: "all_good_eliminated", wolf_reach_half: "wolves_reach_half",
});
export function resultReasonName(reason: string | null, locale: Locale = "zh-CN"): string {
  return reason ? term("reason", Object.hasOwn(historicalReasons, reason) ? historicalReasons[reason] : reason, locale) : "—";
}

export function replayResultLabel(replay: ReplayDocument, locale: Locale): string {
  if (replay.result.decision) return outcomeLabel(replay.result.decision.outcome, locale);
  const explicitTerminal = [...replay.events].reverse().find(event => event.type === "game_over" && (Object.hasOwn(event.payload, "outcome") || Object.hasOwn(event.payload, "decidedAt")));
  if (explicitTerminal) {
    try { return outcomeLabel(readVictoryResult(explicitTerminal.payload, replay.players.map(player => player.player_id)).outcome, locale); }
    catch { return text(locale, "replay.unknown"); }
  }
  if (replay.result.winner) return campName(replay.result.winner, locale);
  const ended = ["max_days_reached", "completed"].includes(replay.result.reason ?? "")
    || replay.events.some(event => event.type === "game_over" || event.type === "phase_changed" && event.payload.phase === "game_over");
  return text(locale, ended ? "replay.no_winner" : "replay.unfinished");
}
