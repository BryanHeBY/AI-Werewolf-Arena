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

export interface ReplayLlmRequestMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  tool_call_id?: string;
}

export interface ReplayLlmRequestPayload {
  messages: ReplayLlmRequestMessage[];
}

export interface ReplayPlayerToolCallEntry {
  seq: number;
  kind: "tool_call";
  day: number;
  phase: string;
  stage: string;
  request_id: string;
  timestamp?: string;
  role: "assistant";
  name: string;
  args: Record<string, unknown>;
  accepted?: boolean;
  result?: Record<string, unknown> | string;
}

export interface ReplayPlayerTextActionEntry {
  seq: number;
  kind: "text_action";
  day: number;
  phase: string;
  stage: string;
  request_id: string;
  timestamp?: string;
  role: "assistant";
  content: string;
  parsed_action?: {
    name: string;
    args: Record<string, unknown>;
  };
}

export interface ReplayPlayerFallbackEntry {
  seq: number;
  kind: "fallback";
  day: number;
  phase: string;
  stage: string;
  request_id: string;
  timestamp?: string;
  role: "system";
  fallback?: {
    used: boolean;
    reason?: string;
    action?: {
      name: string;
      args: Record<string, unknown>;
    };
  };
}

export interface ReplayPlayerBroadcastEntry {
  seq: number;
  kind: "broadcast";
  day: number;
  phase: string;
  stage: string;
  request_id: string;
  timestamp?: string;
  role: "user";
  content: string;
}

export interface ReplayPlayerLlmMessageEntry {
  seq: number;
  kind: "llm_message";
  day: number;
  phase: string;
  stage: string;
  request_id: string;
  timestamp?: string;
  role: ReplayLlmRequestMessage["role"];
  content: string;
  tool_call_id?: string;
}

export type ReplayPlayerTimelineEntry =
  | ReplayPlayerBroadcastEntry
  | ReplayPlayerLlmMessageEntry
  | ReplayPlayerToolCallEntry
  | ReplayPlayerTextActionEntry
  | ReplayPlayerFallbackEntry;

export interface ReplayPlayerView {
  player_id: number;
  role: string;
  camp: string;
  initial_prompt?: {
    day: number;
    phase: string;
    stage: string;
    request_id: string;
    timestamp?: string;
    prompt_system?: string;
    board_info?: string;
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
  timestampMs?: number;
  visibleFeedDelta: string[];
  feedCursorBefore?: number;
  feedCursorAfter?: number;
  llmRequestMessages?: ReplayLlmRequestMessage[];
  promptSystem?: string;
  initialPromptSystem?: string;
  initialBoardInfo?: string;
  promptUserDelta?: string[];
  thinkingText?: string;
  actionMode: ReplayActionMode;
  toolCalls: ReplayToolCallTrace[];
  textAction?: {
    text: string;
    parsed_action?: {
      name: string;
      args: Record<string, unknown>;
    };
  };
  finalAction?: ToolCall | null;
  fallback?: {
    used: boolean;
    reason?: string;
    action?: {
      name: string;
      args: Record<string, unknown>;
    };
  };
}

export interface ReplayRecordPlayerBroadcastInput {
  playerId: number;
  role: string;
  camp: string;
  day: number;
  phase: string;
  stage: string;
  requestId: string;
  timestampMs?: number;
  text: string;
}
