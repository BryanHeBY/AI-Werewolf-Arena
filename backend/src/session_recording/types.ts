/** 文件说明：对局复盘记录结构类型定义。 */
import { Camp, ToolCall } from "../domain/model";

/** 玩家回合行动模式。 */
export type ReplayActionMode = "tool_call" | "text_action" | "none";

/** manifest 中的玩家摘要。 */
export interface ReplayManifestPlayer {
  player_id: number;
  role: string;
  camp: string;
  alive: boolean;
}

/** 对局复盘主清单。 */
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
    debug_reports: string;
    debug_summary: string;
    player_views: string[];
  };
  schema_version: "v1";
}

/** 公共时间线事件记录。 */
export interface ReplayPublicEvent {
  seq: number;
  timestamp: string;
  phase: string;
  day: number;
  type: string;
  payload: Record<string, unknown>;
  render_text?: string;
}

/** 逻辑操作审计记录。 */
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

/** 工具调用追踪记录。 */
export interface ReplayToolCallTrace {
  id?: string;
  name: string;
  args: Record<string, unknown>;
  accepted?: boolean;
  result?: Record<string, unknown> | string;
}

/** LLM 请求消息结构。 */
export interface ReplayLlmRequestMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  tool_call_id?: string;
}

/** LLM 请求载荷结构。 */
export interface ReplayLlmRequestPayload {
  messages: ReplayLlmRequestMessage[];
}

/** 玩家广播时间线条目。 */
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

/** 玩家单回合增量结构。 */
export interface ReplayPlayerTurnDelta {
  llm_request_messages?: ReplayLlmRequestMessage[];
  prompt_user_delta?: string[];
  retry_trace?: Array<{
    attempt: number;
    status: "request_error" | "no_valid_action";
    reason?: string;
    retry_prompt?: string;
  }>;
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
  final_action?: ToolCall | null;
  fallback?: {
    used: boolean;
    reason?: string;
    action?: {
      name: string;
      args: Record<string, unknown>;
    };
  };
}

/** 玩家回合时间线条目。 */
export interface ReplayPlayerTurnEntry {
  seq: number;
  kind: "turn";
  day: number;
  phase: string;
  stage: string;
  request_id: string;
  timestamp?: string;
  turn_seq: number;
  visible_feed_delta: string[];
  feed_cursor_before?: number;
  feed_cursor_after?: number;
  delta: ReplayPlayerTurnDelta;
}

/** 玩家时间线条目联合类型。 */
export type ReplayPlayerTimelineEntry =
  | ReplayPlayerBroadcastEntry
  | ReplayPlayerTurnEntry;

/** 玩家视角复盘结构。 */
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

/** 对局会话元信息。 */
export interface ReplaySessionMeta {
  sessionId: string;
  board: string;
  startedAtIso: string;
}

/** 结束写盘元信息。 */
export interface ReplayFinalizeMeta {
  endedAtIso: string;
  winner: Camp | null;
  finishReason: string;
  players: ReplayManifestPlayer[];
}

/** 记录公共事件输入结构。 */
export interface ReplayRecordPublicEventInput {
  type: string;
  timestampMs: number;
  phase: string;
  day: number;
  payload: Record<string, unknown>;
  renderText?: string;
}

/** 记录逻辑操作输入结构。 */
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

/** 记录玩家回合输入结构。 */
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
  retryTrace?: Array<{
    attempt: number;
    status: "request_error" | "no_valid_action";
    reason?: string;
    retryPrompt?: string;
  }>;
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

/** 记录玩家广播输入结构。 */
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

/** 调试上报记录。 */
export interface ReplayDebugReport {
  report_id: string;
  timestamp: string;
  day: number;
  phase: string;
  stage: string;
  actor_id: number;
  actor_role: string;
  actor_camp: string;
  category: "flow" | "rule" | "state" | "logging" | "other";
  severity: "low" | "medium" | "high" | "critical";
  message: string;
  evidence_event_seq: number[];
  status: "open";
}

/** 调试上报写入输入。 */
export interface ReplayRecordDebugReportInput {
  timestampMs?: number;
  day: number;
  phase: string;
  stage: string;
  actorId: number;
  actorRole: string;
  actorCamp: string;
  category: "flow" | "rule" | "state" | "logging" | "other";
  severity: "low" | "medium" | "high" | "critical";
  message: string;
  evidenceEventSeq?: number[];
}
