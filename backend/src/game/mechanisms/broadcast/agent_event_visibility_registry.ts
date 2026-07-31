/** 文件说明：领域事件到玩家 Agent 视角的显式可见性白名单。 */
import { EntityId, GameEvent } from "../../../core/domain/model";
import { World } from "../../../core/domain/world";
import { getDefaultVisibilityRegistry } from "./visibility_registry";

type AgentEventVisibilityRule = (
  world: World,
  event: GameEvent,
  actorId: EntityId,
) => boolean;

const PUBLIC_EVENT_TYPES = new Set([
  "phase_changed",
  "day_speech",
  "night_resolved",
  "vote_summary",
  "voted_out",
  "game_over",
  "wolf_self_destruct",
  "hunter_shot",
  "idiot_revealed",
  "last_words_granted",
  "last_words_spoken",
  "sheriff_nomination_summary",
  "sheriff_withdraw_summary",
  "sheriff_candidates_finalized",
  "sheriff_vote_summary",
  "sheriff_badge_transferred",
  "sheriff_badge_destroyed",
  "sheriff_direction_chosen",
]);

const WOLVES_ONLY_EVENT_TYPES = new Set([
  "wolf_tactical_order",
  "wolf_discussion",
  "wolf_discussion_ended",
  "wolf_kill_vote_cast",
]);

const ACTOR_ONLY_EVENT_TYPES = new Set([
  "seer_checked",
  "witch_potion_used",
  "witch_potion_skipped",
  "guard_applied",
]);

const DEFAULT_RULES: Record<string, AgentEventVisibilityRule> = {};

/**
 * Agent 可见性注册表。
 *
 * 有意不提供“默认公开”：新增事件必须先明确受众才能进入玩家上下文。
 */
export class AgentEventVisibilityRegistry {
  constructor(
    private readonly rules: Record<string, AgentEventVisibilityRule> = DEFAULT_RULES,
  ) {}

  canView(world: World, event: GameEvent, actorId: EntityId): boolean {
    const custom = this.rules[event.type];
    if (custom) return custom(world, event, actorId);
    if (PUBLIC_EVENT_TYPES.has(event.type)) return true;
    if (WOLVES_ONLY_EVENT_TYPES.has(event.type)) {
      return getDefaultVisibilityRegistry().isWolfPlayer(world, actorId);
    }
    if (ACTOR_ONLY_EVENT_TYPES.has(event.type)) {
      return Number(event.payload.actorId) === actorId;
    }
    return false;
  }
}

let defaultRegistry: AgentEventVisibilityRegistry | null = null;

export function getDefaultAgentEventVisibilityRegistry(): AgentEventVisibilityRegistry {
  if (!defaultRegistry) defaultRegistry = new AgentEventVisibilityRegistry();
  return defaultRegistry;
}
