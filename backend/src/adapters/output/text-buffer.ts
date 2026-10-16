/**
 * 负责归并一个玩家当前作用域内的原生文本片段，输入为块 ID、通道与增量，输出为完整块或有界分段。
 * 只拥有内存缓冲，没有文件、网络或协议副作用；先删除已发送前缀，避免显示失败后重复发送。
 * 不设置期限预算；取消和关闭时由原会话所有者 flush，不在这里管理会话或行动许可。
 */
import type { AgentOutput } from "@ai-werewolf-arena/replay-contract";

export class AgentTextBuffer {
  private readonly blocks = new Map<string, { channel: "thinking" | "message"; text: string }>();
  constructor(
    private readonly emit: (output: AgentOutput) => void,
    private readonly options: { maxChunkLength?: number; splitLines?: boolean } = {},
  ) {}
  append(id: string, channel: "thinking" | "message", chunk: string): void {
    const block = this.blocks.get(id) ?? { channel, text: "" };
    block.text += chunk;
    this.blocks.set(id, block);
    const limit = this.options.maxChunkLength ?? Infinity;
    while (block.text.length) {
      const newline = this.options.splitLines ? block.text.search(/[\r\n]/) : -1;
      if (newline < 0 && block.text.length <= limit) break;
      let end = newline >= 0 && newline <= limit ? newline : limit;
      const hasNewline = end === newline;
      if (!hasNewline && /[\uD800-\uDBFF]/.test(block.text[end - 1]!)) end--;
      // 分段可以包含换行分隔符；终端负责规整，归档消费者才能逐字还原原文。
      const text = block.text.slice(0, end + (hasNewline ? 1 : 0));
      block.text = block.text.slice(end + (hasNewline ? 1 : 0));
      if (text) this.emit({ type: "text", channel, text });
    }
  }
  finish(id: string): void {
    const block = this.blocks.get(id);
    if (!block) return;
    this.blocks.delete(id);
    if (block.text) this.emit({ type: "text", channel: block.channel, text: block.text });
  }
  flush(): void {
    for (const id of [...this.blocks.keys()]) this.finish(id);
  }
}
