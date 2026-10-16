/**
 * 负责将 Pi 原生增量转换为共同私有输出，输入为玩家上下文与会话事件，输出为文本块和工具状态。
 * 只拥有内存文本缓冲，无文件／网络副作用；不决定显示开关、行动或记录去向。
 * 不创建超时预算；取消／关闭时由调用方 flush 尾段，原会话继续拥有实际资源回收责任。
 */
import type {
  AgentOutput,
  AgentOutputContext,
  AgentOutputSink,
} from "@ai-werewolf-arena/replay-contract";
import type { PiSessionEvent } from "./contracts";
import { AgentTextBuffer } from "../output/text-buffer";

export function createPiOutputObserver(context: AgentOutputContext, sink: AgentOutputSink) {
  const emit = (output: AgentOutput) =>
    sink({ visibility: "private", context: { ...context }, output: structuredClone(output) });
  const text = new AgentTextBuffer(emit);
  return {
    update(event: PiSessionEvent): void {
      if (event.type === "thinking" || event.type === "message") {
        if (event.partial) text.append(event.blockId, event.type, event.text);
        else text.finish(event.blockId);
      } else if (event.type === "tool_start" || event.type === "tool_end") {
        text.flush();
        emit(
          event.type === "tool_start"
            ? { type: "tool", id: event.id, name: event.name, status: "started", args: event.args }
            : {
                type: "tool",
                id: event.id,
                name: event.name,
                status: event.isError ? "failed" : "completed",
                result:
                  typeof event.result === "string" ||
                  (event.result && typeof event.result === "object" && !Array.isArray(event.result))
                    ? (event.result as Record<string, unknown> | string)
                    : undefined,
              },
        );
      } else if (event.type === "settled") text.flush();
    },
    flush: () => text.flush(),
  };
}
