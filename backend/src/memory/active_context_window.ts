import { EntityId } from "../domain/model";

export interface ContextLine {
  actorId: EntityId;
  text: string;
}

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

  private compact(): void {
    while (this.totalChars() > this.maxChars && this.lines.length > 0) {
      this.lines.shift();
    }
  }

  private totalChars(): number {
    return this.lines.reduce((sum, line) => sum + line.text.length, 0);
  }
}
