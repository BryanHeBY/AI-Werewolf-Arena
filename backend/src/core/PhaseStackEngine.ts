import { GamePhase } from "./types";

export interface StackNode {
  phase: GamePhase;
  context?: any; // Optional context for phase-specific data
}

export class PhaseStack {
  private stack: StackNode[] = [];
  private readonly maxDepth = 50; // Prevent infinite loops

  push(phase: GamePhase, context?: any): void {
    if (this.stack.length >= this.maxDepth) {
      throw new Error("PhaseStack exceeded maximum depth (50)");
    }
    this.stack.push({ phase, context });
  }

  pop(): StackNode | null {
    return this.stack.pop() || null;
  }

  peek(): StackNode | null {
    return this.stack.length > 0 ? this.stack[this.stack.length - 1] : null;
  }

  clear(): void {
    this.stack = [];
  }

  get depth(): number {
    return this.stack.length;
  }

  /**
   * Special case handling for self-destruct scenarios
   */
  clearDayPhases(): void {
    const nightIndex = this.stack.findIndex(
      (node) => node.phase === GamePhase.NightStart,
    );

    if (nightIndex !== -1) {
      this.stack = this.stack.slice(0, nightIndex + 1);
    } else {
      this.stack = [];
    }
  }
}
