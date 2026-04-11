/** 文件说明：根据调试上报生成 session 级调试总结 Markdown。 */
import { ReplayDebugReport, ReplayManifest } from "./types";
import { OpenAIClient } from "../infra/llm/openai_client";

interface BuildDebugSummaryInput {
  manifest: ReplayManifest;
  reports: ReplayDebugReport[];
  publicEvents?: Array<{
    seq: number;
    day: number;
    phase: string;
    type: string;
    payload: Record<string, unknown>;
  }>;
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

function buildFallbackSummary(input: BuildDebugSummaryInput): string {
  const { manifest, reports } = input;
  const actionableReports = filterActionableReports(
    reports,
    input.publicEvents ?? [],
  );
  const autoFindings = scanEventsForPotentialIssues(input);
  const allFindings = [
    ...actionableReports.map((r) => ({
      severity: r.severity,
      category: r.category,
      day: r.day,
      phase: r.phase,
      actorId: r.actor_id,
      message: r.message,
      evidence: r.evidence_event_seq,
    })),
    ...autoFindings,
  ];
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

async function tryBuildByLlm(input: BuildDebugSummaryInput): Promise<string | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL;
  if (!apiKey || !model) {
    return null;
  }

  const baseURL = process.env.OPENAI_BASE_URL;
  const timeoutMs = Number(process.env.OPENAI_TIMEOUT_MS ?? "30000");
  const actionableReports = filterActionableReports(
    input.reports,
    input.publicEvents ?? [],
  );
  const autoFindings = scanEventsForPotentialIssues(input);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const client = new OpenAIClient({
      apiKey,
      baseURL,
      model,
      temperature: 0.1,
      maxTokens: 1800,
      forceJsonResponse: false,
    });
    const summary = await client.chat(
      [
        {
          role: "system",
          content:
            "你是狼人杀后端调试助手。请输出 Markdown，必须包含：Session、Bug Report Stats、Findings，以及在确有问题时输出 TODO。若未发现明确问题，请输出 Conclusion 章节并说明无需处理。",
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
            `event_digest_json: ${JSON.stringify(buildEventDigest(input.publicEvents ?? []))}`,
          ].join("\n"),
        },
      ],
      { signal: controller.signal },
    );
    const trimmed = summary.trim();
    return trimmed.length > 0 ? trimmed : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** 生成调试总结，优先使用 .env 中 OPENAI_* 配置；失败时回退模板。 */
export async function buildDebugSummaryMarkdown(
  input: BuildDebugSummaryInput,
): Promise<string> {
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
