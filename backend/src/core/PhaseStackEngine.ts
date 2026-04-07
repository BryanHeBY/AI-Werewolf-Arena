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
    // 深度复制上下文以防止外部突变影响栈内数据
    const contextCopy =
      context === null || context === undefined
        ? context
        : JSON.parse(JSON.stringify(context));
    this.stack.push({ phase, context: contextCopy });
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

  /**
   * Get a snapshot of the current stack
   */
  getStackSnapshot(): StackNode[] {
    // Return a deep copy to prevent external mutation
    return this.stack.map((node) => ({
      phase: node.phase,
      context:
        node.context === null || node.context === undefined
          ? node.context
          : JSON.parse(JSON.stringify(node.context)),
    }));
  }
}
