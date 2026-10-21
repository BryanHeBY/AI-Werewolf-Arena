/**
 * 负责读取工具结果内的已知版本执行回执。输入为私有工具输出和可能的 MCP 包装，输出为校验后的反馈或 undefined。
 * 旧回执和模型正文不会升级成执行事实；不授予可见性，不修改历史录制或重新执行规则。
 */
import {
  copyEventData,
  TOOL_NAMES,
  type ToolName,
  type ActionExecutionReceipt,
} from "@ai-werewolf-arena/game-contract";
import type { AgentOutput } from "./agent-output";

export function agentActionExecution(output: AgentOutput): ActionExecutionReceipt | undefined {
  if (output.type !== "tool") return;
  let value: unknown = output.result;
  try {
    for (let depth = 0; depth < 4; depth++) {
      if (typeof value === "string") value = JSON.parse(value);
      if (!value || typeof value !== "object" || Array.isArray(value)) return;
      const item = value as Record<string, unknown>;
      if (
        item.ok === true &&
        item.accepted === true &&
        typeof item.action === "string" &&
        (TOOL_NAMES as readonly string[]).includes(item.action) &&
        (/(?:^|[._])submit_action$/.test(output.name) || output.name === item.action)
      ) {
        const feedback = item.feedback as Record<string, unknown> | undefined;
        if (!feedback || feedback.version !== 1 || !Array.isArray(feedback.events)) return;
        if (
          !feedback.events.every(
            (event) =>
              event &&
              typeof event === "object" &&
              typeof event.type === "string" &&
              event.payload &&
              typeof event.payload === "object" &&
              !Array.isArray(event.payload),
          )
        )
          return;
        if (
          item.status === "interrupted" || item.status === "unavailable"
            ? item.applied !== null
            : item.status === "not_applied"
              ? item.applied !== false
              : (item.status !== "resolved" && item.status !== "committed") || item.applied !== true
        )
          return;
        return {
          ok: true,
          accepted: true,
          action: item.action as ToolName,
          status: item.status as ActionExecutionReceipt["status"],
          applied: item.applied as boolean | null,
          feedback: {
            version: 1,
            events: feedback.events.map((event) => {
              // 单个投影 payload 保持既有事实深度上限；外层回执包装不挤占领域数据深度。
              const payload = copyEventData(event.payload) as Record<string, unknown>;
              return { type: event.type as string, payload };
            }),
          },
        };
      }
      const content = Array.isArray(item.content) ? item.content : [];
      value = item.structuredContent ?? content.find((block) => block?.type === "text")?.text;
    }
  } catch {
    /* 私有旧档或未知扩展保持原始工具展示。 */
  }
}
