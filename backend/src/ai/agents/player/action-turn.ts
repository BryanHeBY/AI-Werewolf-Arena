/**
 * Owns one agent-facing preflight selection window and its submission receipts.
 * Inputs are an existing ActionReception, the bound request and submitted turn ID;
 * outputs preserve detached selected actions, rejection counts and applied:false.
 * Closing seals only this selection window. This owner never commits domain
 * resources, subscribes to request settlement or waits for an engine commit;
 * those completion responsibilities remain in reproduction and mechanism owners.
 */
import { text, toolFailure } from "@ai-werewolf-arena/game-text";
import type { ActionRequest, ToolCall, ToolName } from "../../../core/domain";
import type { ActionReception } from "./action_reception";

export type ActionReceipt =
  | { ok: true; accepted: true; applied: false; action: ToolName }
  | {
      ok: false;
      error: string;
      message: string;
      details?: string[];
      expected_turn_id?: string;
      received_turn_id?: unknown;
    };
export type ActionValidation =
  { ok: true; action: ToolCall } | Extract<ActionReceipt, { ok: false }>;

/** One owner per open turn. Rejection keeps it open; selection seals it once. */
export class ActionTurn {
  private selected: ToolCall | null = null;
  private closed = false;
  private rejectedActions = 0;
  constructor(
    private readonly reception: ActionReception,
    readonly request: ActionRequest,
    readonly turnId: string,
  ) {}

  get action(): ToolCall | null {
    return this.selected ? structuredClone(this.selected) : null;
  }
  get outcome(): { rejectedActions: number; failureCode: "turn_invalid_action_limit" | null } {
    return {
      rejectedActions: this.rejectedActions,
      failureCode:
        !this.selected &&
        this.request.context.action_failure_policy === "error" &&
        this.rejectedActions >= 3
          ? "turn_invalid_action_limit"
          : null,
    };
  }

  authorize(turnId: unknown, tool = "submit_action"): Extract<ActionReceipt, { ok: false }> | null {
    const locale = this.reception.world.locale;
    if (this.closed || this.selected || (this.request.deadlineAtMs ?? Infinity) <= Date.now()) {
      return toolFailure(locale, "turn_not_open_or_session_invalid");
    }
    if (this.outcome.failureCode) return toolFailure(locale, this.outcome.failureCode);
    if (turnId !== this.turnId) {
      return {
        ...toolFailure(locale, "turn_id_mismatch"),
        expected_turn_id: this.turnId,
        received_turn_id: typeof turnId === "string" ? turnId : null,
        message: text(locale, "tool.turn_id_mismatch_context", { turn: this.turnId, tool }),
      };
    }
    return null;
  }

  submit(turnId: unknown, name: unknown, args: unknown): ActionReceipt {
    const refusal = this.authorize(turnId);
    if (refusal) return refusal;
    if (
      typeof name !== "string" ||
      args === null ||
      typeof args !== "object" ||
      Array.isArray(args)
    ) {
      this.rejectedActions++;
      return toolFailure(this.reception.world.locale, "invalid_submit_action_arguments");
    }
    const result = this.reception.validate(this.request, name, args);
    if (!result.ok) {
      this.rejectedActions++;
      return result;
    }
    this.selected = result.action;
    return { ok: true, accepted: true, applied: false, action: result.action.name };
  }
  /** Schema rejection may happen before tool execution, but only the addressed live turn owns it. */
  rejectSubmissionInput(turnId: unknown): ActionReceipt {
    const refusal = this.authorize(turnId);
    if (refusal) return refusal;
    this.rejectedActions++;
    return toolFailure(this.reception.world.locale, "invalid_submit_action_arguments");
  }

  close(): void {
    this.closed = true;
  }
}
