/** 文件说明：根据调试上报生成 session 级调试总结 Markdown。 */
import { ReplayDebugReport, ReplayLogicOp, ReplayManifest, ReplayPlayerView, ReplayPublicEvent } from "./types";
import { OpenAIClient } from "../infra/llm/openai_client";
import { loadRuntimeConfig, resolveAgentProfileByName } from "../config/runtime_config";
import { buildDebugSummaryWithAgents } from "./debug_summary_pipeline";

interface BuildDebugSummaryInput {
  manifest: ReplayManifest;
  reports: ReplayDebugReport[];
  publicEvents?: ReplayPublicEvent[];
  logicOps?: ReplayLogicOp[];
  playerViews?: ReplayPlayerView[];
  sessionDir?: string;
}

interface SummaryObservation {
  title: string;
  detail: string;
  evidence?: number[];
}

function countBySeverity(reports: ReplayDebugReport[]): Record<string, number> {
  const out: Record<string, number> = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
  };
  for (const report of reports) {
    out[report.severity] = (out[report.severity] ?? 0) + 1;
  }
  return out;
}

function collectObservations(input: BuildDebugSummaryInput): SummaryObservation[] {
  const events = input.publicEvents ?? [];
  const ops = input.logicOps ?? [];
  const views = input.playerViews ?? [];
  const observations: SummaryObservation[] = [];

  const timelineEntries = views.reduce((acc, view) => acc + view.timeline.length, 0);
  const selfDestructCount = events.filter((e) => e.type === "wolf_self_destruct").length;
  const hunterShotCount = events.filter((e) => e.type === "hunter_shot").length;
  const nightResolvedCount = events.filter((e) => e.type === "night_resolved").length;

  const mismatchSeqs: number[] = [];
  const invalidDaySeqs: number[] = [];
  let fallbackCount = 0;
  let toolRejectedCount = 0;
  for (const view of views) {
    for (const entry of view.timeline) {
      if (
        entry.kind === "llm_message" ||
        entry.kind === "tool_call" ||
        entry.kind === "text_action" ||
        entry.kind === "fallback"
      ) {
        if (typeof entry.day !== "number" || entry.day <= 0) {
          invalidDaySeqs.push(entry.seq);
        }
        const requestId = String(entry.request_id ?? "");
        const match = requestId.match(/^(\d+)-([a-z_]+)-/i);
        if (match) {
          const reqDay = Number(match[1]);
          const reqPhase = match[2];
          if (reqDay !== entry.day || reqPhase !== entry.phase) {
            mismatchSeqs.push(entry.seq);
          }
        }
      }
      if (entry.kind === "fallback") {
        fallbackCount += 1;
      }
      if (
        entry.kind === "llm_message" &&
        entry.role === "assistant" &&
        /tool_not_allowed_in_this_turn|invalid_tool_arguments/.test(entry.content)
      ) {
        toolRejectedCount += 1;
      }
      if (
        entry.kind === "tool_call" &&
        entry.accepted === false
      ) {
        toolRejectedCount += 1;
      }
    }
  }

  observations.push({
    title: "对局事件规模",
    detail: `public_events=${events.length}, logic_ops=${ops.length}, player_views=${views.length}, timeline_entries=${timelineEntries}`,
  });
  observations.push({
    title: "关键流程计数",
    detail: `night_resolved=${nightResolvedCount}, wolf_self_destruct=${selfDestructCount}, hunter_shot=${hunterShotCount}`,
  });
  observations.push({
    title: "动作稳定性",
    detail: `tool_rejected=${toolRejectedCount}, fallback=${fallbackCount}`,
  });

  if (invalidDaySeqs.length > 0) {
    observations.push({
      title: "元数据异常",
      detail: `发现 day<=0 的行动条目 ${invalidDaySeqs.length} 条`,
      evidence: invalidDaySeqs.slice(0, 10),
    });
  }
  if (mismatchSeqs.length > 0) {
    observations.push({
      title: "请求编号异常",
      detail: `发现 request_id 与 day/phase 不一致条目 ${mismatchSeqs.length} 条`,
      evidence: mismatchSeqs.slice(0, 10),
    });
  }

  return observations;
}

function buildFallbackSummary(input: BuildDebugSummaryInput): string {
  const { manifest, reports } = input;
  const actionableReports = filterActionableReports(
    reports,
    input.publicEvents ?? [],
  );
  const autoFindings = scanEventsForPotentialIssues(input);
  const metadataFindings = scanPlayerTimelineMetadataIssues(input.playerViews ?? []);
  const allFindings = [
    ...actionableReports.map((r) => ({
      severity: r.severity,
      category: r.category,
      day: r.day,
      phase: r.phase,
      actorId: r.actor_id,
      message: r.message,
      evidence: Array.isArray(r.evidence_event_seq) ? r.evidence_event_seq : [],
    })),
    ...autoFindings,
    ...metadataFindings,
  ];
  const observations = collectObservations(input);
  const counts = countBySeverity(reports);
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
    `- actionable: ${actionableReports.length}`,
    `- critical: ${counts.critical}`,
    `- high: ${counts.high}`,
    `- medium: ${counts.medium}`,
    `- low: ${counts.low}`,
    "",
    "## Findings",
  ];

  if (allFindings.length === 0) {
    lines.push("- none");
  } else {
    for (const report of allFindings) {
      const evidence =
        report.evidence.length > 0
          ? ` evidence=${report.evidence.join(",")}`
          : "";
      lines.push(
        `- [${report.severity.toUpperCase()}][${report.category}] day=${report.day} phase=${report.phase} actor=${report.actorId}: ${report.message}${evidence}`,
      );
    }
  }

  lines.push("", "## Observations");
  if (observations.length === 0) {
    lines.push("- none");
  } else {
    for (const obs of observations) {
      const evidence =
        obs.evidence && obs.evidence.length > 0
          ? ` evidence=${obs.evidence.join(",")}`
          : "";
      lines.push(`- ${obs.title}: ${obs.detail}${evidence}`);
    }
  }

  lines.push("", "## TODO");
  if (allFindings.length > 0) {
    allFindings
      .slice()
      .sort((a, b) => {
        const rank = { critical: 4, high: 3, medium: 2, low: 1 } as const;
        return rank[b.severity] - rank[a.severity];
      })
      .forEach((report, idx) => {
        lines.push(
          `- [ ] [P${idx + 1}] 排查 ${report.category} 问题：${report.message}（actor=${report.actorId}, day=${report.day}, phase=${report.phase}）`,
        );
      });
  } else {
    // 批量运行场景：无问题时避免输出待办噪声，给出明确“无需处理”结论。
    lines.pop(); // remove "## TODO"
    lines.push("", "## Conclusion", "- 本局未发现可执行问题，无需新增调试任务。");
  }

  return lines.join("\n");
}

function isExpectedDebugSummaryFormat(text: string): boolean {
  const hasHeader = /^# Debug Summary \(/m.test(text);
  const hasSession = /^## Session/m.test(text);
  const hasStats = /^## Bug Report Stats/m.test(text);
  const hasFindings = /^## Findings/m.test(text);
  return hasHeader && hasSession && hasStats && hasFindings;
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

async function tryBuildByLlm(input: BuildDebugSummaryInput): Promise<string | null> {
  let runtime: Awaited<ReturnType<typeof loadRuntimeConfig>>;
  try {
    runtime = await loadRuntimeConfig();
  } catch {
    return null;
  }
  const debugAgentProfile = resolveAgentProfileByName(
    runtime,
    runtime.debugSummary?.agent?.agentName ?? runtime.game?.debugSummaryAgent ?? runtime.game?.agent,
  );
  if (!debugAgentProfile?.provider?.apiKey || !debugAgentProfile?.model) {
    return null;
  }

  const timeoutMs = runtime.debugSummary?.llmTimeoutMs ?? 30000;
  const maxAttempts = Math.max(1, runtime.debugSummary?.llmMaxAttempts ?? 3);
  const actionableReports = filterActionableReports(
    input.reports,
    input.publicEvents ?? [],
  );
  const autoFindings = scanEventsForPotentialIssues(input);
  const metadataFindings = scanPlayerTimelineMetadataIssues(input.playerViews ?? []);
  const candidateFindings = [...actionableReports, ...autoFindings, ...metadataFindings];
  if (candidateFindings.length === 0) {
    return null;
  }
  const allowedSeqs = new Set<number>();
  for (const report of actionableReports) {
    if (Array.isArray(report.evidence_event_seq)) {
      for (const seq of report.evidence_event_seq) {
        if (typeof seq === "number") {
          allowedSeqs.add(seq);
        }
      }
    }
  }
  for (const finding of autoFindings) {
    for (const seq of finding.evidence ?? []) {
      if (typeof seq === "number") {
        allowedSeqs.add(seq);
      }
    }
  }
  for (const finding of metadataFindings) {
    for (const seq of finding.evidence ?? []) {
      if (typeof seq === "number") {
        allowedSeqs.add(seq);
      }
    }
  }
  const client = new OpenAIClient({
    apiKey: debugAgentProfile.provider.apiKey,
    baseURL: debugAgentProfile.provider.baseURL,
    model: debugAgentProfile.model,
    userAgent: debugAgentProfile.provider.userAgent,
    temperature: debugAgentProfile.temperature ?? 0.1,
    maxTokens: debugAgentProfile.maxTokens ?? 1800,
    forceJsonResponse: debugAgentProfile.forceJsonResponse ?? false,
    reasoningEnabled: debugAgentProfile.reasoningEnabled ?? true,
    reasoningEffort: debugAgentProfile.reasoningEffort ?? "medium",
  });

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const result = await client.chatWithMeta(
        [
          {
            role: "system",
            content:
              "你是狼人杀后端调试助手。请输出 Markdown，必须包含：Session、Bug Report Stats、Findings，以及在确有问题时输出 TODO。若未发现明确问题，请输出 Conclusion 章节并说明无需处理。Findings 每条必须包含 evidence=1,2 这样的证据序号列表，且 evidence 只能来自报告或自动扫描提供的 evidence。",
          },
          {
            role: "user",
            content: [
              `session_id: ${input.manifest.session_id}`,
              `board: ${input.manifest.board}`,
              `winner: ${input.manifest.winner ?? "none"}`,
              `finish_reason: ${input.manifest.finish_reason}`,
              `reports_json: ${JSON.stringify(actionableReports)}`,
              `auto_scan_findings_json: ${JSON.stringify(autoFindings)}`,
              `metadata_findings_json: ${JSON.stringify(metadataFindings)}`,
              `event_digest_json: ${JSON.stringify(buildEventDigest(input.publicEvents ?? []))}`,
            ].join("\n"),
          },
        ],
        { signal: controller.signal },
      );
      const trimmed = result.content.trim();
      if (result.finishReason === "stop" && trimmed.length > 0) {
        if (
          isExpectedDebugSummaryFormat(trimmed) &&
          validateSummaryEvidence(trimmed, allowedSeqs)
        ) {
          return trimmed;
        }
        console.warn(
          `[debug_summary] llm_rejected_reason=format_mismatch session_id=${input.manifest.session_id} attempt=${attempt}/${maxAttempts}`,
        );
      }
      const rejectedReason =
        result.finishReason !== "stop"
          ? `finish_reason=${result.finishReason || "unknown"}`
          : "empty_content";
      console.warn(
        `[debug_summary] llm_rejected_reason=${rejectedReason} session_id=${input.manifest.session_id} attempt=${attempt}/${maxAttempts}`,
      );
    } catch (error) {
      console.warn(
        `[debug_summary] llm_rejected_reason=request_error session_id=${input.manifest.session_id} attempt=${attempt}/${maxAttempts} error=${String(error)}`,
      );
    } finally {
      clearTimeout(timer);
    }
  }
  return null;
}

/** 生成调试总结，优先使用 runtime_config.json；失败时回退模板。 */
export async function buildDebugSummaryMarkdown(
  input: BuildDebugSummaryInput,
): Promise<string> {
  // 无结构化 report 时走确定性汇总，避免 LLM 在低证据条件下产生误报。
  if (input.reports.length === 0) {
    return buildFallbackSummary(input);
  }

  if (input.sessionDir && input.logicOps && input.playerViews) {
    try {
      const pipeline = await buildDebugSummaryWithAgents({
        manifest: input.manifest,
        reports: input.reports,
        publicEvents: input.publicEvents ?? [],
        logicOps: input.logicOps,
        playerViews: input.playerViews,
        sessionDir: input.sessionDir,
      });
      if (pipeline?.markdown) {
        return pipeline.markdown;
      }
    } catch (error) {
      console.warn(
        `[debug_summary] pipeline_failed session_id=${input.manifest.session_id} error=${String(error)}`,
      );
    }
  }
  const llm = await tryBuildByLlm(input);
  if (llm) {
    return llm;
  }
  return buildFallbackSummary(input);
}

function filterActionableReports(
  reports: ReplayDebugReport[],
  publicEvents: Array<{
    seq: number;
    day: number;
    phase: string;
    type: string;
    payload: Record<string, unknown>;
  }>,
): ReplayDebugReport[] {
  return reports.filter((report) =>
    isActionableReport(report, publicEvents),
  );
}

function isActionableReport(
  report: ReplayDebugReport,
  publicEvents: Array<{
    seq: number;
    day: number;
    phase: string;
    type: string;
    payload: Record<string, unknown>;
  }>,
): boolean {
  const message = report.message;
  const category = report.category;
  const text = String(message ?? "").trim();
  if (!text) {
    return false;
  }
  const hasEvidenceSeq = Array.isArray(report.evidence_event_seq) && report.evidence_event_seq.length > 0;

  const hardBugSignal =
    /(日志|广播|顺序|重复|缺失|未(触发|执行|生效|公布|记录|结算)|跳过|死后|出局后|仍然发言|工具.*调用|调用.*失败|报错|error|timeout|fallback|不一致|越权|空守|弃票|没(有)?(公布|记录|触发|执行|生效))/i;
  if (hardBugSignal.test(text) && (hasEvidenceSeq || detectFlowAnomaly(publicEvents))) {
    return true;
  }

  const strategyNoise =
    /(狼队|队友|悍跳|金水|查验|站边|刀口|带队|配合|盘逻辑|好人阵营|狼人阵营|局势对.*(有利|不利)|报假查验)/i;
  if (strategyNoise.test(text)) {
    return false;
  }

  const softActionableSignal =
    /(流程|阶段|票型|投票|放逐|遗言|警长|上警|退水)/i;
  if (softActionableSignal.test(text)) {
    return (
      hasEvidenceSeq ||
      ((category === "flow" || category === "rule" || category === "logging") &&
        detectFlowAnomaly(publicEvents))
    );
  }

  // 规则/流程类分类在无明显噪声时默认保留，避免漏掉简短上报。
  return (
    hasEvidenceSeq &&
    (category === "flow" || category === "rule" || category === "logging")
  );
}

function detectFlowAnomaly(
  events: Array<{
    seq: number;
    day: number;
    phase: string;
    type: string;
    payload: Record<string, unknown>;
  }>,
): boolean {
  if (events.length === 0) {
    return false;
  }
  const phaseChanged = events.filter((e) => e.type === "phase_changed");
  const allowed = new Set([
    "night->day:0",
    "day->voting:0",
    "day->night:1",
    "voting->night:1",
    "night->game_over:0",
    "day->game_over:0",
    "voting->game_over:0",
  ]);
  for (let i = 1; i < phaseChanged.length; i++) {
    const prev = phaseChanged[i - 1];
    const curr = phaseChanged[i];
    const key = `${String(prev.payload.phase ?? prev.phase)}->${String(curr.payload.phase ?? curr.phase)}:${Number(curr.day) - Number(prev.day)}`;
    if (!allowed.has(key)) {
      return true;
    }
  }

  const firstDaySpeechByDay = new Map<number, number>();
  const nightResolvedByDay = new Set<number>();
  for (const e of events) {
    if (e.type === "night_resolved") {
      nightResolvedByDay.add(Number(e.day));
    }
    if (e.type === "day_speech" && !firstDaySpeechByDay.has(Number(e.day))) {
      firstDaySpeechByDay.set(Number(e.day), Number(e.seq));
    }
  }
  for (const [day] of firstDaySpeechByDay.entries()) {
    if (day <= 1) {
      continue;
    }
    if (!nightResolvedByDay.has(day)) {
      return true;
    }
  }
  return false;
}

function buildEventDigest(
  events: Array<{
    seq: number;
    day: number;
    phase: string;
    type: string;
    payload: Record<string, unknown>;
  }>,
): Array<Record<string, unknown>> {
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
  const out: Array<Record<string, unknown>> = [];
  for (const e of events) {
    if (!keepTypes.has(e.type)) {
      continue;
    }
    if (e.type === "day_speech") {
      const text = String((e.payload as any).text ?? "");
      out.push({
        seq: e.seq,
        day: e.day,
        phase: e.phase,
        type: e.type,
        actorId: (e.payload as any).actorId,
        text: text.slice(0, 160),
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
  return out.slice(-120);
}

function scanEventsForPotentialIssues(input: BuildDebugSummaryInput): Array<{
  severity: "low" | "medium" | "high" | "critical";
  category: "flow" | "rule" | "state" | "logging" | "other";
  day: number;
  phase: string;
  actorId: number;
  message: string;
  evidence: number[];
}> {
  const events = input.publicEvents ?? [];
  const findings: Array<{
    severity: "low" | "medium" | "high" | "critical";
    category: "flow" | "rule" | "state" | "logging" | "other";
    day: number;
    phase: string;
    actorId: number;
    message: string;
    evidence: number[];
  }> = [];

  const selfDestruct = events.filter((e) => e.type === "wolf_self_destruct");
  for (const e of selfDestruct) {
    if (e.day === 1) {
      findings.push({
        severity: "medium",
        category: "rule",
        day: e.day,
        phase: e.phase,
        actorId: Number((e.payload as any).wolfId ?? 0),
        message: "首日出现狼人自爆，建议核查自爆窗口策略配置是否符合预期。",
        evidence: [e.seq],
      });
    }
  }

  const hasGuardRole = input.manifest.players.some((p) => p.role === "guard");
  if (!hasGuardRole) {
    const guardMentions = events.filter(
      (e) =>
        (e.type === "day_speech" || e.type === "last_words_spoken") &&
        /守卫/.test(String((e.payload as any).text ?? "")),
    );
    if (guardMentions.length > 0) {
      findings.push({
        severity: "low",
        category: "state",
        day: guardMentions[0].day,
        phase: guardMentions[0].phase,
        actorId: Number((guardMentions[0].payload as any).actorId ?? (guardMentions[0].payload as any).playerId ?? 0),
        message: "本局板子无守卫，但发言中出现守卫相关断言，疑似模型幻觉或信息污染。",
        evidence: guardMentions.slice(0, 6).map((e) => e.seq),
      });
    }
  }

  const witchId = input.manifest.players.find((p) => p.role === "witch")?.player_id ?? 0;
  if (witchId > 0) {
    const usedPotion = events.some((e) => e.type === "witch_potion_used");
    const witchSpeechClaims = events.filter(
      (e) =>
        (e.type === "day_speech" || e.type === "last_words_spoken") &&
        Number((e.payload as any).actorId ?? (e.payload as any).playerId ?? -1) === witchId &&
        /(用了救药|用了毒药|使用了?解药|使用了?毒药)/.test(
          String((e.payload as any).text ?? ""),
        ),
    );
    if (!usedPotion && witchSpeechClaims.length > 0) {
      findings.push({
        severity: "medium",
        category: "logging",
        day: witchSpeechClaims[0].day,
        phase: witchSpeechClaims[0].phase,
        actorId: witchId,
        message: "女巫发言声称已用药，但事件流无用药记录，建议核查模型发言约束与私有信息同步。",
        evidence: witchSpeechClaims.slice(0, 6).map((e) => e.seq),
      });
    }
  }

  return findings;
}

function scanPlayerTimelineMetadataIssues(
  views: ReplayPlayerView[],
): Array<{
  severity: "low" | "medium" | "high" | "critical";
  category: "flow" | "rule" | "state" | "logging" | "other";
  day: number;
  phase: string;
  actorId: number;
  message: string;
  evidence: number[];
}> {
  const findings: Array<{
    severity: "low" | "medium" | "high" | "critical";
    category: "flow" | "rule" | "state" | "logging" | "other";
    day: number;
    phase: string;
    actorId: number;
    message: string;
    evidence: number[];
  }> = [];

  for (const view of views) {
    const invalidDaySeqs: number[] = [];
    const inconsistentReqSeqs: number[] = [];

    for (const entry of view.timeline) {
      if (
        entry.kind !== "llm_message" &&
        entry.kind !== "tool_call" &&
        entry.kind !== "text_action" &&
        entry.kind !== "fallback"
      ) {
        continue;
      }

      if (typeof entry.day !== "number" || entry.day <= 0) {
        invalidDaySeqs.push(entry.seq);
      }

      const requestId = String(entry.request_id ?? "");
      const match = requestId.match(/^(\d+)-([a-z_]+)-/i);
      if (!match) {
        continue;
      }
      const reqDay = Number(match[1]);
      const reqPhase = match[2];
      if (reqDay !== entry.day || reqPhase !== entry.phase) {
        inconsistentReqSeqs.push(entry.seq);
      }
    }

    if (invalidDaySeqs.length > 0) {
      findings.push({
        severity: "high",
        category: "logging",
        day: 0,
        phase: "unknown",
        actorId: view.player_id,
        message: "玩家时间线出现 day<=0 的行动记录，疑似动作上下文写入错误。",
        evidence: invalidDaySeqs.slice(0, 8),
      });
    }

    if (inconsistentReqSeqs.length > 0) {
      findings.push({
        severity: "medium",
        category: "logging",
        day: 0,
        phase: "unknown",
        actorId: view.player_id,
        message: "玩家时间线 request_id 与 day/phase 不一致，疑似请求元数据错位。",
        evidence: inconsistentReqSeqs.slice(0, 8),
      });
    }
  }

  return findings;
}
