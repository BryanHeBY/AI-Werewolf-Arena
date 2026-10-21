/**
 * 负责定义 Agent 私有输出的传输无关契约，以及现有玩家增量档案的双向适配。
 * 只描述已经发生的模型输出与宿主工具回执，不授予工具权限；受众始终是本地私有观察，不进入公开游戏事件。
 * 实时消费者与离线消费者使用相同分类，ANSI、HTML 和语言文案由展示端添加。
 */
import type { ErrorDiagnostic } from "./error-diagnostic";
import type { ReplayPlayerDeltaMessage } from "./player-record";
import { splitPlayerRecordText } from "./player-text-chunks";

export type AgentTransport = "llm" | "acp" | "pi";
export const AGENT_TOOL_STATUSES = Object.freeze([
  "started",
  "pending",
  "in_progress",
  "updated",
  "completed",
  "failed",
  "error",
] as const);
export type AgentToolStatus = (typeof AGENT_TOOL_STATUSES)[number];
export type AgentOutput =
  | { type: "text"; channel: "thinking" | "message" | "output"; text: string; step?: number }
  | {
      type: "tool";
      id?: string;
      name: string;
      status: AgentToolStatus;
      args?: Record<string, unknown>;
      result?: Record<string, unknown> | string;
      accepted?: boolean;
      diagnostic?: ErrorDiagnostic;
      step?: number;
    }
  | { type: "prompt"; messages: Array<{ role: string; content: string }> }
  | { type: "raw_response"; text: string }
  | { type: "trace"; text: string }
  | { type: "error"; diagnostic: ErrorDiagnostic }
  | {
      type: "fallback";
      reason: string;
      action?: { name: string; args: Record<string, unknown> };
      minValidActions?: number;
      allowedTools?: readonly string[];
    }
  | { type: "retry"; attempt: number; maxAttempts: number; reason: string }
  | {
      type: "bug";
      reportId: string;
      category: string;
      severity: string;
      message: string;
      stage?: string;
    };

export interface AgentOutputContext {
  transport: AgentTransport;
  /** 全局生命周期日志可以没有玩家；模型原文与工具输出由调用方绑定玩家。 */
  playerId?: number;
  day?: number;
  phase?: string;
  stage?: string;
  turnId?: string;
}
export interface AgentOutputEvent {
  visibility: "private";
  context: AgentOutputContext;
  output: AgentOutput;
}
export type AgentOutputSink = (event: AgentOutputEvent) => void;

/** 只解析已知工具回执包装；模型普通发言中的 JSON 不作为确认事实。 */
export function agentActionConfirmation(output: AgentOutput):
  | {
      status: "confirmation_required" | "confirmed";
      action: string;
      warning?: string;
      arguments?: Record<string, unknown>;
      confirmation_id?: string;
    }
  | undefined {
  if (output.type !== "tool" || !/(?:^|[._])submit_action$/.test(output.name)) return;
  let value: unknown = output.result;
  for (let depth = 0; depth < 4; depth++) {
    if (typeof value === "string") {
      try {
        value = JSON.parse(value);
      } catch {
        return;
      }
    }
    if (!value || typeof value !== "object" || Array.isArray(value)) return;
    const item = value as Record<string, unknown>;
    if (item.ok === true && item.applied === false && typeof item.action === "string") {
      if (item.status === "confirmed" && item.accepted === true)
        return {
          status: "confirmed",
          action: item.action,
          confirmation_id:
            typeof item.confirmation_id === "string" ? item.confirmation_id : undefined,
        };
      if (
        item.status === "confirmation_required" &&
        item.accepted === false &&
        typeof item.warning === "string" &&
        typeof item.confirmation_id === "string"
      )
        return {
          status: "confirmation_required",
          action: item.action,
          warning: item.warning,
          confirmation_id: item.confirmation_id,
          arguments:
            item.arguments && typeof item.arguments === "object" && !Array.isArray(item.arguments)
              ? (item.arguments as Record<string, unknown>)
              : undefined,
        };
      return;
    }
    const content = Array.isArray(item.content) ? item.content : [];
    value = item.structuredContent ?? content.find((block) => block?.type === "text")?.text;
  }
}

/** 保持 player schema 2 的字段；原文分片保存，避免聚合器既有单条长度上限截断思考。 */
export function agentOutputToDeltaMessages(
  outputs: readonly AgentOutput[],
): ReplayPlayerDeltaMessage[] {
  const messages: ReplayPlayerDeltaMessage[] = [];
  for (const output of outputs) {
    if (output.type === "text") {
      for (const content of output.text ? splitPlayerRecordText(output.text) : []) {
        messages.push({
          role: "assistant",
          kind: "assistant_output",
          name: output.channel,
          content,
        });
      }
    } else if (output.type === "tool") {
      const finished = ["completed", "failed", "error"].includes(output.status);
      messages.push({
        role: finished ? "tool" : "assistant",
        kind: finished ? "tool_result" : "tool_call",
        name: output.name,
        call_id: output.id,
        status: output.status,
        args: output.args,
        accepted: output.accepted,
        result: output.result,
        diagnostic: output.diagnostic,
      });
    } else if (output.type === "error")
      messages.push({ role: "meta", kind: "request_error", diagnostic: output.diagnostic });
    else if (output.type === "fallback")
      messages.push({ role: "meta", kind: "fallback", content: output.reason });
  }
  return messages;
}

/** 老档未区分思考／消息时保留 output 分类，不从正文猜测模型是否提供了思考。 */
export function agentOutputFromDeltaMessages(
  messages: readonly ReplayPlayerDeltaMessage[],
): AgentOutput[] {
  return messages.flatMap((message): AgentOutput[] => {
    if ((message.kind === "prompt" || message.kind === "retry_prompt") && message.content)
      return [{ type: "prompt", messages: [{ role: message.role, content: message.content }] }];
    if (message.kind === "assistant_output" && message.content)
      return [
        {
          type: "text",
          channel:
            message.name === "thinking" || message.name === "message" ? message.name : "output",
          text: message.content,
        },
      ];
    if (message.kind === "tool_call")
      return [
        {
          type: "tool",
          name: message.name ?? "tool",
          id: message.call_id,
          status: message.status ?? "started",
          args: message.args,
          result: message.result,
          diagnostic: message.diagnostic,
          accepted: message.accepted,
        },
      ];
    if (message.kind === "tool_result")
      return [
        {
          type: "tool",
          name: message.name ?? "tool",
          id: message.call_id,
          status: message.status ?? (message.diagnostic ? "failed" : "completed"),
          args: message.args,
          accepted: message.accepted,
          result: message.result,
          diagnostic: message.diagnostic,
        },
      ];
    if (message.kind === "request_error" && message.diagnostic)
      return [{ type: "error", diagnostic: message.diagnostic }];
    if (message.kind === "fallback") return [{ type: "fallback", reason: message.content ?? "" }];
    return [];
  });
}
