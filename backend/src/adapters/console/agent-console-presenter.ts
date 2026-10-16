/**
 * 负责三种 Agent 共用的终端展示。输入为私有结构化输出，按公共政策筛选并添加双语标签与 ANSI。
 * 副作用只有同步日志；不读取 World、原生会话或记录文件，不提交行动。
 * 不创建超时预算；取消／关闭后的尾段由调用方决定何时发送，显示异常交还原回合所有者。
 */
import {
  dictionaries,
  text,
  errorMessage,
  type Locale,
  type MessageKey,
} from "@ai-werewolf-arena/game-text";
import {
  agentOutputPresentation,
  isAgentOutputVisible,
  type AgentOutputDisplayOptions,
} from "@ai-werewolf-arena/game-presentation";
import type { AgentOutputSink } from "@ai-werewolf-arena/replay-contract";
import { colorize, isAnsiEnabled } from "../../utils/ansi";
import type { ConsoleLog } from "./console-presenter";

export function createAgentConsoleSink(
  options: AgentOutputDisplayOptions & { locale?: Locale; color?: boolean; log?: ConsoleLog },
): AgentOutputSink {
  const locale = options.locale ?? "zh-CN";
  const enabled = isAnsiEnabled(options.color);
  const log: ConsoleLog =
    options.log ?? ((line, tone = "info") => console.log(colorize(line, tone, enabled)));
  return ({ context, output }) => {
    if (!isAgentOutputVisible(output, options)) return;
    // 参数／内容补充留给档案和 Web，不把一次调用重新打印成另一条终端结果。
    if (output.type === "tool" && output.status === "updated") return;
    // 日常终端只打印工具结果；显式 trace 才展开开始／中间状态，结构化消费者仍收到完整事实。
    if (
      output.type === "tool" &&
      !options.trace &&
      ["started", "pending", "in_progress", "updated"].includes(output.status)
    )
      return;
    const { transport, playerId, phase } = context;
    const prefix = `[${transport}][${playerId ?? "-"}]`;
    const marker = `player=${playerId ?? "-"} phase=${phase ?? "unknown"}`;
    const view = agentOutputPresentation(output, locale);
    if (output.type === "prompt") {
      const io = `[${transport.toUpperCase()}_IO]`;
      log(`${io} prompt_start ${marker} · ${text(locale, "runtime.prompt_start")}`, "accent");
      for (const message of output.messages) {
        const key = `runtime.prompt_${message.role}` as MessageKey;
        const label = Object.hasOwn(dictionaries[locale], key) ? text(locale, key) : message.role;
        log(`${io} prompt_${message.role} · ${label}: ${message.content}`, "accent");
      }
      log(`${io} prompt_end ${marker} · ${text(locale, "runtime.prompt_end")}`, "accent");
    } else if (output.type === "raw_response") {
      const io = `[${transport.toUpperCase()}_IO]`;
      log(
        `${io} raw_response_start ${marker} · ${text(locale, "runtime.raw_response_start")}`,
        "accent",
      );
      log(`${io} raw_response · ${view.label}: ${view.body}`, "accent");
      log(
        `${io} raw_response_end ${marker} · ${text(locale, "runtime.raw_response_end")}`,
        "accent",
      );
    } else if (output.type === "trace") {
      const key = `runtime.trace.${output.text.split(" ", 1)[0]}` as MessageKey;
      const line = Object.hasOwn(dictionaries[locale], key)
        ? `${text(locale, key)} | ${output.text}`
        : output.text;
      const tone = line.includes("request_ok")
        ? "ok"
        : line.includes("request_recovered") || line.includes("request_timeout")
          ? "warn"
          : line.includes("request_transport_fail")
            ? "error"
            : line.includes("request_start")
              ? "info"
              : "muted";
      log(
        `[${transport === "acp" ? "ACP" : transport === "pi" ? "Pi" : "LLM"}ActionProvider] ${line}`,
        tone,
      );
    } else if (output.type === "text") {
      // ACP 的分词空白仅在终端规整；归档及 Web 仍保留真实原文。
      const body = transport === "acp" ? view.body.replace(/\s+/g, " ").trim() : view.body;
      if (!body || /^\*?conversation interrupted\*?$/i.test(body)) return;
      log(
        `${transport === "llm" && options.printThinking ? `[THINKING]${prefix}` : prefix}[${output.channel === "thinking" ? "thought" : "message"}] ${view.label}: ${body}`,
        view.tone,
      );
    } else if (output.type === "tool") {
      const status = output.status === "started" ? "start" : output.status;
      log(
        `${transport === "llm" ? `[THINKING]${prefix}` : prefix}[tool] ${status} ${transport === "llm" ? `${view.label}: ` : ""}${view.body}${transport === "llm" ? `${output.args ? ` args=${JSON.stringify(output.args)}` : ""}${output.result !== undefined ? ` result=${typeof output.result === "string" ? output.result : JSON.stringify(output.result)}` : ""}` : ""}${output.diagnostic ? ` error=${JSON.stringify({ ...output.diagnostic, message: errorMessage(locale, output.diagnostic.code) })}` : ""}`,
        view.tone,
      );
    } else if (output.type === "fallback") {
      const constraints =
        output.minValidActions === undefined
          ? ""
          : ` min_valid_actions=${output.minValidActions} allowedTools=${output.allowedTools?.join(",") ?? ""}`;
      log(
        `[${transport.toUpperCase()}_FALLBACK] ${marker} reason=${output.reason}${constraints} fallback=${output.action ? `${output.action.name} ${JSON.stringify(output.action.args)}` : "none"} · ${view.label}`,
        view.tone,
      );
    } else if (output.type === "retry") {
      log(
        `[${transport.toUpperCase()}_RETRY] ${marker} attempt=${output.attempt}/${output.maxAttempts} reason=${output.reason} · ${view.label}`,
        view.tone,
      );
    } else if (output.type === "bug") {
      log(
        `[${transport.toUpperCase()}_BUG] ${marker} stage=${output.stage ?? context.stage ?? "unknown"} severity=${output.severity} category=${output.category} report_id=${output.reportId} message=${output.message}`,
        view.tone,
      );
    } else log(`${prefix}[error] ${view.label}: ${view.body}`, view.tone);
  };
}
