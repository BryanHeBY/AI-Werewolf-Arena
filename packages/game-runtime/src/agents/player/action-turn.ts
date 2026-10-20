/**
 * 负责单个 Agent 行动选择窗口及接收回执；输入为游戏预检窄端口、原请求和提交的 turnId。
 * 输出保留脱离后的候选、待确认提案、拒绝计数和 applied:false；截止在授权点检查，close 封窗并撤销未确认编号。
 * 本 owner 只消费预检接口与 World locale，不调用 World 写方法、不消耗资源、不订阅领域 settlement，也不等待实际 commit。
 * 规则预检属于游戏 Gateway，领域完成责任仍由 reproduction 与各机制所有者持有。
 */
import { text, toolFailure } from "@ai-werewolf-arena/game-text";
import { isDeepStrictEqual } from "node:util";
import type { ActionRequest, ToolCall, ToolName } from "../../domain";
import type {
  ActionPreflightPort,
  GameActionValidation,
} from "../../engine/actions/action-reception";

/** accepted:true 只表示本次候选被选择且 applied 固定 false；拒绝字段保原回包，不是领域付款／回滚回执。 */
export type ActionReceipt =
  | {
      ok: true;
      accepted: true;
      applied: false;
      action: ToolName;
      status?: "confirmed";
      confirmation_id?: string;
    }
  | {
      ok: true;
      status: "confirmation_required";
      accepted: false;
      applied: false;
      confirmation_id: string;
      action: ToolName;
      arguments: Record<string, unknown>;
      warning: string;
    }
  | {
      ok: false;
      error: string;
      message: string;
      details?: string[];
      expected_turn_id?: string;
      received_turn_id?: unknown;
    };
export type ActionValidation = GameActionValidation;

/** 每个开放回合只有一个选择 owner；拒绝按原政策保留窗口，selected 本身阻止后续选择，不等于 closed 已被设置。 */
export class ActionTurn {
  // selected 与 closed 分别保候选和显式关闭；拒绝次数不等于资源消耗，严格三次门槛每次从原请求政策求值。
  private selected: ToolCall | null = null;
  private closed = false;
  private rejectedActions = 0;
  // 编号只属于本 owner；绑定预检后的完整候选与请求作用域，不写入领域参数或持久会话状态。
  private confirmation?: { id: string; action: ToolCall; scope: unknown };
  constructor(
    private readonly reception: ActionPreflightPort,
    readonly request: ActionRequest,
    readonly turnId: string,
  ) {}

  /** 每次访问克隆已选候选；克隆失败不撤回 selected，也不改变 closed 或补做领域提交。 */
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

  // locale→closed/selected/期限→严格失败上限→turnId 按原顺序读取；没有计时器或新增期限数值校验。
  authorize(turnId: unknown, tool = "submit_action"): Extract<ActionReceipt, { ok: false }> | null {
    const locale = this.reception.locale;
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

  submit(turnId: unknown, name: unknown, args: unknown, confirmationId?: unknown): ActionReceipt {
    const refusal = this.authorize(turnId);
    if (refusal) return refusal;
    if (
      typeof name !== "string" ||
      args === null ||
      typeof args !== "object" ||
      Array.isArray(args)
    ) {
      this.confirmation = undefined;
      this.rejectedActions++;
      return toolFailure(this.reception.locale, "invalid_submit_action_arguments");
    }
    // 预检返回拒绝才计数；预检直接抛错不在这里 catch 或换成拒绝，原异常留给实际传输调用方。
    const result = this.reception.validate(this.request, name, args);
    if (!result.ok) {
      this.confirmation = undefined;
      this.rejectedActions++;
      return result;
    }
    const scope = {
      actorId: this.request.actorId,
      day: this.request.context.day,
      phase: this.request.phase,
      stage: this.request.context.stage,
      window: this.request.actionWindow,
    };
    if (confirmationId !== undefined) {
      const proposal = this.confirmation;
      if (
        !result.confirmation ||
        !proposal ||
        confirmationId !== proposal.id ||
        !isDeepStrictEqual(proposal.action, result.action) ||
        !isDeepStrictEqual(proposal.scope, scope)
      ) {
        this.confirmation = undefined;
        this.rejectedActions++;
        return toolFailure(this.reception.locale, "action_confirmation_invalid");
      }
    } else if (result.confirmation) {
      // 同一首次请求重传只返回原警示；只有携带宿主随机编号的后续请求才能选中。
      if (
        !this.confirmation ||
        !isDeepStrictEqual(this.confirmation.action, result.action) ||
        !isDeepStrictEqual(this.confirmation.scope, scope)
      ) {
        this.confirmation = {
          id: crypto.randomUUID(),
          action: structuredClone(result.action),
          scope: structuredClone(scope),
        };
      }
      return {
        ok: true,
        status: "confirmation_required",
        accepted: false,
        applied: false,
        confirmation_id: this.confirmation.id,
        action: result.action.name,
        arguments: structuredClone(result.action.args),
        warning: text(this.reception.locale, "action.self_destruct.confirmation_warning", {
          actor: this.request.actorId,
        }),
      };
    }
    this.confirmation = undefined;
    // 候选引用先保存，再读回包 action.name；后续 getter／调用方序列化失败也保已经选择的前缀。
    this.selected = result.action;
    return {
      ok: true,
      accepted: true,
      applied: false,
      action: result.action.name,
      ...(result.confirmation
        ? { status: "confirmed" as const, confirmation_id: confirmationId as string }
        : {}),
    };
  }
  /** schema 拒绝可先于工具执行，但只由 turnId 对应的有效窗口计数；外来回合不污染当前窗口。 */
  rejectSubmissionInput(turnId: unknown): ActionReceipt {
    const refusal = this.authorize(turnId);
    if (refusal) return refusal;
    this.confirmation = undefined;
    this.rejectedActions++;
    return toolFailure(this.reception.locale, "invalid_submit_action_arguments");
  }

  /** 只写本窗口 closed；不取消模型、关闭会话、清理候选或通知领域完成，这些仍归原调用链。 */
  close(): void {
    this.closed = true;
    this.confirmation = undefined;
  }
}
