/**
 * 负责规范玩家故障报告并按日次／阶段限流去重；输入是调用方上下文和原始报告字段，输出为拒绝、丢弃或接受标识。
 * 本服务实例独占三份去重／计数集合，实际报告记录归会话记录器，角色仅用作诊断元数据。
 * 只校验类别、严重程度和消息，不复验 actor/day/phase 的游戏许可，不提交动作或修改角色资源。
 * 直接报告记录及接受回调可传播失败；已经写入的记录和本地计数保留，不承诺事务回滚。
 */
import { toolFailure } from "@ai-werewolf-arena/game-text";
import { COMPONENT } from "../../../core/domain/components/names";
import { RoleComponent } from "../../../core/domain/components/role";
import { World } from "../../../core/domain/world";
import { safeRecordLogicOp } from "../../../recording/session_recorder";
import { getSessionRecorder } from "../../../recording/recording_context";

export type AgentBugCategory = "flow" | "rule" | "state" | "logging" | "other";
export type AgentBugSeverity = "low" | "medium" | "high" | "critical";

/** actor/day/phase/stage 由调用方给定；unknown 三字段先规范，身份元数据稍后从 World 查询。 */
export interface AgentBugReportInput {
  actorId: number;
  day: number;
  phase: string;
  stage: string;
  category: unknown;
  severity: unknown;
  message: unknown;
}

/** 无效报告是工具拒绝；已限流报告仍 ok=true，但 accepted=false 且没有新报告标识。 */
export type AgentBugReportResult =
  | { ok: false; error: string; message: string }
  | { ok: true; accepted: false; dropped: true; reason: string }
  | { ok: true; accepted: true; report_id: string };

export interface AgentBugReportServiceOptions {
  maxPerActorPerDay?: number;
  /** 记录及去重账本更新之后同步调用；回调失败不撤销已接受前缀。 */
  onAccepted?: (report: NormalizedAgentBugReport, reportId: string) => void;
}

/** 只替换类别、级别和 trim 后消息，其余上下文字段保持输入值；不代表验证了游戏状态。 */
export interface NormalizedAgentBugReport extends Omit<
  AgentBugReportInput,
  "category" | "severity" | "message"
> {
  category: AgentBugCategory;
  severity: AgentBugSeverity;
  message: string;
}

const CATEGORIES = new Set<AgentBugCategory>(["flow", "rule", "state", "logging", "other"]);
const SEVERITIES = new Set<AgentBugSeverity>(["low", "medium", "high", "critical"]);

/**
 * SDK／ACP 使用同一份报告处理实现；各实例保持自己的去重状态，不共享全局计数账本。
 */
export class AgentBugReportService {
  // 三类键分别限制 actor/day 总量、同阶段名额和规范消息；跨阶段相同消息仍占同日重复键。
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
      return toolFailure(this.world.locale, parsed.error);
    }
    const report = parsed.value;
    const actorDayKey = `${report.actorId}|${report.day}`;
    const scopeKey = `${actorDayKey}|${report.phase}|${report.stage}`;
    const messageKey = `${actorDayKey}|${report.category}|${report.severity}|${normalizeMessage(report.message)}`;
    const acceptedCount = this.acceptedCountByActorDay.get(actorDayKey) ?? 0;

    // 拒绝原因按总量→阶段→消息首命中；计数检查不会提前消耗后续名额。
    const droppedReason =
      acceptedCount >= this.maxPerActorPerDay
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

    // 限流通过后才查询角色并直接追加诊断记录；Camp在其原字段位置晚读，未作行动授权。
    const role = this.world.getComponent(report.actorId, COMPONENT.Role);
    const reportId =
      getSessionRecorder()?.recordDebugReport({
        timestampMs: Date.now(),
        day: report.day,
        phase: report.phase,
        stage: report.stage,
        actorId: report.actorId,
        actorRole: role?.role ?? "unknown",
        actorCamp: (role && this.world.getComponent(report.actorId, COMPONENT.Camp)?.camp) ?? "unknown",
        category: report.category,
        severity: report.severity,
        message: report.message,
      }) ?? "rb-no-recorder";

    // 记录取得标识之后再依次消费三份名额；随后日志或回调失败仍保留已消费前缀。
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

  private normalize(
    input: AgentBugReportInput,
  ): { ok: true; value: NormalizedAgentBugReport } | { ok: false; error: string } {
    // 先完成类别／级别转换和消息trim，再按类别→级别→空消息→长度返回首错误；不吞转换异常。
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
      input: {
        args: { category: input.category, severity: input.severity, message: input.message },
      },
    });
  }
}

/** 重复键统一大小写和空白，实际记录仍保留 trim 后的原消息；不改模型发言或游戏事件。 */
function normalizeMessage(message: string): string {
  return message.toLowerCase().replace(/\s+/g, " ").trim();
}
