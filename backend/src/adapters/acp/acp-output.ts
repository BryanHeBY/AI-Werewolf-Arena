/**
 * 负责将 ACP 更新转换为私有结构化输出。输入为原生通知与玩家上下文，输出为完整文本块和去重工具状态。
 * 只收取已知字段，错误通过白名单诊断转换；协议授权及会话仍由进程客户端负责。
 * 不创建期限预算或计时器；取消后由调用方 flush 尾段、关闭会话，显示错误按原对象传播。
 */
import type {
  AgentOutput,
  AgentOutputContext,
  AgentOutputSink,
} from "@ai-werewolf-arena/replay-contract";
import { describeError } from "../../utils/error-diagnostic";
import { AgentTextBuffer } from "../output/text-buffer";

function record(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}
export function createAcpOutputObserver(context: AgentOutputContext, sink: AgentOutputSink) {
  const emit = (output: AgentOutput) =>
    sink({ visibility: "private", context: { ...context }, output: structuredClone(output) });
  const text = new AgentTextBuffer(emit, { maxChunkLength: 500, splitLines: true });
  let pending: string | undefined;
  const tools = new Map<string, { name: string; status?: string; error: string }>();
  return {
    update(value: unknown): void {
      const update = record(value);
      if (!update) return;
      const type = update.sessionUpdate;
      if (type === "agent_thought_chunk" || type === "agent_message_chunk") {
        const channel = type === "agent_thought_chunk" ? "thinking" : "message";
        const id = `${channel}:${typeof update.messageId === "string" ? update.messageId : ""}`;
        if (pending !== id) {
          text.flush();
          pending = id;
        }
        const content = update.content;
        const chunk = typeof content === "string" ? content : record(content)?.text;
        if (typeof chunk === "string") text.append(id, channel, chunk);
      } else if (type === "tool_call" || type === "tool_call_update") {
        text.flush();
        pending = undefined;
        const id = typeof update.toolCallId === "string" ? update.toolCallId : undefined;
        const previous = id ? tools.get(id) : undefined;
        const input = record(update.rawInput);
        const title =
          typeof update.title === "string"
            ? update.title.replace(/\s+/g, " ").trim().slice(0, 180)
            : (previous?.name ?? "tool");
        const name =
          type === "tool_call" &&
          typeof input?.server === "string" &&
          typeof input?.tool === "string"
            ? `${input.server}.${input.tool}`
            : title;
        const status = typeof update.status === "string" ? update.status : undefined;
        const diagnostic =
          update.error === undefined || update.error === null || update.error === ""
            ? undefined
            : describeError(update.error);
        const error = diagnostic ? JSON.stringify(diagnostic) : "";
        if (id)
          tools.set(id, {
            name,
            status: status ?? previous?.status,
            error: error || previous?.error || "",
          });
        if (type === "tool_call")
          emit({ type: "tool", id, name, status: "started", args: record(update.rawInput) });
        else if (
          (status !== undefined && status !== previous?.status) ||
          (error && error !== previous?.error) ||
          update.rawInput !== undefined ||
          update.rawOutput !== undefined
        )
          emit({
            type: "tool",
            id,
            name,
            args: record(update.rawInput),
            status:
              status === previous?.status && !error
                ? "updated"
                : ["pending", "in_progress", "completed", "failed", "error"].includes(status ?? "")
                  ? (status as "pending" | "in_progress" | "completed" | "failed" | "error")
                  : diagnostic
                    ? "error"
                    : "updated",
            result:
              typeof update.rawOutput === "string"
                ? update.rawOutput
                : (record(update.rawOutput) ??
                  (Array.isArray(update.rawOutput) ? { content: update.rawOutput } : undefined)),
            diagnostic,
          });
      }
    },
    flush(): void {
      text.flush();
      pending = undefined;
      tools.clear();
    },
  };
}
