import { EntityId } from "../../core/domain/model";

/**
 * 上下文窗口中的单条发言记录。
 */
export interface ContextLine {
  actorId: EntityId;
  text: string;
}

/**
 * 活跃上下文窗口：
 * 保存最近对话原文，当字符总量超阈值时从最早消息开始裁剪。
 */
export class ActiveContextWindow {
  private readonly maxChars: number;
  private readonly lines: ContextLine[] = [];

  constructor(maxChars: number = 4000) {
    this.maxChars = maxChars;
  }

  /**
   * 写入一条新上下文并触发裁剪。
   */
  push(line: ContextLine): void {
    this.lines.push(line);
    this.compact();
  }

  /**
   * 读取当前窗口内容（浅拷贝）。
   */
  list(): ContextLine[] {
    return [...this.lines];
  }

  /**
   * 统计窗口内总字符数。
   */
  totalChars(): number {
    return this.lines.reduce((sum, line) => sum + line.text.length, 0);
  }

  /**
   * 从最旧消息开始提取，直到总字符数不超过目标值。
   */
  extractOldestUntilWithin(targetChars: number): ContextLine[] {
    const extracted: ContextLine[] = [];
    while (this.totalChars() > targetChars && this.lines.length > 0) {
      const line = this.lines.shift();
      if (line) {
        extracted.push(line);
      }
    }
    return extracted;
  }

  /**
   * 将窗口裁剪到最大字符阈值内。
   */
  private compact(): void {
    // 采用“滑动窗口”策略，确保上下文长度始终可控。
    while (this.totalChars() > this.maxChars && this.lines.length > 0) {
      this.lines.shift();
    }
  }
}
