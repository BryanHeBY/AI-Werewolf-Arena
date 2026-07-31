/**
 * 文件说明：debug_summary 并行子 agent 汇总流水线。
 */
import {
  ReplayDebugReport,
  ReplayLogicOp,
  ReplayManifest,
  ReplayPlayerView,
  ReplayPublicEvent,
} from "./types";
import { loadRuntimeConfig, resolveAgentProfileByName } from "../runtime/config/runtime_config";
import {
  AuditAgentExecutor,
  createAuditAgentExecutor,
} from "../ai/audit/audit_agent_executor";
import { AuditFinding, AuditInspectionResult } from "../ai/audit/audit_tool_protocol";

export interface DebugSummaryPipelineInput {
  manifest: ReplayManifest;
  reports: ReplayDebugReport[];
  publicEvents: ReplayPublicEvent[];
  logicOps: ReplayLogicOp[];
  playerViews: ReplayPlayerView[];
  sessionDir: string;
}

type AgentFinding = AuditFinding;

interface AgentOutput extends Omit<AuditInspectionResult, "kind"> {
  failed?: boolean;
  failure_reason?: string;
}

interface PipelineResult {
  markdown: string;
  failedAgents: string[];
}

interface AgentTask {
  name: string;
  source: string;
  payload: Record<string, unknown>;
}

const SEVERITY_RANK: Record<AgentFinding["severity"], number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
};

function truncate(text: string, maxChars: number): string {
  if (text.length <= maxChars) {
    return text;
  }
  return `${text.slice(0, maxChars)}…`;
}

function safeJsonString(value: unknown, maxChars: number): string {
  let text = "";
  try {
    const raw = JSON.stringify(value);
    text = typeof raw === "string" ? raw : "";
  } catch {
    text = "{}";
  }
  return truncate(text, maxChars);
}

function summarizePublicEvents(
  events: ReplayPublicEvent[],
  maxItems: number,
): Record<string, unknown>[] {
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
  const out: Record<string, unknown>[] = [];
  for (const e of events) {
    if (!keepTypes.has(e.type)) {
      continue;
    }
    if (e.type === "day_speech" || e.type === "last_words_spoken") {
      const text = String((e.payload as any).text ?? "");
      out.push({
        seq: e.seq,
        day: e.day,
        phase: e.phase,
        type: e.type,
        actorId: (e.payload as any).actorId,
        text: truncate(text, 160),
      });
      continue;
    }
    out.push({
      seq: e.seq,
      day: e.day,
      phase: e.phase,
      type: e.type,
      payload: e.payload,
    });
    if (out.length >= maxItems) {
      break;
    }
  }
  return out;
}

function summarizeLogicOps(ops: ReplayLogicOp[], maxItems: number): Record<string, unknown>[] {
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

function summarizePlayerView(
  view: ReplayPlayerView,
  maxItems: number,
): Record<string, unknown> {
  const timeline = view.timeline.slice(-maxItems).map((entry) => {
    const base: Record<string, unknown> = {
      seq: entry.seq,
      kind: entry.kind,
      day: entry.day,
      phase: entry.phase,
      stage: entry.stage,
      request_id: entry.request_id,
    };
    if (entry.kind === "turn") {
      base.turn_seq = entry.turn_seq;
      const actionSummary = entry.delta_messages.find(
        (item) => item.kind === "action_summary" && item.content,
      );
      if (actionSummary?.content) {
        try {
          const parsed = JSON.parse(actionSummary.content) as {
            action_mode?: string;
          };
          if (parsed.action_mode) {
            base.action_mode = parsed.action_mode;
          }
        } catch {
          // ignore malformed summary payloads
        }
      }
      base.tool_calls = entry.delta_messages
        .filter((item) => item.kind === "tool_call")
        .map((item) => ({
          name: item.name,
          accepted: item.accepted,
        }));
      base.retry_trace = entry.delta_messages
        .filter(
          (item) =>
            item.kind === "retry_prompt" ||
            item.kind === "constraint_warning" ||
            item.kind === "request_error",
        )
        .map((item) => ({
          attempt: item.attempt ?? 0,
          status: item.kind === "request_error" ? "request_error" : "no_valid_action",
        }));
      const fallbackMessage = entry.delta_messages.find(
        (item) => item.kind === "fallback" && item.content,
      );
      if (fallbackMessage?.content) {
        try {
          const parsed = JSON.parse(fallbackMessage.content) as { reason?: string };
          if (parsed.reason) {
            base.fallback_reason = parsed.reason;
          }
        } catch {
          // ignore malformed fallback payloads
        }
      }
      return base;
    }
    base.event_seq = entry.event.seq;
    base.event_type = entry.event.type;
    base.payload = safeJsonString(entry.event.payload, 240);
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

function shrinkPayload(payload: Record<string, unknown>): Record<string, unknown> {
  const clone: Record<string, unknown> = Array.isArray(payload)
    ? { items: payload }
    : { ...payload };

  if (Array.isArray(clone.events)) {
    const events = clone.events as unknown[];
    const next = events.slice(-Math.max(20, Math.floor(events.length / 2)));
    clone.events = next;
  }
  if (Array.isArray(clone.ops)) {
    const ops = clone.ops as unknown[];
    const next = ops.slice(-Math.max(20, Math.floor(ops.length / 2)));
    clone.ops = next;
  }
  if (Array.isArray(clone.reports)) {
    const reports = clone.reports as unknown[];
    const next = reports.slice(-Math.max(20, Math.floor(reports.length / 2)));
    clone.reports = next;
  }
  if (clone.player_view && typeof clone.player_view === "object") {
    const view: any = { ...(clone.player_view as Record<string, unknown>) };
    if (Array.isArray(view.timeline)) {
      const timeline = view.timeline as unknown[];
      view.timeline = timeline.slice(-Math.max(30, Math.floor(timeline.length / 2)));
    }
    if (view.initial_prompt && typeof view.initial_prompt === "object") {
      const prompt = { ...(view.initial_prompt as Record<string, unknown>) };
      if (typeof prompt.prompt_system === "string") {
        prompt.prompt_system = truncate(prompt.prompt_system, 120);
      }
      view.initial_prompt = prompt;
    }
    clone.player_view = view;
  }

  return clone;
}

async function runAgentTask(
  executor: AuditAgentExecutor,
  sessionId: string,
  task: AgentTask,
  timeoutMs: number,
  maxAttempts: number,
): Promise<AgentOutput> {
  let payload = task.payload;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const result = await executor.runTurn(
        { mode: "inspect", taskName: task.name, source: task.source, payload },
        { timeoutMs },
      );
      if (result?.kind === "findings") {
        return result;
      }
      console.warn(
        `[debug_summary] agent_rejected_reason=no_tool_submission session_id=${sessionId} agent=${task.name} attempt=${attempt}/${maxAttempts}`,
      );
      payload = shrinkPayload(payload);
      continue;
    } catch (error) {
      console.warn(
        `[debug_summary] agent_rejected_reason=request_error session_id=${sessionId} agent=${task.name} attempt=${attempt}/${maxAttempts} error=${String(error)}`,
      );
    }
  }
  return {
    agent: task.name,
    findings: [],
    notes: [],
    missing_info: ["agent_failed"],
    failed: true,
    failure_reason: "exhausted_attempts",
  };
}

async function runWithConcurrency<T>(
  tasks: Array<() => Promise<T>>,
  concurrency: number,
): Promise<T[]> {
  const results: T[] = [];
  let index = 0;

  async function worker() {
    while (index < tasks.length) {
      const current = index;
      index += 1;
      results[current] = await tasks[current]();
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, tasks.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

function mergeFindings(outputs: AgentOutput[]): {
  findings: AgentFinding[];
  failedAgents: string[];
  missingInfo: string[];
  totalAgents: number;
} {
  const dedup = new Map<string, AgentFinding>();
  const failedAgents: string[] = [];
  const missingInfo: string[] = [];

  for (const output of outputs) {
    if (output.failed) {
      failedAgents.push(output.agent);
      if (output.failure_reason) {
        missingInfo.push(`${output.agent}: ${output.failure_reason}`);
      }
    }
    for (const item of output.findings) {
      const evidenceKey = Array.isArray(item.evidence) ? item.evidence.join(",") : "";
      const key = `${item.category}|${item.message}|${evidenceKey}`;
      if (!dedup.has(key)) {
        dedup.set(key, item);
      }
    }
    for (const note of output.missing_info) {
      missingInfo.push(`${output.agent}: ${note}`);
    }
  }

  const findings = Array.from(dedup.values()).sort((a, b) => {
    const rankDiff = SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity];
    if (rankDiff !== 0) {
      return rankDiff;
    }
    const aEv = a.evidence[0] ?? 0;
    const bEv = b.evidence[0] ?? 0;
    return aEv - bEv;
  });

  return { findings, failedAgents, missingInfo, totalAgents: outputs.length };
}

function buildMergedFallbackSummary(
  manifest: ReplayManifest,
  reports: ReplayDebugReport[],
  findings: AgentFinding[],
  failedAgents: string[],
  missingInfo: string[],
  totalAgents: number,
): string {
  const counts = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
  } as Record<string, number>;
  for (const report of reports) {
    counts[report.severity] = (counts[report.severity] ?? 0) + 1;
  }

  const lines: string[] = [
    `# Debug Summary (${manifest.session_id})`,
    "",
    "## Session",
    `- board: ${manifest.board}`,
    `- winner: ${manifest.winner ?? "none"}`,
    `- finish_reason: ${manifest.finish_reason}`,
    `- started_at: ${manifest.started_at}`,
    `- ended_at: ${manifest.ended_at}`,
    "",
    "## Bug Report Stats",
    `- total: ${reports.length}`,
    `- critical: ${counts.critical}`,
    `- high: ${counts.high}`,
    `- medium: ${counts.medium}`,
    `- low: ${counts.low}`,
    "",
    "## Findings",
  ];

  if (findings.length === 0) {
    lines.push("- none");
  } else {
    for (const report of findings) {
      const evidence = report.evidence.length > 0 ? ` evidence=${report.evidence.join(",")}` : "";
      lines.push(
        `- [${report.severity.toUpperCase()}][${report.category}] ${report.message}${evidence} (source=${report.source})`,
      );
    }
  }

  lines.push("");
  if (findings.length > 0) {
    lines.push("## TODO");
    findings.forEach((report, idx) => {
      lines.push(`- [ ] [P${idx + 1}] 排查 ${report.category} 问题：${report.message}`);
    });
  } else {
    lines.push("## Conclusion", "- 本局未发现可执行问题，无需新增调试任务。");
  }

  lines.push("", "## Debug Pipeline");
  lines.push(`- agents_total: ${totalAgents}`);
  lines.push(`- agents_failed: ${failedAgents.length}`);
  if (failedAgents.length > 0) {
    lines.push(`- failed_list: ${failedAgents.join(", ")}`);
  }
  if (missingInfo.length > 0) {
    lines.push("- missing_info:");
    for (const note of missingInfo) {
      lines.push(`- ${note}`);
    }
  }

  return lines.join("\n");
}

function collectEvidenceSeqs(input: DebugSummaryPipelineInput): Set<number> {
  const seqs = new Set<number>();
  for (const event of input.publicEvents) {
    if (typeof event.seq === "number") {
      seqs.add(event.seq);
    }
  }
  for (const op of input.logicOps) {
    if (typeof op.seq === "number") {
      seqs.add(op.seq);
    }
  }
  for (const view of input.playerViews) {
    for (const entry of view.timeline) {
      if (typeof entry.seq === "number") {
        seqs.add(entry.seq);
      }
    }
  }
  return seqs;
}

function filterFindingsByEvidence(
  findings: AgentFinding[],
  allowedSeqs: Set<number>,
): { findings: AgentFinding[]; dropped: string[] } {
  const kept: AgentFinding[] = [];
  const dropped: string[] = [];
  for (const item of findings) {
    if (!Array.isArray(item.evidence) || item.evidence.length === 0) {
      dropped.push(`[no_evidence] ${item.message}`);
      continue;
    }
    const invalid = item.evidence.filter((seq) => !allowedSeqs.has(seq));
    if (invalid.length > 0) {
      dropped.push(`[invalid_evidence] ${item.message} evidence=${invalid.join(",")}`);
      continue;
    }
    kept.push(item);
  }
  return { findings: kept, dropped };
}

function validateSummaryEvidence(text: string, allowedSeqs: Set<number>): boolean {
  const lines = text.split("\n");
  const findingsStart = lines.findIndex((line) => /^##\s+Findings\b/.test(line));
  if (findingsStart < 0) {
    return false;
  }
  let idx = findingsStart + 1;
  while (idx < lines.length && !/^##\s+/.test(lines[idx])) {
    const line = lines[idx].trim();
    if (line.startsWith("-")) {
      if (/^-+\s*(none|无)\b/i.test(line)) {
        idx += 1;
        continue;
      }
      const match = line.match(/evidence=([0-9, ]+)/i);
      if (!match) {
        return false;
      }
      const seqs = match[1]
        .split(",")
        .map((v) => Number(v.trim()))
        .filter((v) => !Number.isNaN(v));
      if (seqs.length === 0) {
        return false;
      }
      for (const seq of seqs) {
        if (!allowedSeqs.has(seq)) {
          return false;
        }
      }
    }
    idx += 1;
  }
  return true;
}

async function renderSummaryWithAgent(
  executor: AuditAgentExecutor,
  manifest: ReplayManifest,
  reports: ReplayDebugReport[],
  findings: AgentFinding[],
  failedAgents: string[],
  missingInfo: string[],
  timeoutMs: number,
  allowedSeqs: Set<number>,
): Promise<string | null> {
  try {
    const payload = {
      session: {
        session_id: manifest.session_id,
        board: manifest.board,
        winner: manifest.winner ?? "none",
        finish_reason: manifest.finish_reason,
        started_at: manifest.started_at,
        ended_at: manifest.ended_at,
      },
      report_stats: {
        total: reports.length,
        critical: reports.filter((r) => r.severity === "critical").length,
        high: reports.filter((r) => r.severity === "high").length,
        medium: reports.filter((r) => r.severity === "medium").length,
        low: reports.filter((r) => r.severity === "low").length,
      },
      findings,
      pipeline: {
        failed_agents: failedAgents,
        missing_info: missingInfo,
      },
    };

    const result = await executor.runTurn(
      {
        mode: "summarize",
        taskName: "agent_summary",
        source: "merged_findings",
        payload,
      },
      { timeoutMs },
    );
    if (result?.kind !== "summary") {
      return null;
    }
    const trimmed = result.markdown.trim();
    if (!trimmed.length) {
      return null;
    }
    if (!validateSummaryEvidence(trimmed, allowedSeqs)) {
      return null;
    }
    return trimmed;
  } catch {
    return null;
  }
}

export async function buildDebugSummaryWithAgents(
  input: DebugSummaryPipelineInput,
): Promise<PipelineResult | null> {
  // 没有结构化上报时不启用并行子 agent，避免在低证据条件下放大误报。
  if (input.reports.length === 0) {
    return null;
  }

  const runtime = await loadRuntimeConfig();
  const debugAgentProfile = resolveAgentProfileByName(
    runtime,
    runtime.debugSummary?.agent?.agentName ?? runtime.game?.debugSummaryAgent ?? runtime.game?.agent,
  );
  if (runtime.debugSummary?.agent?.enabled === false) {
    return null;
  }

  const timeoutMs = runtime.debugSummary?.agent?.timeoutMs ?? 15000;
  const maxAttempts = Math.max(1, runtime.debugSummary?.agent?.maxAttempts ?? 2);
  const concurrency = Math.max(1, runtime.debugSummary?.agent?.concurrency ?? 4);
  const publicMaxItems = Math.max(60, runtime.debugSummary?.agent?.publicMaxItems ?? 200);
  const maxItems = Math.max(50, runtime.debugSummary?.agent?.maxItems ?? 200);
  const playerMaxItems = Math.max(60, runtime.debugSummary?.agent?.playerMaxItems ?? 120);
  const profileOverride = runtime.debugSummary?.agent?.profile ?? {};

  const executor = createAuditAgentExecutor({
    profile: debugAgentProfile,
    workspaceRoot: `${input.sessionDir}/audit-workspaces`,
    llmOverride: profileOverride,
  });
  if (!executor) return null;

  const tasks: AgentTask[] = [];
  tasks.push({
    name: "agent_public",
    source: "public_timeline.json",
    payload: { events: summarizePublicEvents(input.publicEvents, publicMaxItems) },
  });
  tasks.push({
    name: "agent_logic",
    source: "logic_ops.json",
    payload: { ops: summarizeLogicOps(input.logicOps, maxItems) },
  });
  tasks.push({
    name: "agent_reports",
    source: "debug_reports.json",
    payload: { reports: input.reports },
  });
  for (const view of input.playerViews.sort((a, b) => a.player_id - b.player_id)) {
    tasks.push({
      name: `agent_player_${view.player_id}`,
      source: `players/player_${view.player_id}.json`,
      payload: { player_view: summarizePlayerView(view, playerMaxItems) },
    });
  }

  const results = await runWithConcurrency(
    tasks.map((task) => async () => {
      const output = await runAgentTask(
        executor,
        input.manifest.session_id,
        task,
        timeoutMs,
        maxAttempts,
      );
      return output;
    }),
    concurrency,
  );

  const merged = mergeFindings(results);
  const allowedSeqs = collectEvidenceSeqs(input);
  const filtered = filterFindingsByEvidence(merged.findings, allowedSeqs);
  if (filtered.dropped.length > 0) {
    merged.missingInfo.push(...filtered.dropped.map((note) => `dropped: ${note}`));
  }
  const summaryLlm = await renderSummaryWithAgent(
    executor,
    input.manifest,
    input.reports,
    filtered.findings,
    merged.failedAgents,
    merged.missingInfo,
    timeoutMs,
    allowedSeqs,
  );
  const markdown = summaryLlm
    ? summaryLlm
    : buildMergedFallbackSummary(
        input.manifest,
        input.reports,
        filtered.findings,
        merged.failedAgents,
        merged.missingInfo,
        merged.totalAgents,
      );

  await executor.close();
  return { markdown, failedAgents: merged.failedAgents };
}
