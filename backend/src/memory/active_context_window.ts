import { EntityId } from "../domain/model";

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

  push(line: ContextLine): void {
    this.lines.push(line);
    this.compact();
  }

  list(): ContextLine[] {
    return [...this.lines];
  }

  totalChars(): number {
    return this.lines.reduce((sum, line) => sum + line.text.length, 0);
  }

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

  private compact(): void {
    // 采用“滑动窗口”策略，确保上下文长度始终可控。
    while (this.totalChars() > this.maxChars && this.lines.length > 0) {
      this.lines.shift();
    }
  }
}
