/**
 * 聚合 Pi 的流式思考／消息块，完成或取消时按块输出；终端开关不会影响 SDK 的独立审计收集。
 * 输入为玩家私有流式事件与终端开关，输出仅为聚合后的显示文本。
 * 这里只渲染已经提供的玩家私有输出，不执行工具、授予回合或写录制文件。
 */
import { text, type Locale } from "@ai-werewolf-arena/game-text";
import type { PiSessionEvent } from "../../adapters/pi";

export class PiConsolePresenter {
  private readonly blocks = new Map<string, { type: "thinking" | "message"; text: string }>();
  constructor(
    private readonly actorId: number,
    private readonly showMessages: boolean,
    private readonly showThinking: boolean,
    private readonly locale: Locale = "zh-CN",
  ) {}

  update(event: PiSessionEvent): void {
    if (event.type === "thinking" || event.type === "message") {
      if (event.partial) {
        const block = this.blocks.get(event.blockId) ?? { type: event.type, text: "" };
        block.text += event.text;
        this.blocks.set(event.blockId, block);
      } else this.flushBlock(event.blockId);
    } else if ((event.type === "tool_start" || event.type === "tool_end") && this.showThinking) {
      this.flush();
      console.log(
        `[pi][${this.actorId}][tool] ${event.type === "tool_start" ? "start" : "completed"} ${event.name} · ${text(this.locale, event.type === "tool_start" ? "runtime.acp.start" : event.type === "tool_end" && event.isError ? "runtime.acp.failed" : "runtime.acp.completed")}`,
      );
    }
  }
  flush(): void {
    for (const id of [...this.blocks.keys()]) this.flushBlock(id);
  }
  private flushBlock(id: string): void {
    const block = this.blocks.get(id);
    if (!block) return;
    this.blocks.delete(id);
    if (
      block.text &&
      (block.type === "thinking" ? this.showThinking : this.showMessages || this.showThinking)
    )
      console.log(
        `[pi][${this.actorId}][${block.type === "thinking" ? "thought" : "message"}] ${block.text}`,
      );
  }
}
