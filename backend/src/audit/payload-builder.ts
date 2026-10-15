/**
 * 负责由原录制视图构造有限审计任务与缩减重试载荷。输入为公开事件、逻辑操作、玩家记录及条目上限，输出分来源任务 payload。
 * 只加工任务副本，原记录仍归录制；传输诊断分支只保受控事实，不把模型异常原文当游戏许可或审计结论。
 */
import { readErrorDiagnostic, type ErrorDiagnostic } from "@ai-werewolf-arena/replay-contract";
import { RuleError, type Locale } from "@ai-werewolf-arena/game-contract";
import { AuditFinding, AuditInspectionResult } from "./agents/audit-tool-protocol";
import type { DebugSummaryPipelineInput } from "./pipeline";
import { ReplayLogicOp, ReplayPlayerView, ReplayPublicEvent } from "../recording/contracts";

export interface AuditAgentTask {
  locale?: Locale;
  name: string;
  source: string;
  payload: Record<string, unknown>;
}

export interface AuditAgentOutput extends Omit<AuditInspectionResult, "kind"> {
  failed?: boolean;
  failure_reason?: string;
}

export interface AuditPayloadLimits {
  publicMaxItems: number;
  maxItems: number;
  playerMaxItems: number;
}

function truncate(text: string, maxChars: number): string {
  return text.length <= maxChars ? text : `${text.slice(0, maxChars)}…`;
}

function safeJsonString(value: unknown, maxChars: number): string {
  try {
    return truncate(JSON.stringify(value) || "", maxChars);
  } catch {
    return "{}";
  }
}

function summarizePublicEvents(events: ReplayPublicEvent[], maxItems: number) {
  const keepTypes = new Set([
    "phase_changed",
    "night_resolved",
    "wolf_self_destruct",
    "sheriff_nomination_summary",
    "sheriff_vote_summary",
    "sheriff_elected",
    "voted_out",
    "idiot_revealed",
    "last_words_spoken",
    "witch_potion_used",
    "witch_potion_skipped",
    "day_speech",
  ]);
  const output: Record<string, unknown>[] = [];
  for (const event of events) {
    if (!keepTypes.has(event.type)) continue;
    if (event.type === "day_speech" || event.type === "last_words_spoken") {
      output.push({
        seq: event.seq,
        day: event.day,
        phase: event.phase,
        type: event.type,
        actorId: (event.payload as any).actorId ?? (event.payload as any).playerId,
        text: truncate(String((event.payload as any).text ?? ""), 160),
      });
    } else {
      output.push({
        seq: event.seq,
        day: event.day,
        phase: event.phase,
        type: event.type,
        payload: event.payload,
      });
    }
    if (output.length >= maxItems) break;
  }
  return output;
}

// 传输异常文案及任意输入／输出可能含凭据，不能直接作为该分支的审计摘要。
// 下面的传输分支只投递受控诊断事实，原始录制不改写。
const transportOperations = new Set([
  "action_provider_error",
  "tool_call_rejected",
  "llm_fallback",
  "report_bug_dropped",
  "report_bug_recorded",
  "report_bug_rejected",
]);
const transportReasons = new Set<string>([
  ...Object.values(RuleError),
  "runtime_error",
  "deadline_skip",
  "request_timeout",
  "model_declined_required_action",
  "turn_constraints_no_valid_action",
  "turn_id_mismatch",
  "report_bug_actor_day_rate_limited",
  "report_bug_scope_rate_limited",
  "report_bug_duplicate_message",
]);
function transportReason(value: unknown): string | undefined {
  return value === undefined
    ? undefined
    : typeof value === "string" && transportReasons.has(value)
      ? value
      : "transport_diagnostic_omitted";
}

function diagnosticFacts(value: unknown): ErrorDiagnostic | undefined {
  try {
    return readErrorDiagnostic(value);
  } catch {
    return undefined;
  }
}

function summarizeLogicOps(ops: ReplayLogicOp[], maxItems: number) {
  return ops.slice(-maxItems).map((op) => {
    if (op.scope === "llm_action_provider") {
      const diagnostic = diagnosticFacts(op.output?.diagnostic);
      return {
        seq: Number.isSafeInteger(op.seq) ? op.seq : 0,
        scope: "llm_action_provider",
        op: transportOperations.has(op.op) ? op.op : "transport_diagnostic",
        actor_id:
          typeof op.actor_id === "number" && Number.isSafeInteger(op.actor_id)
            ? op.actor_id
            : undefined,
        phase: ["night", "day", "voting", "game_over"].includes(op.phase ?? "")
          ? op.phase
          : undefined,
        status: ["ok", "rejected", "fallback", "error"].includes(op.status) ? op.status : "error",
        reason: op.op === "action_provider_error" ? "runtime_error" : transportReason(op.reason),
        ...(diagnostic ? { diagnostic } : {}),
      };
    }
    return {
      seq: op.seq,
      scope: op.scope,
      op: op.op,
      actor_id: op.actor_id,
      phase: op.phase,
      status: op.status,
      reason: op.reason,
      input: safeJsonString(op.input, 200),
      output: safeJsonString(op.output, 200),
    };
  });
}

function summarizePlayerView(view: ReplayPlayerView, maxItems: number) {
  const timeline = view.timeline.slice(-maxItems).map((entry) => {
    const base: Record<string, unknown> = {
      seq: entry.seq,
      kind: entry.kind,
      day: entry.day,
      phase: entry.phase,
      stage: entry.stage,
      request_id: entry.request_id,
    };
    if (entry.kind === "event") {
      return {
        ...base,
        ...(entry.source_event_seq === undefined
          ? {}
          : { source_event_seq: entry.source_event_seq }),
        event_seq: entry.event.seq,
        event_type: entry.event.type,
        payload: safeJsonString(entry.event.payload, 240),
      };
    }
    base.turn_seq = entry.turn_seq;
    const actionSummary = entry.delta_messages.find(
      (item) => item.kind === "action_summary" && item.content,
    );
    if (actionSummary?.content) {
      try {
        const actionMode = JSON.parse(actionSummary.content)?.action_mode;
        if (actionMode) base.action_mode = actionMode;
      } catch {
        /* 畸形复盘数据由其它层作为证据处理。 */
      }
    }
    base.tool_calls = entry.delta_messages
      .filter((item) => item.kind === "tool_call")
      .map((item) => ({ name: item.name, accepted: item.accepted }));
    base.retry_trace = entry.delta_messages
      .filter((item) => ["retry_prompt", "constraint_warning", "request_error"].includes(item.kind))
      .map((item) => {
        const diagnostic = diagnosticFacts(item.diagnostic);
        return {
          attempt: item.attempt ?? 0,
          status: item.kind === "request_error" ? "request_error" : "no_valid_action",
          ...(diagnostic ? { diagnostic } : {}),
        };
      });
    const fallback = entry.delta_messages.find((item) => item.kind === "fallback" && item.content);
    if (fallback?.content) {
      try {
        const reason = JSON.parse(fallback.content)?.reason;
        if (reason) base.fallback_reason = transportReason(reason);
      } catch {
        /* 忽略畸形的可选元数据。 */
      }
    }
    return base;
  });
  return {
    player_id: view.player_id,
    role: view.role,
    camp: view.camp,
    initial_prompt: view.initial_prompt
      ? {
          day: view.initial_prompt.day,
          phase: view.initial_prompt.phase,
          stage: view.initial_prompt.stage,
          request_id: view.initial_prompt.request_id,
          prompt_system: view.initial_prompt.prompt_system
            ? truncate(view.initial_prompt.prompt_system, 200)
            : undefined,
        }
      : undefined,
    timeline,
  };
}

export function buildAuditTasks(
  input: DebugSummaryPipelineInput,
  limits: AuditPayloadLimits,
): AuditAgentTask[] {
  const locale = input.locale ?? "zh-CN";
  return [
    {
      locale,
      name: "agent_public",
      source: "replay.json",
      payload: { events: summarizePublicEvents(input.publicEvents, limits.publicMaxItems) },
    },
    {
      locale,
      name: "agent_logic",
      source: "logic_ops.json",
      payload: { ops: summarizeLogicOps(input.logicOps, limits.maxItems) },
    },
    {
      locale,
      name: "agent_reports",
      source: "debug_reports.json",
      payload: { reports: input.reports },
    },
    ...[...input.playerViews]
      .sort((a, b) => a.player_id - b.player_id)
      .map((view) => ({
        locale,
        name: `agent_player_${view.player_id}`,
        source: `players/player_${view.player_id}.json`,
        payload: { player_view: summarizePlayerView(view, limits.playerMaxItems) },
      })),
  ];
}

export function shrinkAuditPayload(payload: Record<string, unknown>): Record<string, unknown> {
  const clone = { ...payload };
  for (const field of ["events", "ops", "reports"]) {
    if (Array.isArray(clone[field])) {
      const values = clone[field] as unknown[];
      clone[field] = values.slice(-Math.max(20, Math.floor(values.length / 2)));
    }
  }
  if (clone.player_view && typeof clone.player_view === "object") {
    const view: any = { ...(clone.player_view as Record<string, unknown>) };
    if (Array.isArray(view.timeline)) {
      view.timeline = view.timeline.slice(-Math.max(30, Math.floor(view.timeline.length / 2)));
    }
    if (view.initial_prompt && typeof view.initial_prompt === "object") {
      view.initial_prompt = { ...view.initial_prompt };
      if (typeof view.initial_prompt.prompt_system === "string") {
        view.initial_prompt.prompt_system = truncate(view.initial_prompt.prompt_system, 120);
      }
    }
    clone.player_view = view;
  }
  return clone;
}

export type AuditAgentFinding = AuditFinding;
