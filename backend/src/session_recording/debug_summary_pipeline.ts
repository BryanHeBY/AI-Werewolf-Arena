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
import { OpenAIClient } from "../infra/llm/openai_client";
import { loadRuntimeConfig } from "../config/runtime_config";

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
    "evidence 必须是 payload 中存在的 seq 列表，严禁杜撰。",
    "输出要求：最多 5 条 findings，notes 最多 3 条，missing_info 最多 3 条。",
    "不要复述 payload_json 原文，不要输出长段落。",
    "总输出控制在 800 字以内。",
    "仅输出一个 JSON 对象，不要输出数组或多段文本。",
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
    findings: findings.slice(0, 5),
    notes: Array.isArray(raw?.notes) ? raw.notes.map((v: any) => String(v)).slice(0, 3) : [],
    missing_info: Array.isArray(raw?.missing_info)
      ? raw.missing_info.map((v: any) => String(v)).slice(0, 3)
      : [],
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
  primaryClient: OpenAIClient,
  fallbackClient: OpenAIClient,
  primaryMeta: {
    model: string;
    maxTokens: number;
    forceJsonResponse: boolean;
    reasoningEnabled: boolean;
    reasoningEffort: string;
  },
  fallbackMeta: {
    model: string;
    maxTokens: number;
    forceJsonResponse: boolean;
    reasoningEnabled: boolean;
    reasoningEffort: string;
  },
  sessionId: string,
  task: AgentTask,
  timeoutMs: number,
  maxAttempts: number,
): Promise<AgentOutput> {
  let payload = task.payload;
  let useFallback = false;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const client = useFallback ? fallbackClient : primaryClient;
      const meta = useFallback ? fallbackMeta : primaryMeta;
      const systemPrompt = buildAgentSystemPrompt();
      const userPrompt = buildAgentUserPrompt(task.name, payload);
      const result = await client.chatWithMeta(
        [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        { signal: controller.signal },
      );
      const text = stripJsonFences(result.content);
      let parsed: any = null;
      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = null;
      }
      if (parsed) {
        const normalized = normalizeAgentOutput(parsed, task.name, task.source);
        return normalized;
      }
      console.warn(
        `[debug_summary] llm_rejected_reason=finish_reason=${result.finishReason || "unknown"} session_id=${sessionId} agent=${task.name} attempt=${attempt}/${maxAttempts}`,
      );
      if (result.finishReason === "length") {
        payload = shrinkPayload(payload);
        useFallback = true;
      }
      continue;
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

async function renderSummaryWithLlm(
  client: OpenAIClient,
  manifest: ReplayManifest,
  reports: ReplayDebugReport[],
  findings: AgentFinding[],
  failedAgents: string[],
  missingInfo: string[],
  timeoutMs: number,
  allowedSeqs: Set<number>,
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
            "你是狼人杀对局调试汇总助手。请输出 Markdown，包含 Session、Bug Report Stats、Findings、TODO/Conclusion、Debug Pipeline 五个章节。Findings 每条必须包含 evidence=1,2 这样的证据序号列表，且 evidence 只能来自提供的 findings.evidence。禁止输出 JSON。",
        },
        { role: "user", content: JSON.stringify(payload) },
      ],
      { signal: controller.signal },
    );
    if (result.finishReason !== "stop") {
      return null;
    }
    const trimmed = result.content.trim();
    if (!trimmed.length) {
      return null;
    }
    if (!validateSummaryEvidence(trimmed, allowedSeqs)) {
      return null;
    }
    return trimmed;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function buildDebugSummaryWithAgents(
  input: DebugSummaryPipelineInput,
): Promise<PipelineResult | null> {
  const runtime = await loadRuntimeConfig();
  const provider = runtime.provider;
  const agentDefaults = runtime.agent?.default;
  if (!provider?.apiKey || !agentDefaults?.model) {
    return null;
  }

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

  const client = new OpenAIClient({
    apiKey: provider.apiKey,
    model: profileOverride.model ?? agentDefaults.model,
    baseURL: provider.baseURL,
    userAgent: provider.userAgent,
    temperature: profileOverride.temperature ?? agentDefaults.temperature ?? 0.1,
    maxTokens: profileOverride.maxTokens ?? agentDefaults.maxTokens ?? 1200,
    forceJsonResponse:
      profileOverride.forceJsonResponse ?? agentDefaults.forceJsonResponse ?? true,
    reasoningEnabled:
      profileOverride.reasoningEnabled ?? agentDefaults.reasoningEnabled ?? true,
    reasoningEffort:
      profileOverride.reasoningEffort ?? agentDefaults.reasoningEffort ?? "medium",
  });
  const fallbackClient = new OpenAIClient({
    apiKey: provider.apiKey,
    model: profileOverride.model ?? agentDefaults.model,
    baseURL: provider.baseURL,
    userAgent: provider.userAgent,
    temperature: profileOverride.temperature ?? agentDefaults.temperature ?? 0.1,
    maxTokens: profileOverride.maxTokens ?? agentDefaults.maxTokens ?? 1200,
    forceJsonResponse:
      profileOverride.forceJsonResponse ?? agentDefaults.forceJsonResponse ?? true,
    reasoningEnabled:
      profileOverride.reasoningEnabled ?? agentDefaults.reasoningEnabled ?? true,
    reasoningEffort:
      profileOverride.reasoningEffort ?? agentDefaults.reasoningEffort ?? "medium",
  });
  const primaryMeta = {
    model: profileOverride.model ?? agentDefaults.model,
    maxTokens: profileOverride.maxTokens ?? agentDefaults.maxTokens ?? 1200,
    forceJsonResponse:
      profileOverride.forceJsonResponse ?? agentDefaults.forceJsonResponse ?? true,
    reasoningEnabled:
      profileOverride.reasoningEnabled ?? agentDefaults.reasoningEnabled ?? true,
    reasoningEffort:
      profileOverride.reasoningEffort ?? agentDefaults.reasoningEffort ?? "medium",
  };
  const fallbackMeta = {
    model: profileOverride.model ?? agentDefaults.model,
    maxTokens: profileOverride.maxTokens ?? agentDefaults.maxTokens ?? 1200,
    forceJsonResponse:
      profileOverride.forceJsonResponse ?? agentDefaults.forceJsonResponse ?? true,
    reasoningEnabled:
      profileOverride.reasoningEnabled ?? agentDefaults.reasoningEnabled ?? true,
    reasoningEffort:
      profileOverride.reasoningEffort ?? agentDefaults.reasoningEffort ?? "medium",
  };

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
        client,
        fallbackClient,
        primaryMeta,
        fallbackMeta,
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
  const summaryLlm = await renderSummaryWithLlm(
    client,
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

  return { markdown, failedAgents: merged.failedAgents };
}
