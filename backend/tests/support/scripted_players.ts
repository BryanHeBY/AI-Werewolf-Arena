import type { ActionProvider, ActionRequest, ActionStage, ToolCall } from "../../src/core";

export interface ScriptStep {
  actorId: number;
  day: number;
  stage: ActionStage;
  /** Ordinal within this player's day/stage, independent of other players. */
  turn: number;
  action: ToolCall | null;
  assertRequest?: (request: ActionRequest) => void;
}

const stepKey = (step: Pick<ScriptStep, "actorId" | "day" | "stage" | "turn">) => `${step.actorId}/${step.day}/${step.stage}/${step.turn}`;

/** Replace decisions only; extra/missing requests cannot hide behind a default action. */
export class StrictScriptedPlayers implements ActionProvider {
  readonly trace: Array<{ request: ActionRequest; action: ToolCall | null }> = [];
  private readonly steps = new Map<string, ScriptStep>();
  private readonly consumed = new Set<string>();
  private readonly counters = new Map<string, number>();

  constructor(steps: readonly ScriptStep[]) {
    for (const step of steps) {
      const key = stepKey(step);
      if (this.steps.has(key)) throw new Error(`script_duplicate_step: ${key}`);
      this.steps.set(key, step);
    }
  }

  async getAction(request: ActionRequest): Promise<ToolCall | null> {
    const base = `${request.actorId}/${request.context.day}/${request.context.stage}`;
    const turn = (this.counters.get(base) ?? 0) + 1;
    this.counters.set(base, turn);
    const key = `${base}/${turn}`;
    const step = this.steps.get(key);
    if (!step) throw new Error(`script_unexpected_request: ${key}`);
    step.assertRequest?.(request);
    this.consumed.add(key);
    const action = structuredClone(step.action);
    this.trace.push({ request: structuredClone(request), action: structuredClone(action) });
    return action;
  }

  assertConsumed(): void {
    const missing = [...this.steps.keys()].filter(key => !this.consumed.has(key));
    if (missing.length) throw new Error(`script_missing_requests: ${missing.join(", ")}`);
  }
}
