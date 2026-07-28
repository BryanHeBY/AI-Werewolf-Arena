import { ActionRequest, ToolCall, ToolName } from "../../../core/domain/model";

export const WEREWOLF_MCP_SCHEMA = {
  protocol_version: "1",
  tools: {
    get_game_schema: "查询固定 MCP 工具与参数协议；不返回局内状态。",
    submit_action: "{ turn_id, action, arguments }；action 必须属于当前回合允许动作。",
    report_bug: "{ turn_id, category, severity, message }；只上报明确的引擎矛盾。",
  },
} as const;

export interface McpSubmitActionParams {
  turn_id: string;
  action: string;
  arguments: Record<string, unknown>;
}

export interface McpReportBugParams {
  turn_id: string;
  category: "flow" | "rule" | "state" | "logging" | "other";
  severity: "low" | "medium" | "high" | "critical";
  message: string;
}

export type McpBridgeResult =
  | { ok: true; accepted: true }
  | { ok: false; error: string };

export interface AcpBugReport {
  actorId: number;
  turnId: string;
  category: "flow" | "rule" | "state" | "logging" | "other";
  severity: "low" | "medium" | "high" | "critical";
  message: string;
}

export interface AcpPendingTurn {
  sessionId: string;
  turnId: string;
  action: Promise<ToolCall | null>;
}

interface PendingTurn extends AcpPendingTurn {
  request: ActionRequest;
  resolve: (action: ToolCall | null) => void;
}

/**
 * ACP 私有扩展的回合注册表。
 *
 * 动作通过与 Agent 相同的 ACP connection 进入；sessionId 由 Client 在
 * 创建 session 后绑定，Agent 不持有 loopback token，也不需要旁路子进程。
 */
export class AcpTurnRegistry {
  private readonly pendingBySession = new Map<string, PendingTurn>();
  private readonly nextTurnNumberBySession = new Map<string, number>();

  constructor(private readonly onBugReport?: (report: AcpBugReport) => void) {}

  openTurn(request: ActionRequest, sessionId: string): AcpPendingTurn {
    if (this.pendingBySession.has(sessionId)) {
      throw new Error("acp_turn_already_open_for_session");
    }
    // The model must echo this value into submit_action. A short monotonic
    // token keeps stale-turn protection without asking an agent to reproduce
    // a UUID exactly (which caused otherwise valid actions to be rejected).
    const turnNumber = (this.nextTurnNumberBySession.get(sessionId) ?? 0) + 1;
    this.nextTurnNumberBySession.set(sessionId, turnNumber);
    const turnId = `t${turnNumber}`;
    let resolve!: (action: ToolCall | null) => void;
    const action = new Promise<ToolCall | null>((done) => {
      resolve = done;
    });
    this.pendingBySession.set(sessionId, {
      sessionId,
      turnId,
      request,
      action,
      resolve,
    });
    return { sessionId, turnId, action };
  }

  closeTurn(sessionId: string): void {
    const pending = this.pendingBySession.get(sessionId);
    if (!pending) {
      return;
    }
    this.pendingBySession.delete(sessionId);
    pending.resolve(null);
  }

  getSchema(): typeof WEREWOLF_MCP_SCHEMA {
    return WEREWOLF_MCP_SCHEMA;
  }

  submitAction(sessionId: string, input: McpSubmitActionParams): McpBridgeResult {
    const pending = this.getPending(sessionId, input.turn_id);
    if (!pending) {
      return { ok: false, error: "turn_not_open_or_session_invalid" };
    }
    if (!pending.request.allowedTools.includes(input.action as ToolName)) {
      return { ok: false, error: "tool_not_allowed_in_this_turn" };
    }

    // 接受一次即关闭当前窗口；后续请求只能拿到明确拒绝，不能污染下一阶段。
    this.pendingBySession.delete(sessionId);
    pending.resolve({
      name: input.action as ToolName,
      args: input.arguments as ToolCall["args"],
    } as ToolCall);
    return { ok: true, accepted: true };
  }

  reportBug(sessionId: string, input: McpReportBugParams): McpBridgeResult {
    const pending = this.getPending(sessionId, input.turn_id);
    if (!pending) {
      return { ok: false, error: "turn_not_open_or_session_invalid" };
    }
    this.onBugReport?.({
      actorId: pending.request.actorId,
      turnId: pending.turnId,
      category: input.category,
      severity: input.severity,
      message: input.message.trim(),
    });
    return { ok: true, accepted: true };
  }

  close(): void {
    for (const pending of this.pendingBySession.values()) {
      pending.resolve(null);
    }
    this.pendingBySession.clear();
    this.nextTurnNumberBySession.clear();
  }

  private getPending(sessionId: string, turnId: string): PendingTurn | null {
    const pending = this.pendingBySession.get(sessionId);
    return pending?.turnId === turnId ? pending : null;
  }
}
