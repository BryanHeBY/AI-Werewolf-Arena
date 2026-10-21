/**
 * 负责 Agent 输出的纯展示政策。输入为共同输出、开关和语言，输出双语分类、原文与语义色调。
 * 终端与 Web 各自实现 ANSI 或 CSS；本模块不读取文件、操作 DOM 或承担录制、会话及行动授权。
 */
import {
  agentActionConfirmation,
  agentActionExecution,
  type AgentOutput,
} from "@ai-werewolf-arena/replay-contract";
import { actionExecutionBody } from "./action-feedback";
export { agentActionConfirmation } from "@ai-werewolf-arena/replay-contract";
import { text, errorMessage, type Locale } from "@ai-werewolf-arena/game-text";

export interface AgentOutputDisplayOptions {
  printThinking: boolean;
  printLlmIo: boolean;
  trace: boolean;
}
export type AgentOutputTone = "muted" | "accent" | "warn" | "error" | "info" | "ok";

export function isAgentOutputVisible(
  output: AgentOutput,
  options: AgentOutputDisplayOptions,
): boolean {
  switch (output.type) {
    case "text":
      // SDK 分步轨迹与 raw_response 属于两种详细度；IO 单开时由原始回应负责展示，避免重复打印。
      if (output.step !== undefined) return options.printThinking;
      return output.channel === "thinking"
        ? options.printThinking
        : options.printLlmIo || options.printThinking;
    case "tool":
      return options.printThinking || agentActionConfirmation(output) !== undefined;
    case "prompt":
    case "raw_response":
      return options.printLlmIo;
    case "trace":
      return options.trace;
    default:
      return true;
  }
}

export function agentOutputPresentation(
  output: AgentOutput,
  locale: Locale = "zh-CN",
): { label: string; body: string; tone: AgentOutputTone } {
  switch (output.type) {
    case "text":
      return {
        label: text(
          locale,
          output.channel === "thinking"
            ? "runtime.acp.thought"
            : output.channel === "message"
              ? "runtime.acp.message"
              : "runtime.assistant_output",
        ),
        body: output.text,
        tone: "muted",
      };
    case "tool": {
      const execution = agentActionExecution(output);
      if (execution)
        return {
          label: text(locale, `runtime.action.${execution.status}`),
          body: actionExecutionBody(execution, locale),
          tone: execution.applied === true ? "ok" : "warn",
        };
      const confirmation = agentActionConfirmation(output);
      if (confirmation)
        return {
          label: text(locale, `runtime.action.${confirmation.status}`),
          body: `${output.name} · ${confirmation.action}${confirmation.arguments ? ` ${JSON.stringify(confirmation.arguments)}` : ""}${confirmation.warning ? `\n${confirmation.warning}` : ""}`,
          tone: confirmation.status === "confirmation_required" ? "warn" : "ok",
        };
      return {
        label: text(
          locale,
          output.status === "started" ? "runtime.tool_call" : "runtime.tool_result",
        ),
        body: `${output.name} · ${text(locale, output.status === "started" ? "runtime.acp.start" : output.status === "completed" ? "runtime.acp.completed" : output.status === "failed" ? "runtime.acp.failed" : output.status === "error" ? "runtime.acp.error" : output.status === "pending" ? "runtime.acp.pending" : output.status === "updated" ? "runtime.tool_result" : "runtime.acp.in_progress")}`,
        tone:
          output.status === "failed" || output.status === "error" || output.diagnostic
            ? "warn"
            : "muted",
      };
    }
    case "error":
      return {
        label: output.diagnostic.code,
        body: errorMessage(locale, output.diagnostic.code),
        tone: "error",
      };
    case "fallback":
      return { label: text(locale, "runtime.fallback"), body: output.reason, tone: "warn" };
    case "retry":
      return {
        label: text(locale, "runtime.retry"),
        body: `${output.attempt}/${output.maxAttempts}: ${output.reason}`,
        tone: "warn",
      };
    case "bug":
      return { label: output.reportId, body: output.message, tone: "warn" };
    case "prompt":
      return {
        label: text(locale, "runtime.prompt_start"),
        body: output.messages.map((message) => `${message.role}: ${message.content}`).join("\n"),
        tone: "accent",
      };
    case "raw_response":
      return { label: text(locale, "runtime.raw_response"), body: output.text, tone: "accent" };
    case "trace":
      return { label: "trace", body: output.text, tone: "muted" };
  }
}
