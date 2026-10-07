import type { ErrorDiagnostic } from "@ai-werewolf-arena/replay-contract";
import { ToolCall } from "../../../core/domain"
import { ChatMessage } from "../../integrations/llm/transport";

export interface BuiltPlayerPrompt {
  messages: ChatMessage[];
  systemPrompt: string;
  userPrompt: string;
  boardInfoPrompt?: string;
  configPrompt?: string;
  isInitialRound: boolean;
  eventCursorBefore: number;
  eventCursorAfter: number;
  contextWindowStart: number;
  contextWindowEnd: number;
  contextWindowTotal: number;
  turnId: string;
  auditMetadata?: string[];
}

export interface PlayerRetryTraceEntry {
  attempt: number;
  status: "request_error" | "no_valid_action";
  reason?: string;
  diagnostic?: ErrorDiagnostic;
  retryPrompt?: string;
  assistantText?: string;
}

export interface PlayerRoundOutcome {
  actionMode: "tool_call" | "none";
  toolCalls: Array<{
    id?: string;
    name: string;
    args: Record<string, unknown>;
    accepted?: boolean;
    result?: Record<string, unknown> | string;
  }>;
  thinkingText?: string;
  finalAction?: ToolCall | null;
  fallback?: {
    used: boolean;
    reason?: string;
    action?: { name: string; args: Record<string, unknown> };
  };
  retryTrace?: PlayerRetryTraceEntry[];
}
