import { COMPONENT } from "../../../core/domain/components/names";
import { RoleComponent } from "../../../core/domain/components/role";
import { World } from "../../../core/domain/world";
import { safeRecordLogicOp, SessionRecordHub } from "../../../observability";

export type AgentBugCategory = "flow" | "rule" | "state" | "logging" | "other";
export type AgentBugSeverity = "low" | "medium" | "high" | "critical";

export interface AgentBugReportInput {
  actorId: number;
  day: number;
  phase: string;
  stage: string;
  category: unknown;
  severity: unknown;
  message: unknown;
}

export type AgentBugReportResult =
  | { ok: false; error: string }
  | { ok: true; accepted: false; dropped: true; reason: string }
  | { ok: true; accepted: true; report_id: string };

export interface AgentBugReportServiceOptions {
  maxPerActorPerDay?: number;
  onAccepted?: (report: NormalizedAgentBugReport, reportId: string) => void;
}

export interface NormalizedAgentBugReport
  extends Omit<AgentBugReportInput, "category" | "severity" | "message"> {
  category: AgentBugCategory;
  severity: AgentBugSeverity;
  message: string;
}

const CATEGORIES = new Set<AgentBugCategory>(["flow", "rule", "state", "logging", "other"]);
const SEVERITIES = new Set<AgentBugSeverity>(["low", "medium", "high", "critical"]);

/**
 * 玩家 bug 上报的领域服务：所有 Agent transport 共享校验、限流、去重和落盘策略。
 */
export class AgentBugReportService {
  private readonly acceptedScopes = new Set<string>();
  private readonly acceptedMessages = new Set<string>();
  private readonly acceptedCountByActorDay = new Map<string, number>();
  private readonly maxPerActorPerDay: number;

  constructor(
    private readonly world: World,
    private readonly options: AgentBugReportServiceOptions = {},
  ) {
    this.maxPerActorPerDay = Math.max(1, options.maxPerActorPerDay ?? 3);
  }

  report(input: AgentBugReportInput): AgentBugReportResult {
    const parsed = this.normalize(input);
    if (!parsed.ok) {
      this.recordRejected(input, parsed.error);
      return parsed;
    }
    const report = parsed.value;
    const actorDayKey = `${report.actorId}|${report.day}`;
    const scopeKey = `${actorDayKey}|${report.phase}|${report.stage}`;
    const messageKey = `${actorDayKey}|${report.category}|${report.severity}|${normalizeMessage(report.message)}`;
    const acceptedCount = this.acceptedCountByActorDay.get(actorDayKey) ?? 0;

    const droppedReason = acceptedCount >= this.maxPerActorPerDay
      ? "report_bug_actor_day_rate_limited"
      : this.acceptedScopes.has(scopeKey)
      ? "report_bug_scope_rate_limited"
      : this.acceptedMessages.has(messageKey)
      ? "report_bug_duplicate_message"
      : undefined;
    if (droppedReason) {
      safeRecordLogicOp({
        scope: "llm_action_provider",
        op: "report_bug_dropped",
        actorId: report.actorId,
        phase: report.phase,
        status: "fallback",
        reason: droppedReason,
        input: { day: report.day, stage: report.stage },
      });
      return { ok: true, accepted: false, dropped: true, reason: droppedReason };
    }

    const role = this.world.getComponent<RoleComponent>(report.actorId, COMPONENT.Role);
    const reportId = SessionRecordHub.getActive()?.recordDebugReport({
      timestampMs: Date.now(),
      day: report.day,
      phase: report.phase,
      stage: report.stage,
      actorId: report.actorId,
      actorRole: role?.role ?? "unknown",
      actorCamp: role?.camp ?? "unknown",
      category: report.category,
      severity: report.severity,
      message: report.message,
    }) ?? "rb-no-recorder";

    this.acceptedScopes.add(scopeKey);
    this.acceptedMessages.add(messageKey);
    this.acceptedCountByActorDay.set(actorDayKey, acceptedCount + 1);
    safeRecordLogicOp({
      scope: "llm_action_provider",
      op: "report_bug_recorded",
      actorId: report.actorId,
      phase: report.phase,
      status: "ok",
      output: {
        report_id: reportId,
        category: report.category,
        severity: report.severity,
      },
    });
    this.options.onAccepted?.(report, reportId);
    return { ok: true, accepted: true, report_id: reportId };
  }

  private normalize(input: AgentBugReportInput):
    | { ok: true; value: NormalizedAgentBugReport }
    | { ok: false; error: string } {
    const category = String(input.category ?? "") as AgentBugCategory;
    const severity = String(input.severity ?? "") as AgentBugSeverity;
    const message = typeof input.message === "string" ? input.message.trim() : "";
    if (!CATEGORIES.has(category)) return { ok: false, error: "invalid_report_bug_category" };
    if (!SEVERITIES.has(severity)) return { ok: false, error: "invalid_report_bug_severity" };
    if (!message) return { ok: false, error: "invalid_report_bug_message_empty" };
    if (message.length > 300) return { ok: false, error: "invalid_report_bug_message_too_long" };
    return { ok: true, value: { ...input, category, severity, message } };
  }

  private recordRejected(input: AgentBugReportInput, reason: string): void {
    safeRecordLogicOp({
      scope: "llm_action_provider",
      op: "report_bug_rejected",
      actorId: input.actorId,
      phase: input.phase,
      status: "rejected",
      reason,
      input: { args: { category: input.category, severity: input.severity, message: input.message } },
    });
  }
}

function normalizeMessage(message: string): string {
  return message.toLowerCase().replace(/\s+/g, " ").trim();
}

