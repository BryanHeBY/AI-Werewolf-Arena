import { Camp, ToolCall } from "../domain/model";

export type ReplayActionMode = "tool_call" | "text_action" | "none";

export interface ReplayManifestPlayer {
  player_id: number;
  role: string;
  camp: string;
  alive: boolean;
}

export interface ReplayManifest {
  session_id: string;
  board: string;
  started_at: string;
  ended_at: string;
  winner: Camp | null;
  finish_reason: string;
  players: ReplayManifestPlayer[];
  files: {
    public_timeline: string;
    logic_ops: string;
    player_views: string[];
  };
  schema_version: "v1";
}

export interface ReplayPublicEvent {
  seq: number;
  timestamp: string;
  phase: string;
  day: number;
  type: string;
  payload: Record<string, unknown>;
  render_text?: string;
}

export interface ReplayLogicOp {
  seq: number;
  timestamp: string;
  scope: "phase_pipeline" | "gateway" | "registry" | "resolution" | "llm_action_provider";
  op: string;
  actor_id?: number;
  phase?: string;
  input?: Record<string, unknown>;
  output?: Record<string, unknown>;
  status: "ok" | "rejected" | "fallback" | "error";
  reason?: string;
}

export interface ReplayToolCallTrace {
  id?: string;
  name: string;
  args: Record<string, unknown>;
  accepted?: boolean;
  result?: Record<string, unknown> | string;
}

export interface ReplayPlayerActionEntry {
  seq: number;
  kind: "action";
  day: number;
  phase: string;
  stage: string;
  request_id: string;
  feed_cursor_before?: number;
  feed_cursor_after?: number;
  prompt_system?: string;
  prompt_system_ref?: string;
  prompt_user_delta?: string[];
  thinking_text?: string;
  action_mode: ReplayActionMode;
  tool_calls: ReplayToolCallTrace[];
  text_action?: {
    text: string;
    parsed_action?: {
      name: string;
      args: Record<string, unknown>;
    };
  };
  final_action?: {
    name: string;
    args: Record<string, unknown>;
  };
  fallback?: {
    used: boolean;
    reason?: string;
    action?: {
      name: string;
      args: Record<string, unknown>;
    };
  };
  truncated?: {
    thinking_text?: boolean;
    prompt_user_delta?: boolean;
  };
}

export interface ReplayPlayerBroadcastEntry {
  seq: number;
  kind: "broadcast";
  day: number;
  phase: string;
  stage: string;
  request_id: string;
  text: string;
}

export type ReplayPlayerTimelineEntry =
  | ReplayPlayerBroadcastEntry
  | ReplayPlayerActionEntry;

export interface ReplayPlayerView {
  player_id: number;
  role: string;
  camp: string;
  initial_prompt?: {
    day: number;
    phase: string;
    stage: string;
    request_id: string;
    prompt_system?: string;
    prompt_user?: string[];
  };
  timeline: ReplayPlayerTimelineEntry[];
}

export interface ReplaySessionMeta {
  sessionId: string;
  board: string;
  startedAtIso: string;
}

export interface ReplayFinalizeMeta {
  endedAtIso: string;
  winner: Camp | null;
  finishReason: string;
  players: ReplayManifestPlayer[];
}

export interface ReplayRecordPublicEventInput {
  type: string;
  timestampMs: number;
  phase: string;
  day: number;
  payload: Record<string, unknown>;
  renderText?: string;
}

export interface ReplayRecordLogicOpInput {
  scope: ReplayLogicOp["scope"];
  op: string;
  actorId?: number;
  phase?: string;
  input?: Record<string, unknown>;
  output?: Record<string, unknown>;
  status: ReplayLogicOp["status"];
  reason?: string;
}

export interface ReplayRecordPlayerRoundInput {
  playerId: number;
  role: string;
  camp: string;
  day: number;
  phase: string;
  stage: string;
  requestId: string;
  visibleFeedDelta: string[];
  feedCursorBefore?: number;
  feedCursorAfter?: number;
  promptSystem?: string;
  promptUserDelta?: string[];
  thinkingText?: string;
  actionMode: ReplayActionMode;
  toolCalls: ReplayToolCallTrace[];
  textAction?: ReplayPlayerActionEntry["text_action"];
  finalAction?: ToolCall | null;
  fallback?: ReplayPlayerActionEntry["fallback"];
}

export interface ReplayRecordPlayerBroadcastInput {
  playerId: number;
  role: string;
  camp: string;
  day: number;
  phase: string;
  stage: string;
  requestId: string;
  text: string;
}
