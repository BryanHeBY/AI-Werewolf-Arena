import { AuditFinding, AuditInspectionResult } from "../ai/audit/audit_tool_protocol";
import type { DebugSummaryPipelineInput } from "./debug_summary_pipeline";
import { ReplayLogicOp, ReplayPlayerView, ReplayPublicEvent } from "./types";

export interface AuditAgentTask {
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
    "phase_changed", "night_resolved", "wolf_self_destruct",
    "sheriff_nomination_summary", "sheriff_vote_summary", "sheriff_elected",
    "voted_out", "idiot_revealed", "last_words_spoken", "witch_potion_used",
    "witch_potion_skipped", "day_speech",
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
        actorId: (event.payload as any).actorId,
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

function summarizeLogicOps(ops: ReplayLogicOp[], maxItems: number) {
  return ops.slice(-maxItems).map((op) => ({
    seq: op.seq,
    scope: op.scope,
    op: op.op,
    actor_id: op.actor_id,
    phase: op.phase,
    status: op.status,
    reason: op.reason,
    input: safeJsonString(op.input, 200),
    output: safeJsonString(op.output, 200),
  }));
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
      } catch { /* malformed replay data is evidence for another layer */ }
    }
    base.tool_calls = entry.delta_messages
      .filter((item) => item.kind === "tool_call")
      .map((item) => ({ name: item.name, accepted: item.accepted }));
    base.retry_trace = entry.delta_messages
      .filter((item) => ["retry_prompt", "constraint_warning", "request_error"].includes(item.kind))
      .map((item) => ({
        attempt: item.attempt ?? 0,
        status: item.kind === "request_error" ? "request_error" : "no_valid_action",
      }));
    const fallback = entry.delta_messages.find(
      (item) => item.kind === "fallback" && item.content,
    );
    if (fallback?.content) {
      try {
        const reason = JSON.parse(fallback.content)?.reason;
        if (reason) base.fallback_reason = reason;
      } catch { /* ignore malformed optional metadata */ }
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
  return [
    {
      name: "agent_public",
      source: "public_timeline.json",
      payload: { events: summarizePublicEvents(input.publicEvents, limits.publicMaxItems) },
    },
    {
      name: "agent_logic",
      source: "logic_ops.json",
      payload: { ops: summarizeLogicOps(input.logicOps, limits.maxItems) },
    },
    {
      name: "agent_reports",
      source: "debug_reports.json",
      payload: { reports: input.reports },
    },
    ...[...input.playerViews]
      .sort((a, b) => a.player_id - b.player_id)
      .map((view) => ({
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
