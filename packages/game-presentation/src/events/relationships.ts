/**
 * 负责双端关系、身份选择和社交事件的展示映射。输入为事件类型、已进入展示边界的纯数据和语言；输出保留原安全读取、未知事件回退和用户原文。告知、关系生效和死亡提交属于领域，这里不重新判定受众或修改事实。
 */
import { readHybridEventFact } from "@ai-werewolf-arena/game-contract/facts/hybrid";
import type { MessageKey } from "@ai-werewolf-arena/game-contract";
import {
  readWildChildEventFact,
  readWildChildPlayerFact,
} from "@ai-werewolf-arena/game-contract/facts/wild-child";
import type { RoleId } from "@ai-werewolf-arena/game-catalog";
import { readShapeshifterEventFact } from "@ai-werewolf-arena/game-contract/facts/shapeshifter";
import { readThiefEventFact } from "@ai-werewolf-arena/game-contract/facts/thief";
import { readWallEventFact } from "@ai-werewolf-arena/game-contract/facts/wall-notes";
import { type Locale } from "@ai-werewolf-arena/game-catalog";
import {
  DEBATE_EVENT_TYPES,
  readDebateEventFact,
} from "@ai-werewolf-arena/game-contract/facts/debate";
import {
  CUPID_EVENT_TYPES,
  readCupidEventFact,
} from "@ai-werewolf-arena/game-contract/facts/cupid";
import { readLonelyGirlEventFact } from "@ai-werewolf-arena/game-contract/facts/lonely-girl";
import { readGhostBrideEventFact } from "@ai-werewolf-arena/game-contract/facts/ghost-bride";
import { text, term, roleName } from "@ai-werewolf-arena/game-text";

export function hybridEventLabel(type: string, payload: unknown, locale: Locale): string | null {
  if (type !== "hybrid_exemplar_chosen" && type !== "hybrid_affiliation_resolved") return null;
  const unknown = () => text(locale, "replay.unknown");
  const fact = readHybridEventFact(type, payload);
  if (!fact) return unknown();
  const parameters = { actor: fact.actorId, day: fact.day, target: fact.targetId };
  if (fact.type === "hybrid_exemplar_chosen")
    return text(locale, "console.hybrid.choice", parameters);
  return text(locale, "console.hybrid.affiliation", {
    ...parameters,
    faction: term("camp", fact.faction, locale),
  });
}

export function cupidEventLabel(type: string, payload: unknown, locale: Locale): string | null {
  if (!(CUPID_EVENT_TYPES as readonly string[]).includes(type)) return null;
  const p = readCupidEventFact(type, payload);
  if (!p) return text(locale, "replay.unknown");
  const actor = p.actorId as number;
  if (type === "lover_recognized")
    return text(locale, "console.cupid.recognition", { actor, partner: p.partnerId as number });
  if (type === "lovers_death")
    return text(locale, "console.cupid.death", { actor, target: p.targetId as number });
  const pair = p.pairIds as number[];
  if (type === "cupid_lovers_chosen")
    return text(locale, "console.cupid.choice", { actor, first: pair[0]!, second: pair[1]! });
  const camps = p.pairCamps as string[];
  return text(locale, "console.cupid.resolved", {
    actor,
    first: pair[0]!,
    second: pair[1]!,
    firstCamp: term("camp", camps[0]!, locale),
    secondCamp: term("camp", camps[1]!, locale),
    policy: term("rule", p.policy as string, locale),
    mixed: text(locale, p.mixed ? "common.yes" : "common.no"),
  });
}

export function debateEventLabel(type: string, payload: unknown, locale: Locale): string | null {
  if (!(DEBATE_EVENT_TYPES as readonly string[]).includes(type)) return null;
  const p = readDebateEventFact(type, payload);
  if (!p) return text(locale, "replay.unknown");
  const actor = p.actorId as number;
  if (type === "debater_revealed") return text(locale, "console.debate.reveal", { actor });
  if (type === "debate_speech")
    return text(locale, "console.debate.speech", { actor, speech: p.text as string });
  const target = p.targetId as number;
  if (type === "debate_started") return text(locale, "console.debate.start", { actor, target });
  if (type === "debate_canceled") return text(locale, "console.debate.cancel", { actor, target });
  if (type === "debate_ballots_recorded")
    return text(locale, "console.debate.ledger", { actor, target });
  return text(locale, "console.debate.result", {
    actor,
    target,
    eligible: p.eligibleCount as number,
    supports: p.supports as number,
    rejects: p.rejects as number,
    abstentions: p.abstentions as number,
    result: text(locale, p.success ? "common.yes" : "common.no"),
    blocked: p.blockedId as number,
  });
}

export function wallEventLabel(type: string, payload: unknown, locale: Locale): string | null {
  const p = readWallEventFact(type, payload);
  if (!p) return null;
  if (type === "wall_notes_started") return text(locale, "console.wall.start");
  if (type === "wall_notes_canceled") return text(locale, "console.wall.cancel");
  if (type === "wall_notes_published")
    return text(locale, "console.wall.publish", { notes: JSON.stringify(p.texts) });
  if (type === "wall_note_order_recorded")
    return text(locale, "console.wall.order", { rows: JSON.stringify(p.rows) });
  return text(locale, "console.wall.item", {
    actor: p.actorId,
    operation: text(locale, `item.operation.${p.operation}` as MessageKey),
    remaining: p.remaining,
    expired: String(p.expired),
    body: p.text ?? "",
  });
}

export function thiefEventLabel(type: string, payload: unknown, locale: Locale): string | null {
  const p = readThiefEventFact(type, payload);
  if (!p) return null;
  if (type === "thief_initial_deal")
    return text(locale, "console.thief.deal", {
      roles: JSON.stringify((p.roles as RoleId[]).map((role) => roleName(role, locale))),
      size: p.boardSize as number,
    });
  if (p.slot === null) return text(locale, "console.thief.keep", { actor: p.actorId as number });
  return text(locale, "console.thief.choice", {
    actor: p.actorId as number,
    slot: p.slot as number,
    role: roleName(p.role as RoleId, locale),
    camp: term("camp_team", p.camp as "good" | "wolf", locale),
  });
}

export function wildChildEventLabel(type: string, payload: unknown, locale: Locale): string | null {
  const p = readWildChildEventFact(type, payload) ?? readWildChildPlayerFact(type, payload);
  if (!p) return null;
  if (type === "wild_child_model_chosen")
    return text(locale, "console.wild_child.choice", {
      actor: p.actorId as number,
      target: p.targetId as number,
    });
  if (type === "wild_child_model_eliminated")
    return text(locale, "console.wild_child.death", {
      actor: p.actorId as number,
      target: p.targetId as number,
      causes: JSON.stringify(p.sources),
      commit: p.deathCommit as string,
    });
  if (type === "wild_child_transformed")
    return text(locale, "console.wild_child.transform", {
      actor: p.actorId as number,
      night: p.eligibleNight as number,
    });
  return text(locale, "console.wild_child.active", {
    actor: p.actorId as number,
    night: p.day as number,
  });
}

export function shapeshifterEventLabel(
  type: string,
  payload: unknown,
  locale: Locale,
): string | null {
  const p = readShapeshifterEventFact(type, payload);
  if (!p) return null;
  if (type === "shapeshifter_initial_deal")
    return text(locale, "console.shapeshifter.deal", {
      roles: JSON.stringify((p.roles as RoleId[]).map((role) => roleName(role, locale))),
      size: p.boardSize as number,
    });
  return text(locale, "console.shapeshifter.choice", {
    actor: p.actorId as number,
    slot: p.slot as number,
    role: roleName(p.role as RoleId, locale),
    camp: term("camp_team", p.camp as "good" | "wolf", locale),
  });
}

export function lonelyGirlEventLabel(
  type: string,
  payload: unknown,
  locale: Locale,
): string | null {
  const p = readLonelyGirlEventFact(type, payload);
  return p
    ? text(locale, p.camp ? "console.lonely_girl.god" : "console.lonely_girl.choice", {
        actor: p.actorId,
        target: p.targetId,
        ...(p.camp ? { camp: term("camp", p.camp, locale) } : {}),
      })
    : null;
}

export function ghostBrideEventLabel(
  type: string,
  payload: unknown,
  locale: Locale,
): string | null {
  const p = readGhostBrideEventFact(type, payload);
  if (!p) return null;
  const none = text(locale, "replay.none");
  const parameters: Record<string, string | number> = {
    bride: Number(p.brideId ?? 0),
    groom: Number(p.groomId ?? 0),
    witness: Number(p.witnessId ?? 0),
    actor: Number(p.actorId ?? 0),
    recipient: Number(p.recipientId ?? 0),
    target: p.targetId === null ? none : Number(p.targetId ?? 0),
    vote: Number(p.voteIndex ?? 0),
    day: Number(p.day),
    body: String(p.text ?? ""),
    owner: p.owner ? text(locale, `wedding.owner.${p.owner}` as MessageKey) : none,
    actors: Array.isArray(p.actorIds) ? p.actorIds.join(", ") : none,
  };
  const names: Record<string, string[]> = {
    ghost_bride_pair_chosen: ["bride", "groom"],
    ghost_bride_group_chosen: ["bride", "groom", "witness"],
    ghost_bride_witness_vote: ["actor", "vote", "target"],
    ghost_bride_partner_chat: ["actor", "recipient", "body"],
    ghost_bride_knife_captured: ["day", "owner", "actors"],
    ghost_bride_knife_vote: ["actor", "target"],
    ghost_bride_knife_resolved: ["day", "target"],
    ghost_bride_partner_death: ["actor", "target"],
  };
  return text(
    locale,
    `console.${type}` as MessageKey,
    Object.fromEntries(names[type]!.map((name) => [name, parameters[name]!])),
  );
}
