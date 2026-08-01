import { FrontendGameState, FrontendPhase } from "../../../server/view_mapper";

/**
 * 实时事件可见性定义。
 */
export type RealtimeVisibility =
  | { scope: "public" }
  | { scope: "wolves_only" }
  | { scope: "private_targets"; targetPlayerIds: number[] };

/**
 * 实时事件大类。
 */
export type RealtimeEventCategory =
  | "session"
  | "phase"
  | "agent"
  | "player_action"
  | "player_state"
  | "vote"
  | "night"
  | "system"
  | "result";

/**
 * registry/presenter 阶段输出的“半成品事件”。
 * session manager 会为其补齐 session 级上下文。
 */
export interface RealtimeGameEventDraft {
  category: RealtimeEventCategory;
  type: string;
  data: Record<string, unknown>;
  timestamp?: number;
  visibility?: RealtimeVisibility;
  stage?: string;
  actorId?: number | null;
  targetIds?: number[];
  day?: number;
  phase?: FrontendPhase;
  phaseId?: string;
  publicState?: FrontendGameState;
}

/**
 * 对外广播的完整实时事件结构。
 */
export interface RealtimeGameEvent extends RealtimeGameEventDraft {
  id: string;
  seq: number;
  sessionId: string;
  category: RealtimeEventCategory;
  timestamp: number;
  day: number;
  phase: FrontendPhase;
}

interface RealtimeEventBuilderInput {
  category: RealtimeEventCategory;
  type: string;
  data: Record<string, unknown>;
  timestamp?: number;
  stage?: string;
  actorId?: number | null;
  targetIds?: number[];
  day?: number;
  phase?: FrontendPhase;
  phaseId?: string;
  publicState?: FrontendGameState;
}

/**
 * 公开事件草稿构造器。
 */
export function makePublicEvent(
  input: RealtimeEventBuilderInput,
): RealtimeGameEventDraft {
  return {
    ...input,
    visibility: { scope: "public" },
  };
}

/** 为所有致死机制生成一致的公开死亡语义，供实时客户端统一更新席位状态。 */
export function makePlayerDiedEvent(input: {
  playerId: number;
  cause: string;
  roleType: string;
  timestamp: number;
  publicState: FrontendGameState;
}): RealtimeGameEventDraft {
  return makePublicEvent({
    category: "player_state",
    type: "player.died",
    timestamp: input.timestamp,
    actorId: input.playerId,
    targetIds: [input.playerId],
    data: {
      playerId: input.playerId,
      cause: input.cause,
      roleType: input.roleType,
    },
    publicState: input.publicState,
  });
}

/**
 * 狼队私有事件草稿构造器。
 */
export function makeWolvesOnlyEvent(
  input: RealtimeEventBuilderInput,
): RealtimeGameEventDraft {
  return {
    ...input,
    visibility: { scope: "wolves_only" },
  };
}

/**
 * 指定玩家私有事件草稿构造器。
 */
export function makePrivateTargetsEvent(
  input: RealtimeEventBuilderInput & { targetPlayerIds: number[] },
): RealtimeGameEventDraft {
  const { targetPlayerIds, ...rest } = input;
  return {
    ...rest,
    visibility: {
      scope: "private_targets",
      targetPlayerIds,
    },
  };
}
