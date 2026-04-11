/**
 * 文件说明：debug_summary 并行子 agent 汇总流水线。
 */
import { promises as fs } from "fs";
import path from "path";
import {
  ReplayDebugReport,
  ReplayLogicOp,
  ReplayManifest,
  ReplayPlayerView,
  ReplayPublicEvent,
} from "./types";
import { OpenAIClient } from "../infra/llm/openai_client";

export interface DebugSummaryPipelineInput {
  manifest: ReplayManifest;
  reports: ReplayDebugReport[];
  publicEvents: ReplayPublicEvent[];
  logicOps: ReplayLogicOp[];
  playerViews: ReplayPlayerView[];
  sessionDir: string;
}

interface AgentFinding {
  severity: "low" | "medium" | "high" | "critical";
  category: "flow" | "rule" | "state" | "logging" | "other";
  message: string;
  evidence: number[];
  source: string;
}

interface AgentOutput {
  agent: string;
  findings: AgentFinding[];
  notes: string[];
  missing_info: string[];
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
    text = JSON.stringify(value);
  } catch {
    text = "{}";
  }
  return truncate(text, maxChars);
}

function summarizePublicEvents(events: ReplayPublicEvent[]): Record<string, unknown>[] {
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
  }
  return out;
}

function summarizeLogicOps(ops: ReplayLogicOp[]): Record<string, unknown>[] {
  const maxItems = Math.max(50, Number(process.env.DEBUG_SUMMARY_AGENT_MAX_ITEMS ?? "300"));
  return ops.slice(-maxItems).map((op) => ({
    seq: op.seq,
    scope: op.scope,
    op: op.op,
    actor_id: op.actor_id,
    phase: op.phase,
    status: op.status,
    reason: op.reason,
    input: op.input,
    output: op.output,
  }));
}

function summarizePlayerView(view: ReplayPlayerView): Record<string, unknown> {
  const maxItems = Math.max(60, Number(process.env.DEBUG_SUMMARY_AGENT_PLAYER_MAX_ITEMS ?? "200"));
  const timeline = view.timeline.slice(-maxItems).map((entry) => {
    const base: Record<string, unknown> = {
      seq: entry.seq,
      kind: entry.kind,
      day: entry.day,
      phase: entry.phase,
      stage: entry.stage,
      request_id: entry.request_id,
    };
    if ((entry as any).role) {
      base.role = (entry as any).role;
    }
    if ((entry as any).content) {
      base.content = truncate(String((entry as any).content), 200);
    }
    if ((entry as any).name) {
      base.name = String((entry as any).name);
    }
    if ((entry as any).args) {
      base.args = safeJsonString((entry as any).args, 200);
    }
    if ((entry as any).accepted !== undefined) {
      base.accepted = (entry as any).accepted;
    }
    if ((entry as any).result !== undefined) {
      base.result = safeJsonString((entry as any).result, 200);
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

function buildAgentSystemPrompt(): string {
  return [
    "你是狼人杀对局调试子代理。",
    "请仅输出 JSON，禁止输出 Markdown、解释或多余文字。",
    "JSON 必须包含字段：agent, findings, notes, missing_info。",
    "findings 为数组，元素包含 severity/category/message/evidence/source。",
    "severity: low|medium|high|critical；category: flow|rule|state|logging|other。",
  ].join("\n");
}

function buildAgentUserPrompt(agentName: string, payload: Record<string, unknown>): string {
  return [
    `agent: ${agentName}`,
    `payload_json: ${JSON.stringify(payload)}`,
  ].join("\n");
}

function stripJsonFences(text: string): string {
  const trimmed = text.trim();
  if (trimmed.startsWith("```")) {
    return trimmed.replace(/^```[a-zA-Z]*\n?/, "").replace(/```$/, "").trim();
  }
  return trimmed;
}

function normalizeAgentOutput(raw: any, agentName: string, source: string): AgentOutput {
  const findings: AgentFinding[] = Array.isArray(raw?.findings)
    ? raw.findings
        .filter((item: any) => item && typeof item === "object")
        .map((item: any) => ({
          severity: item.severity ?? "low",
          category: item.category ?? "other",
          message: String(item.message ?? ""),
          evidence: Array.isArray(item.evidence)
            ? item.evidence.map((v: any) => Number(v)).filter((v: number) => !Number.isNaN(v))
            : [],
          source: String(item.source ?? source),
        }))
    : [];

  return {
    agent: String(raw?.agent ?? agentName),
    findings,
    notes: Array.isArray(raw?.notes) ? raw.notes.map((v: any) => String(v)) : [],
    missing_info: Array.isArray(raw?.missing_info)
      ? raw.missing_info.map((v: any) => String(v))
      : [],
  };
}

async function runAgentTask(
  client: OpenAIClient,
  sessionId: string,
  task: AgentTask,
  timeoutMs: number,
  maxAttempts: number,
): Promise<AgentOutput> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const result = await client.chatWithMeta(
        [
          { role: "system", content: buildAgentSystemPrompt() },
          { role: "user", content: buildAgentUserPrompt(task.name, task.payload) },
        ],
        { signal: controller.signal },
      );
      if (result.finishReason !== "stop") {
        console.warn(
          `[debug_summary] llm_rejected_reason=finish_reason=${result.finishReason || "unknown"} session_id=${sessionId} agent=${task.name} attempt=${attempt}/${maxAttempts}`,
        );
        continue;
      }
      const text = stripJsonFences(result.content);
      const parsed = JSON.parse(text);
      return normalizeAgentOutput(parsed, task.name, task.source);
    } catch (error) {
      console.warn(
        `[debug_summary] llm_rejected_reason=request_error session_id=${sessionId} agent=${task.name} attempt=${attempt}/${maxAttempts} error=${String(error)}`,
      );
    } finally {
      clearTimeout(timer);
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

async function renderSummaryWithLlm(
  client: OpenAIClient,
  manifest: ReplayManifest,
  reports: ReplayDebugReport[],
  findings: AgentFinding[],
  failedAgents: string[],
  missingInfo: string[],
  timeoutMs: number,
): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
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

    const result = await client.chatWithMeta(
      [
        {
          role: "system",
          content:
            "你是狼人杀对局调试汇总助手。请输出 Markdown，包含 Session、Bug Report Stats、Findings、TODO/Conclusion、Debug Pipeline 五个章节。禁止输出 JSON。",
        },
        { role: "user", content: JSON.stringify(payload) },
      ],
      { signal: controller.signal },
    );
    if (result.finishReason !== "stop") {
      return null;
    }
    const trimmed = result.content.trim();
    return trimmed.length > 0 ? trimmed : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function buildDebugSummaryWithAgents(
  input: DebugSummaryPipelineInput,
): Promise<PipelineResult | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL;
  if (!apiKey || !model) {
    return null;
  }

  if (String(process.env.DEBUG_SUMMARY_AGENT_ENABLED ?? "true") === "false") {
    return null;
  }

  const agentsDir = path.join(input.sessionDir, "debug_summary_agents");
  await fs.mkdir(agentsDir, { recursive: true });

  const timeoutMs = Number(process.env.DEBUG_SUMMARY_AGENT_TIMEOUT_MS ?? "15000");
  const maxAttempts = Math.max(1, Number(process.env.DEBUG_SUMMARY_AGENT_MAX_ATTEMPTS ?? "2"));
  const concurrency = Math.max(1, Number(process.env.DEBUG_SUMMARY_AGENT_CONCURRENCY ?? "4"));

  const client = new OpenAIClient({
    apiKey,
    model,
    baseURL: process.env.OPENAI_BASE_URL,
    temperature: 0.1,
    maxTokens: 1200,
    forceJsonResponse: false,
  });

  const tasks: AgentTask[] = [];
  tasks.push({
    name: "agent_public",
    source: "public_timeline.json",
    payload: { events: summarizePublicEvents(input.publicEvents) },
  });
  tasks.push({
    name: "agent_logic",
    source: "logic_ops.json",
    payload: { ops: summarizeLogicOps(input.logicOps) },
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
      payload: { player_view: summarizePlayerView(view) },
    });
  }

  const results = await runWithConcurrency(
    tasks.map((task) => async () => {
      const output = await runAgentTask(
        client,
        input.manifest.session_id,
        task,
        timeoutMs,
        maxAttempts,
      );
      const outputWithMeta = {
        ...output,
        source: task.source,
      };
      const filePath = path.join(agentsDir, `${task.name}.json`);
      await fs.writeFile(filePath, JSON.stringify(outputWithMeta, null, 2), "utf-8");
      return output;
    }),
    concurrency,
  );

  const merged = mergeFindings(results);
  const summaryLlm = await renderSummaryWithLlm(
    client,
    input.manifest,
    input.reports,
    merged.findings,
    merged.failedAgents,
    merged.missingInfo,
    timeoutMs,
  );
  const markdown = summaryLlm
    ? summaryLlm
    : buildMergedFallbackSummary(
        input.manifest,
        input.reports,
        merged.findings,
        merged.failedAgents,
        merged.missingInfo,
        merged.totalAgents,
      );

  return { markdown, failedAgents: merged.failedAgents };
}
