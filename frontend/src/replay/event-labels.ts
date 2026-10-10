import { magicianEventLabel } from "@ai-werewolf-arena/game-text";
import { redMoonEventLabel } from "@ai-werewolf-arena/game-text";
import { nightmareEventLabel } from "@ai-werewolf-arena/game-text";
import { demonHunterEventLabel } from "@ai-werewolf-arena/game-text";
import { ghostBrideEventLabel } from "@ai-werewolf-arena/game-text";
import { lonelyGirlEventLabel } from "@ai-werewolf-arena/game-text";
import { wildChildEventLabel } from "@ai-werewolf-arena/game-text";
import { shapeshifterEventLabel } from "@ai-werewolf-arena/game-text";
import { thiefEventLabel } from "@ai-werewolf-arena/game-text";
import { readReplayEvent } from "./replay-event-reader";
import type { ReplayEvent } from "@ai-werewolf-arena/replay-contract";
import {
  readGravekeeperFeedback,
  readSeerInspectionResult,
  readVictoryResult,
} from "@ai-werewolf-arena/replay-contract";
import { readInspectionResult } from "@ai-werewolf-arena/replay-contract";
import {
  text,
  term,
  inspectionLabel,
  outcomeLabel,
  outcomeWinnersLabel,
  mechanicalEventLabel,
  merchantEventLabel,
  hybridEventLabel,
  cupidEventLabel,
  wallEventLabel,
  debateEventLabel,
  awakenedEventLabel,
  deathAbilityEventLabel,
  blackMarketEventLabel,
  type Locale,
  type MessageKey,
} from "@ai-werewolf-arena/game-text";
import { campName, phaseName, resultReasonName, roleName } from "./replay-localization";

export function eventLabel(
  event: ReplayEvent,
  locale: Locale = "zh-CN",
  playerIds?: readonly number[],
): string {
  const fact = readReplayEvent(event, playerIds);
  if (!fact) return text(locale, "replay.unknown");
  event = fact.event;
  const p = event.payload;
  const magician = magicianEventLabel(event.type, p, locale);
  if (magician !== null) return magician;
  const redMoon = redMoonEventLabel(event.type, p, locale);
  if (redMoon !== null) return redMoon;
  const black = blackMarketEventLabel(event.type, p, locale);
  if (black !== null) return black;
  const deathAbility = deathAbilityEventLabel(event.type, p, locale);
  if (deathAbility !== null) return deathAbility;
  const awakened = awakenedEventLabel(event.type, p, locale);
  if (awakened !== null) return awakened;
  const nightmare = nightmareEventLabel(event.type, p, locale);
  if (nightmare !== null) return nightmare;
  const demon = demonHunterEventLabel(event.type, p, locale);
  if (demon !== null) return demon;
  const wedding = ghostBrideEventLabel(event.type, p, locale);
  if (wedding !== null) return wedding;
  const lonely = lonelyGirlEventLabel(event.type, p, locale);
  if (lonely) return lonely;
  const wild = wildChildEventLabel(event.type, p, locale);
  if (wild !== null) return wild;
  const shape = shapeshifterEventLabel(event.type, p, locale);
  if (shape !== null) return shape;
  const thief = thiefEventLabel(event.type, p, locale);
  if (thief !== null) return thief;
  const wall = wallEventLabel(event.type, p, locale);
  if (wall !== null) return wall;
  const debate = debateEventLabel(event.type, p, locale);
  if (debate !== null) return debate;
  const cupid = cupidEventLabel(event.type, p, locale);
  if (cupid !== null) return cupid;
  const hybrid = hybridEventLabel(event.type, p, locale);
  if (hybrid !== null) return hybrid;
  const merchant = merchantEventLabel(event.type, p, locale);
  if (merchant !== null) return merchant;
  const mechanical = mechanicalEventLabel(event.type, p, locale);
  if (mechanical !== null) return mechanical;
  const t = (key: MessageKey, params?: Record<string, string | number>) =>
    text(locale, key, params);
  const actor = numberValue(p.actorId);
  const target = numberValue(p.targetId);
  const players = (value: unknown) => numberList(value, locale) || t("replay.none");
  switch (event.type) {
    case "player_role_revealed":
      return t("console.role_revealed", {
        actor: numberValue(p.playerId),
        role: roleName(stringValue(p.role), locale),
      });
    case "sheriff_pk_started":
      return t("console.pk.sheriff", { players: players(p.candidates) });
    case "exile_pk_started":
      return t("console.pk.exile", { players: players(p.candidates) });
    case "lucky_ability_skipped":
      return t("replay.gift_ability_skipped", {
        actor,
        day: numberValue(p.day),
        ability: stringValue(p.abilityId),
      });
    case "gargoyle_awakened":
      return t("console.gargoyle.awakened", { actor, day: numberValue(p.day) });
    case "role_inspection_skipped":
      return p.reason === "passed" || p.reason === "no_targets"
        ? t("console.role_inspection.skipped", {
            actor,
            day: numberValue(p.day),
            reason: t(
              p.reason === "passed" ? "inspection.skip.passed" : "inspection.skip.no_targets",
            ),
          })
        : t("replay.unknown");
    case "role_inspected": {
      const result = readInspectionResult(p.result);
      return result?.kind === "role"
        ? t("console.role_inspected", { actor, target, result: inspectionLabel(result, locale) })
        : t("replay.unknown");
    }
    case "hidden_wolf_awakened":
      return t("console.hidden_wolf.awakened", { actor, day: numberValue(p.day) });
    case "bear_roared":
      return typeof p.roared === "boolean"
        ? t("console.bear.report", {
            day: numberValue(p.day),
            result: t(p.roared ? "bear.roar" : "bear.quiet"),
          })
        : t("replay.unknown");
    case "charm_applied":
      return t("console.charm.applied", {
        actor,
        target: p.targetId === null ? t("common.none") : target,
        day: numberValue(p.day),
      });
    case "charm_death":
      return t("console.charm.death", { actor, target });
    case "charm_blocked":
      return p.reason === "night_protection"
        ? t("console.charm.blocked", { actor, target })
        : t("replay.unknown");
    case "additional_deaths":
      return t("console.additional_deaths", { players: numberList(p.deaths, locale) });
    case "dream_applied":
      return typeof p.consecutive === "boolean"
        ? t("console.dream.applied", {
            actor,
            target,
            day: numberValue(p.day),
            consecutive: t(p.consecutive ? "common.yes" : "common.no"),
          })
        : t("replay.unknown");
    case "dream_death":
      return p.reason === "consecutive" || p.reason === "linked"
        ? t("console.dream.death", {
            actor,
            target,
            day: numberValue(p.day),
            reason: t(
              p.reason === "consecutive" ? "console.dream.consecutive" : "console.dream.linked",
            ),
          })
        : t("replay.unknown");
    case "death_shot_blocked":
      return p.reason === "night_protection"
        ? t("console.shot.blocked", { actor, target })
        : t("replay.unknown");
    case "gravekeeper_reported": {
      const report = readGravekeeperFeedback(p);
      return report
        ? t("console.gravekeeper.report", {
            actor: report.actorId,
            target: report.targetId,
            exileDay: report.exileDay,
            receivedDay: report.receivedDay,
            result: inspectionLabel(report.result, locale),
          })
        : t("replay.unknown");
    }
    case "ability_changed": {
      const kind = stringValue(p.kind),
        operation = stringValue(p.operation);
      return t("ability.change", {
        actor,
        id: stringValue(p.abilityId),
        kind: ["seer_check", "role_check", "guard", "potion", "dream"].includes(kind)
          ? t(`ability.kind.${kind}` as MessageKey)
          : kind,
        operation: ["granted", "disabled", "enabled", "transferred_out"].includes(operation)
          ? t(`ability.operation.${operation}` as MessageKey)
          : operation,
      });
    }
    case "god_private_game_info":
      return t("replay.lineup", { players: formatRoleLineup(p.players, locale) });
    case "phase_changed": {
      const phase = stringValue(p.phase) || event.phase;
      if (phase === "night" || phase === "day") return t(`replay.${phase}`, { day: event.day });
      if (phase === "voting") return t("replay.voting");
      if (phase === "game_over") return t("replay.finished");
      return t("replay.enter_phase", { phase: phaseName(phase, locale) });
    }
    case "wolf_tactical_order":
      return t("replay.wolf_order", { order: numberList(p.order, locale, " → ") });
    case "wolf_discussion":
      return t("replay.wolf_speech", { actor, speech: stringValue(p.text) });
    case "wolf_discussion_ended":
      return t("replay.wolf_end", { actor, reason: stringValue(p.reason) });
    case "wolf_kill_vote_cast":
      return p.abstain === true
        ? t("replay.kill_skip", { actor })
        : t("replay.kill_vote", { actor, target });
    case "guard_applied":
      return p.abstain === true || p.targetId === null
        ? t("replay.guard_skip", { actor })
        : t("replay.guard", { actor, target });
    case "seer_checked": {
      const result = readSeerInspectionResult(p);
      let label = result ? inspectionLabel(result, locale) : "?";
      if (!result) {
        try {
          const raw = Object.getOwnPropertyDescriptor(p, "result");
          if (raw && Object.hasOwn(raw, "value")) label = JSON.stringify(raw.value) ?? "?";
        } catch {
          /* Invalid non-JSON diagnostic values remain unknown. */
        }
      }
      return t("replay.check", { actor, target, camp: label });
    }
    case "witch_potion_used":
      return t("replay.potion", {
        actor,
        target,
        potion:
          p.potionType === "heal" || p.potionType === "poison"
            ? term("potion", p.potionType, locale)
            : stringValue(p.potionType) || t("replay.potion_generic"),
      });
    case "witch_potion_skipped":
      return t("replay.potion_skip", { actor });
    case "sheriff_nomination_summary":
      return t("replay.nomination", { players: players(p.candidates) });
    case "sheriff_candidate_declared":
      return t(p.run === true ? "replay.run" : "replay.not_run", { actor });
    case "sheriff_withdraw_summary":
      return t("replay.withdraw", { players: players(p.withdrawn) });
    case "sheriff_candidates_finalized":
      return t("replay.candidates", { players: players(p.candidates) });
    case "sheriff_vote_cast":
      return voteLabel(p, t("replay.sheriff_vote_label"), locale);
    case "sheriff_vote_summary":
      return t("replay.sheriff_votes", {
        votes: voteLineup(p.votes, locale),
        result:
          p.winnerId == null
            ? t("replay.no_sheriff")
            : t("replay.elected", { actor: numberValue(p.winnerId) }),
      });
    case "sheriff_elected":
      return t("replay.elected", { actor: numberValue(p.winnerId) });
    case "sheriff_direction_chosen":
      return t("replay.direction", {
        actor: numberValue(p.sheriffId),
        direction:
          p.direction === "clockwise" || p.direction === "counter_clockwise"
            ? t(`console.direction.${p.direction}`)
            : stringValue(p.direction) || "?",
      });
    case "sheriff_badge_transferred":
      return t("replay.badge_transfer", { from: numberValue(p.fromId), to: numberValue(p.toId) });
    case "sheriff_badge_destroyed":
      return t("replay.badge_destroy", { actor: numberValue(p.targetId) });
    case "day_speech":
      return t("replay.day_speech", { actor, speech: stringValue(p.text) });
    case "night_resolved":
      return numberList(p.deaths, locale)
        ? t("replay.deaths", { players: players(p.deaths) })
        : t("replay.peace");
    case "vote_cast":
      return voteLabel(p, t("replay.exile_vote_label"), locale);
    case "vote_summary":
      return t("replay.votes", { votes: voteLineup(p.votes, locale) });
    case "voted_out":
      return t("replay.exile", { actor: numberValue(p.target) });
    case "idiot_revealed":
      return t("replay.idiot", { actor: target });
    case "wolf_self_destruct":
      return t("replay.blast", { actor: numberValue(p.wolfId) });
    case "white_wolf_king_self_destruct":
      return p.targetId === null
        ? t("console.white_wolf_king.blast_none", { actor })
        : t("console.white_wolf_king.blast", { actor, target });
    case "knight_duel":
      return p.result === "wolf" || p.result === "not_wolf"
        ? t(p.result === "wolf" ? "console.knight.wolf" : "console.knight.miss", { actor, target })
        : t("replay.unknown");
    case "hunter_shot":
      return t("replay.shot", { actor: numberValue(p.hunterId), target });
    case "player_shot":
      return t("console.player_shot", { actor, target });
    case "wolf_king_shot":
      return t("console.judge.wolf_king_shot", { actor, target });
    case "hunter_silent_due_to_poison":
      return t("replay.poisoned_hunter", { actor: numberValue(p.hunterId) });
    case "last_words_granted":
      return t("replay.last_granted", { actor: numberValue(p.playerId) });
    case "last_words_spoken":
      return t("replay.last_spoken", {
        actor: numberValue(p.playerId),
        speech: stringValue(p.text),
      });
    case "game_over": {
      if (Object.hasOwn(p, "outcome") || Object.hasOwn(p, "decidedAt")) {
        try {
          const result = readVictoryResult(p, playerIds);
          return `${t("victory.finished", { result: outcomeLabel(result.outcome, locale), reason: resultReasonName(result.reason, locale) })} · ${outcomeWinnersLabel(result.outcome, locale)}`;
        } catch {
          return t("replay.unknown");
        }
      }
      const reason = stringValue(p.reason)
        ? resultReasonName(stringValue(p.reason), locale)
        : t("replay.no_reason");
      return stringValue(p.winner)
        ? t("replay.over", { winner: campName(stringValue(p.winner), locale), reason })
        : t("replay.over_no_winner", { reason });
    }
    default:
      return typeof p.text === "string" ? p.text : event.type;
  }
}
function stringValue(value: unknown): string {
  return typeof value === "string" ? value : "";
}
function numberValue(value: unknown): string {
  return typeof value === "number" && Number.isFinite(value) ? String(value) : "?";
}
function numberList(
  value: unknown,
  locale: Locale,
  separator = locale === "zh-CN" ? "、" : ", ",
): string {
  return Array.isArray(value)
    ? value
        .filter((item) => typeof item === "number" && Number.isFinite(item))
        .map((id) => text(locale, "replay.player", { id }))
        .join(separator)
    : "";
}
function voteLabel(p: Record<string, unknown>, label: string, locale: Locale): string {
  const actor = numberValue(p.actorId);
  if (p.abstain === true || p.targetId == null)
    return text(locale, "replay.vote_skip", { actor, label });
  const weight =
    typeof p.weight === "number" && Number.isFinite(p.weight) && p.weight !== 1
      ? text(locale, "replay.weight", { weight: p.weight })
      : "";
  return text(locale, "replay.vote", { actor, label, target: numberValue(p.targetId), weight });
}
function voteLineup(value: unknown, locale: Locale): string {
  if (!Array.isArray(value) || !value.length) return text(locale, "replay.none");
  return value
    .map((item) => {
      if (!item || typeof item !== "object") return "?";
      const p = item as Record<string, unknown>;
      const actor = numberValue(p.actorId);
      if (p.abstain === true || p.targetId == null)
        return text(locale, "replay.vote_abstain", { actor });
      const weight =
        typeof p.weight === "number" && Number.isFinite(p.weight) && p.weight !== 1
          ? text(locale, "replay.vote_weight", { weight: p.weight })
          : "";
      return text(locale, "replay.vote_arrow", { actor, target: numberValue(p.targetId), weight });
    })
    .join(locale === "zh-CN" ? "，" : ", ");
}
function formatRoleLineup(value: unknown, locale: Locale): string {
  if (!Array.isArray(value)) return text(locale, "replay.unknown");
  return value
    .map((item) => {
      if (!item || typeof item !== "object") return "?";
      const p = item as Record<string, unknown>;
      return text(locale, "replay.lineup_player", {
        id: numberValue(p.seat ?? p.id),
        role: roleName(stringValue(p.role) || "unknown", locale),
      });
    })
    .join(locale === "zh-CN" ? "，" : ", ");
}
