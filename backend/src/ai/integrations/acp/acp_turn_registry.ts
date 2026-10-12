/**
 * Adapts ACP session submissions to the shared agent-facing ActionTurn owner.
 * Inputs are session-bound engine requests, turn IDs and protocol submissions;
 * outputs retain pending action promises, preflight receipts and bug reports.
 * Session deadlines are read by the turn owner; registry close cancels only its
 * selection windows. No ACP receipt commits inventory or settles domain completion.
 */
import { toolFailure } from "@ai-werewolf-arena/game-text";
import { ActionRequest, ToolCall } from "../../../core/domain";
import { World } from "../../../core/domain/world";
import {
  RoleCatalog,
  getDefaultRoleCatalog,
  ToolValidationRuleRegistry,
} from "../../../game/mechanisms";
import { ActionReception } from "../../agents/player/action_reception";
import { ActionTurn, type ActionReceipt } from "../../agents/player/action-turn";
import {
  GameReportBugInput as McpReportBugParams,
  GameSubmitActionInput as McpSubmitActionParams,
  WEREWOLF_GAME_TOOL_SCHEMA,
  gameToolProtocol,
} from "../../agents/game_tool_protocol";
import type { Locale } from "@ai-werewolf-arena/game-text";
import { isLocale } from "@ai-werewolf-arena/game-catalog";
import {
  getActionRequestDay,
  getActionRequestStage,
} from "../../../core/domain/action_request_context";
export type {
  GameReportBugInput as McpReportBugParams,
  GameSubmitActionInput as McpSubmitActionParams,
} from "../../agents/game_tool_protocol";

export type McpBridgeResult =
  | ActionReceipt
  | { ok: true; accepted: true }
  | { ok: true; accepted: false; dropped: true; reason: string }
  | { ok: false; error: string; message?: string };

export interface AcpBugReport {
  actorId: number;
  turnId: string;
  day: number;
  phase: string;
  stage: string;
  category: "flow" | "rule" | "state" | "logging" | "other";
  severity: "low" | "medium" | "high" | "critical";
  message: string;
}

export interface AcpPendingTurn {
  sessionId: string;
  turnId: string;
  action: Promise<ToolCall | null>;
  readonly outcome: ActionTurn["outcome"];
}

interface PendingTurn extends AcpPendingTurn {
  request: ActionRequest;
  owner: ActionTurn;
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
  private readonly reception: ActionReception;
  private closed = false;
  get snapshot() {
    return { closed: this.closed, pending: this.pendingBySession.size };
  }
  readonly locale: Locale;

  constructor(
    world: World,
    private readonly onBugReport?: (report: AcpBugReport) => McpBridgeResult | void,
    roleCatalog: RoleCatalog = getDefaultRoleCatalog(),
  ) {
    this.locale = world.locale;
    if (!isLocale(this.locale)) throw new Error("acp_task_locale_invalid");
    this.reception = new ActionReception(
      world,
      undefined,
      undefined,
      new ToolValidationRuleRegistry(undefined, roleCatalog),
    );
  }

  openTurn(request: ActionRequest, sessionId: string): AcpPendingTurn {
    if (this.closed) throw new Error("acp_registry_closed");
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
    const owner = new ActionTurn(this.reception, request, turnId);
    this.pendingBySession.set(sessionId, {
      sessionId,
      turnId,
      request,
      owner,
      get outcome() {
        return owner.outcome;
      },
      action,
      resolve,
    });
    return {
      sessionId,
      turnId,
      action,
      get outcome() {
        return owner.outcome;
      },
    };
  }

  closeTurn(sessionId: string): void {
    const pending = this.pendingBySession.get(sessionId);
    if (!pending) {
      return;
    }
    this.pendingBySession.delete(sessionId);
    pending.owner.close();
    pending.resolve(null);
  }

  getSchema(): typeof WEREWOLF_GAME_TOOL_SCHEMA {
    return gameToolProtocol(this.locale).schema;
  }

  submitAction(sessionId: string, input: McpSubmitActionParams): McpBridgeResult {
    const pending = this.pendingBySession.get(sessionId);
    if (!pending) {
      return toolFailure(this.locale, "turn_not_open_or_session_invalid");
    }
    const result = pending.owner.submit(input.turn_id, input.action, input.arguments);
    if (!result.ok) {
      if (pending.owner.outcome.failureCode) {
        this.pendingBySession.delete(sessionId);
        pending.owner.close();
        pending.resolve(null);
      }
      return result;
    }

    // 接受一次即关闭当前窗口；后续请求只能拿到明确拒绝，不能污染下一阶段。
    this.pendingBySession.delete(sessionId);
    pending.resolve(pending.owner.action);
    return result;
  }
  rejectSubmissionInput(sessionId: string, turnId: unknown): McpBridgeResult {
    const pending = this.pendingBySession.get(sessionId);
    if (!pending) return toolFailure(this.locale, "turn_not_open_or_session_invalid");
    const result = pending.owner.rejectSubmissionInput(turnId);
    if (pending.owner.outcome.failureCode) {
      this.pendingBySession.delete(sessionId);
      pending.owner.close();
      pending.resolve(null);
    }
    return result;
  }

  reportBug(sessionId: string, input: McpReportBugParams): McpBridgeResult {
    const pending = this.pendingBySession.get(sessionId);
    if (!pending) {
      return toolFailure(this.locale, "turn_not_open_or_session_invalid");
    }
    const refusal = pending.owner.authorize(input.turn_id, "report_bug");
    if (refusal) return refusal;
    const result = this.onBugReport?.({
      actorId: pending.request.actorId,
      turnId: pending.turnId,
      day: getActionRequestDay(pending.request),
      phase: String(pending.request.phase),
      stage: getActionRequestStage(pending.request),
      category: input.category,
      severity: input.severity,
      message: input.message.trim(),
    });
    if (result?.ok === false) return toolFailure(this.locale, result.error, result.message);
    return result ?? { ok: true, accepted: true };
  }

  close(): void {
    this.closed = true;
    for (const pending of this.pendingBySession.values()) {
      pending.owner.close();
      pending.resolve(null);
    }
    this.pendingBySession.clear();
    this.nextTurnNumberBySession.clear();
  }
}
