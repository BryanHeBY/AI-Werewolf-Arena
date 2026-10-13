/**
 * 负责单个 Agent 行动选择窗口及接收回执；输入为游戏预检窄端口、原请求和提交的 turnId。
 * 输出保留脱离后的 selected、拒绝计数和 applied:false；截止／关闭只封住本选择窗口。
 * 本 owner 不持有 World 写权限、不消耗资源、不订阅领域 settlement，也不等待实际 commit。
 * 规则预检属于游戏 Gateway，领域完成责任仍由 reproduction 与各机制所有者持有。
 */
import { text, toolFailure } from "@ai-werewolf-arena/game-text";
import type { ActionRequest, ToolCall, ToolName } from "../../../core/domain";
import type {
  ActionPreflightPort,
  GameActionValidation,
} from "../../../game/gateway/action-reception";

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
export type ActionValidation = GameActionValidation;

/** 每个开放回合只有一个选择 owner；可恢复拒绝保留窗口，成功选择只封住一次。 */
export class ActionTurn {
  private selected: ToolCall | null = null;
  private closed = false;
  private rejectedActions = 0;
  constructor(
    private readonly reception: ActionPreflightPort,
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
  /** schema 拒绝可先于工具执行，但只由 turnId 对应的有效窗口计数；外来回合不污染当前窗口。 */
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
