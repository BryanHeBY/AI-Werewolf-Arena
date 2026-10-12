/**
 * Responsibility: read fragrant-pair facts at a recorded publication position.
 * Input: a reproduction archive and causal prefix.
 * Output: detached historical feed data.
 * Boundary: never grants live disclosure or writes relation state.
 */
import { FRAGRANT_PAIR_EVENT_TYPES } from "@ai-werewolf-arena/game-contract/facts/fragrant-pair-seer";
import type { ReproductionRecord } from "./reproduction";
/** Literal finite-board authorization/projection oracle, independent of the engine feed. */
export function fragrantFeedAt(r: ReproductionRecord, cursor: number, actor: number): unknown[] {
  const publicTypes = new Set([
      "phase_changed",
      "day_speech",
      "night_resolved",
      "additional_deaths",
      "vote_summary",
      "voted_out",
      "game_over",
      "wolf_self_destruct",
      "last_words_granted",
      "last_words_spoken",
      "sheriff_nomination_summary",
      "sheriff_withdraw_summary",
      "sheriff_candidates_finalized",
      "sheriff_pk_started",
      "exile_pk_started",
      "sheriff_vote_summary",
      "sheriff_badge_transferred",
      "sheriff_badge_destroyed",
      "sheriff_direction_chosen",
    ]),
    packTypes = new Set([
      "wolf_tactical_order",
      "wolf_discussion",
      "wolf_discussion_ended",
      "wolf_kill_vote_cast",
    ]);
  const out: unknown[] = [];
  for (const e of r.events.slice(0, cursor)) {
    const p = e.payload;
    let payload: Record<string, unknown> | null = null,
      type = e.type;
    if ((FRAGRANT_PAIR_EVENT_TYPES as readonly string[]).includes(type)) {
      if (
        ["fragrant_pair_chosen", "fragrant_pair_inspected", "fragrant_night_notified"].includes(
          type,
        ) &&
        p.actorId === actor &&
        e.audience?.length === 1 &&
        e.audience[0] === actor
      )
        payload = structuredClone(p);
    } else if (type === "hunter_shot") {
      type = "player_shot";
      payload = { actorId: p.hunterId, targetId: p.targetId };
    } else if (packTypes.has(type)) {
      if (e.audience?.includes(actor)) payload = structuredClone(p);
    } else if (["witch_potion_used", "witch_potion_skipped", "guard_applied"].includes(type)) {
      if (p.actorId === actor) payload = structuredClone(p);
    } else if (publicTypes.has(type)) {
      if (type === "vote_summary") {
        const { tally: _tally, ...rest } = p;
        payload = structuredClone(rest);
      } else payload = structuredClone(p);
    }
    if (payload) out.push({ seq: out.length + 1, type, payload });
  }
  return out;
}
