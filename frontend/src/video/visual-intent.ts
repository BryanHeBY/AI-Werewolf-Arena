/**
 * 负责把已校验历史记录译为纯数据视觉意图。输入为事件／God事实，输出过程、报告、主体与溯源。
 * 只使用本条明确字段，不读当前真实角色、不解析本地化句子；请求、效果、接收者与旁白各自独立。
 * 显式路由不授行动权，choice／paid／reported均不是死亡证明；未知或畸形记录始终中性降级。
 */
import {
  readInspectionResult,
  type ReplayEvent,
  type ReplayFact,
} from "@ai-werewolf-arena/replay-contract";
import { readReplayEvent, type ReadReplayEvent } from "../replay/replay-event-reader";
import { VIDEO_EVENT_VISUAL_ROUTES, VIDEO_STAGE_VISUAL_ROUTES } from "./visual-routes";
import type { VideoVisualIntent, VideoVisualReport } from "./types";
import type { GameOutcome } from "@ai-werewolf-arena/game-contract";

const ids = (value: unknown): number[] =>
  typeof value === "number" && Number.isSafeInteger(value) && value > 0 ? [value] : [];
const idList = (value: unknown): number[] => (Array.isArray(value) ? value.flatMap(ids) : []);
// 只有契约明确的机制选道具；death_shot_blocked无枪/爪来源，刻意不在表中。
const DEATH_TOOLS = {
  hunter_shot: "gun",
  hunter_silent_due_to_poison: "gun",
  player_shot: "gun",
  wolf_king_shot: "gun",
  mechanical_shot: "gun",
  awakened_claw_bequeathed: "claw",
  awakened_claw_spent: "claw",
  awakened_claws_expired: "claw",
  awakened_patrol_paid: "patrol",
  awakened_patrol_resolved: "patrol",
  animal_puffer_revealed: "retaliation",
  animal_puffer_decided: "retaliation",
  animal_puffer_targets: "retaliation",
} as const satisfies Partial<
  Record<keyof typeof VIDEO_EVENT_VISUAL_ROUTES, NonNullable<VideoVisualIntent["deathTool"]>>
>;
const DUEL_KINDS = {
  knight_duel: "knight",
  awakened_duel_committed: "awakened_knight",
  awakened_duel_resolved: "awakened_knight",
  awakened_duel_chain_ended: "awakened_knight",
  demon_hunter_chosen: "demon_hunter",
  demon_hunter_cancelled: "demon_hunter",
  demon_hunter_poison_immune: "demon_hunter",
} as const satisfies Partial<
  Record<keyof typeof VIDEO_EVENT_VISUAL_ROUTES, NonNullable<VideoVisualIntent["duelKind"]>>
>;
/** 共享reader唯一校验报告；combined保留报告两域，不查当前玩家底牌补答案。 */
export function videoVisualReport(value: unknown): VideoVisualReport {
  const result = readInspectionResult(value);
  if (!result) return { kind: "unknown", reason: "report_not_recorded" };
  if (result.kind === "camp") return { kind: "camp", camp: result.camp };
  if (result.kind === "role") return { kind: "role", roleId: result.role };
  return { kind: "combined", camp: result.camp, roleId: result.role };
}
export function eventVisualIntent(
  event: ReplayEvent | undefined,
  playerIds: number[],
): VideoVisualIntent {
  return visualIntentFromRecord(
    event,
    event && Object.hasOwn(VIDEO_EVENT_VISUAL_ROUTES, event.type)
      ? readReplayEvent(event, playerIds)
      : null,
  );
}

/** 编译内部消费一次校验后的记录；独立原始事件入口仍由上面的 wrapper 校验。 */
export function visualIntentFromRecord(
  event: ReplayEvent | undefined,
  parsed: ReadReplayEvent | null,
): VideoVisualIntent {
  const source = { eventSeqs: event ? [event.seq] : [], factSeqs: [] };
  const neutral: VideoVisualIntent = {
    family: "god_announcement",
    template: "god_announcement/fact_card",
    process: "unknown",
    requestedTargetIds: [],
    effectiveTargetIds: [],
    recipientIds: [],
    source,
    fallbackReason: event ? "unknown_or_invalid_event" : "no_event",
  };
  if (!event || !Object.hasOwn(VIDEO_EVENT_VISUAL_ROUTES, event.type)) return neutral;
  if (!parsed) return neutral;
  const p = parsed.event.payload;
  const route = VIDEO_EVENT_VISUAL_ROUTES[event.type as keyof typeof VIDEO_EVENT_VISUAL_ROUTES];
  const intent: VideoVisualIntent = {
    ...route,
    requestedTargetIds: ids(p.targetId),
    effectiveTargetIds: [],
    recipientIds: [],
    source,
    ...(typeof p.actorId === "number" ? { actorId: p.actorId } : {}),
    ...(route.process === "notice"
      ? { fallbackReason: "recorded_notice_without_inferred_effect" }
      : {}),
  };
  if (Object.hasOwn(DEATH_TOOLS, event.type))
    intent.deathTool = DEATH_TOOLS[event.type as keyof typeof DEATH_TOOLS];
  if (Object.hasOwn(DUEL_KINDS, event.type))
    intent.duelKind = DUEL_KINDS[event.type as keyof typeof DUEL_KINDS];
  if (event.stage) {
    const window = Object.hasOwn(VIDEO_STAGE_VISUAL_ROUTES, event.stage)
      ? VIDEO_STAGE_VISUAL_ROUTES[event.stage as keyof typeof VIDEO_STAGE_VISUAL_ROUTES]
      : undefined;
    intent.window = { id: event.stage, known: window !== undefined, ...window };
  }
  // 特殊主体字段只按具体契约读取；playerId可能是库存/生命主体，不能统一当施法者。
  switch (event.type) {
    case "last_words_spoken":
      intent.actorId = Number(p.playerId);
      intent.dialogue = { kind: "speech" };
      break;
    case "hunter_shot":
    case "hunter_silent_due_to_poison":
      intent.actorId = Number(p.hunterId);
      break;
    case "ability_changed":
    case "death_ability_changed":
      // actorId是能力持有人；未披露的gift/copy来源不能偷偷变成施法者。
      intent.recipientIds = ids(p.actorId);
      delete intent.actorId;
      break;
    case "wolf_self_destruct":
      intent.actorId = Number(p.wolfId);
      break;
    case "seer_checked":
      intent.report =
        p.result === undefined && typeof p.isWerewolf === "boolean"
          ? { kind: "camp", camp: p.isWerewolf ? "wolf" : "good" }
          : videoVisualReport(p.result);
      intent.recipientIds = ids(p.actorId);
      break;
    case "role_inspected":
    case "gravekeeper_reported":
      intent.report = videoVisualReport(p.result);
      intent.recipientIds = ids(p.actorId);
      break;
    case "fragrant_pair_inspected":
      intent.requestedTargetIds = idList(p.targetIds);
      intent.report = {
        kind: "pair",
        targetIds: idList(p.targetIds),
        containsWerewolf: p.containsWerewolf === true,
      };
      intent.recipientIds = ids(p.actorId);
      break;
    case "bear_roared":
      intent.report = {
        kind: "range",
        signal: p.roared === true ? "roar" : "quiet",
        scope: "adjacent_alive",
      };
      break;
    case "day_speech":
    case "wolf_discussion":
    case "debate_speech":
      intent.dialogue = { kind: "speech" };
      break;
    case "wolf_discussion_ended":
      intent.dialogue = { kind: "end_chat" };
      break;
    case "brew_discussion":
      intent.dialogue = { kind: "collaboration" };
      break;
    case "secret_body_reveal_speech":
      intent.dialogue = { kind: "revealed" };
      break;
    case "silence_gesture":
      intent.dialogue = { kind: "gesture" };
      break;
    case "ghost_bride_partner_chat":
      intent.dialogue = { kind: "private" };
      intent.recipientIds = ids(p.recipientId);
      break;
    case "silence_translated":
      // actor是翻译者，target是原表达者；不得把翻译文本改署名为原作者。
      intent.requestedTargetIds = ids(p.targetId);
      intent.dialogue = { kind: "translation", originalSpeakerId: Number(p.targetId) };
      break;
    case "witch_potion_skipped":
      // skip载荷的target是收到的刀口上下文，不是用药请求；不能把未行动高亮为选中目标。
      intent.requestedTargetIds = [];
      break;
    case "witch_potion_used":
      if (p.potionType === "heal" || p.potionType === "poison") intent.potion = p.potionType;
      break;
    case "mechanical_poison_used":
    case "awakened_poison_used":
      intent.potion = "poison";
      break;
    case "knight_duel":
      // 普通骑士只报告非狼，不能把可能的第三方压成好人。
      intent.duel = { branch: p.result === "wolf" ? "wolf" : "not_wolf" };
      break;
    case "awakened_duel_committed":
      intent.duel = { branch: p.branch === "wolf" ? "wolf" : "good", chain: Number(p.chain) };
      break;
    case "awakened_duel_resolved":
      intent.duel = { chain: Number(p.chain), recordedDeaths: idList(p.deaths) };
      break;
    case "fragrant_pair_chosen":
    case "fragrant_binding_expired":
      intent.requestedTargetIds = idList(p.pairIds);
      break;
    case "alchemist_mist_chosen":
      intent.requestedTargetIds = idList(p.targetIds);
      break;
    case "exile_target_mapped":
      intent.requestedTargetIds = ids(p.requestedId);
      intent.effectiveTargetIds = ids(p.effectiveId);
      intent.effectiveTargetKnown = true;
      break;
    case "time_consort_reflected":
      intent.requestedTargetIds = ids(p.requestedId);
      intent.effectiveTargetIds = ids(p.effectiveId);
      intent.effectiveTargetKnown = true;
      intent.effectSourceId = Number(p.sourceId);
      if (p.kind === "check" || p.kind === "guard" || p.kind === "poison")
        intent.effectKind = p.kind;
      break;
    case "magician_exchange_committed":
    case "trickster_exchange_committed":
    case "wolf_sorcerer_exchange_committed":
      intent.requestedTargetIds = idList(p.pair);
      break;
    case "mechanical_poison_reflected":
      intent.requestedTargetIds = ids(p.protectedTargetId);
      intent.effectiveTargetIds = ids(p.casterId);
      intent.effectiveTargetKnown = true;
      intent.effectSourceId = Number(p.casterId);
      intent.effectKind = "poison";
      break;
    case "night_resolved":
    case "additional_deaths":
      intent.life = { playerIds: idList(p.deaths), committed: false };
      break;
    case "game_over": {
      const outcome = p.outcome as { kind?: string; winningPlayerIds?: unknown } | undefined;
      intent.victory = {
        winningPlayerIds: idList(outcome?.winningPlayerIds),
        ...(typeof p.winner === "string" || p.winner === null ? { winner: p.winner } : {}),
        ...(typeof p.reason === "string" ? { reason: p.reason } : {}),
        ...(p.outcome && typeof p.outcome === "object"
          ? { outcome: structuredClone(p.outcome) as GameOutcome }
          : {}),
      };
      break;
    }
  }
  if (intent.dialogue) {
    delete intent.fallbackReason;
    if (
      (event.type === "wolf_discussion" || event.type === "wolf_discussion_ended") &&
      typeof p.round === "number"
    )
      intent.dialogue.round = p.round;
  }
  return intent;
}
/** God事实的目标是提交owner明示的落点；这里只搬运证据，不推出最终存活或死亡因果。 */
export function factVisualIntent(fact: ReplayFact): VideoVisualIntent {
  const base: VideoVisualIntent = {
    family: "god_announcement",
    template: "god_announcement/fact_card",
    process: "notice",
    requestedTargetIds: [],
    effectiveTargetIds: [],
    recipientIds: [],
    source: { eventSeqs: [], factSeqs: [fact.seq] },
  };
  switch (fact.kind) {
    case "wolf_knife_committed":
      return {
        ...base,
        family: "pack_attack",
        template: "pack_attack/wolf_knife_committed",
        process: "used",
        requestedTargetIds: ids(fact.requestedTargetId),
        effectiveTargetIds: ids(fact.effectiveTargetId),
        effectiveTargetKnown: true,
        participantIds: [...fact.participantIds],
      };
    case "wolf_knife_revoked":
      return {
        ...base,
        family: "pack_attack",
        template: "pack_attack/wolf_knife_revoked",
        process: "revoked",
        effectiveTargetIds: [fact.targetId],
        effectiveTargetKnown: true,
      };
    case "potion_stock":
      return {
        ...base,
        family: "resource_inventory",
        template: "resource_inventory/potion_stock",
        process: "reported",
        actorId: fact.actorId,
      };
    case "night_protection_resolved":
      return {
        ...base,
        family: "protection",
        template: "protection/night_protection_resolved",
        process: fact.interaction === "wolf_attack_blocked" ? "blocked" : "resolved",
        effectiveTargetIds: [fact.targetId],
        effectiveTargetKnown: true,
        protection: {
          interaction: fact.interaction,
          ...(fact.interaction === "wolf_attack_blocked" ? { kind: fact.protection } : {}),
        },
      };
    case "life_committed":
      return {
        ...base,
        family: "life_settlement",
        template: "life_settlement/life_committed",
        process: "resolved",
        effectiveTargetIds: [fact.playerId],
        effectiveTargetKnown: true,
        life: {
          playerIds: [fact.playerId],
          committed: true,
          causes: { [fact.playerId]: [...fact.causes] },
          ...(fact.waveId === undefined ? {} : { waveId: fact.waveId }),
        },
      };
  }
}
