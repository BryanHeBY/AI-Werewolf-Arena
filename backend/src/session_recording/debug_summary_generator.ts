/** 文件说明：根据调试上报生成 session 级调试总结 Markdown。 */
import { ReplayDebugReport, ReplayManifest } from "./types";
import { OpenAIClient } from "../infra/llm/openai_client";

interface BuildDebugSummaryInput {
  manifest: ReplayManifest;
  reports: ReplayDebugReport[];
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
    `- critical: ${counts.critical}`,
    `- high: ${counts.high}`,
    `- medium: ${counts.medium}`,
    `- low: ${counts.low}`,
    "",
    "## Findings",
  ];

  if (reports.length === 0) {
    lines.push("- none");
  } else {
    for (const report of reports) {
      const evidence =
        report.evidence_event_seq.length > 0
          ? ` evidence=${report.evidence_event_seq.join(",")}`
          : "";
      lines.push(
        `- [${report.severity.toUpperCase()}][${report.category}] day=${report.day} phase=${report.phase} actor=${report.actor_id}: ${report.message}${evidence}`,
      );
    }
  }

  lines.push("", "## TODO");
  if (reports.length === 0) {
    lines.push("- [ ] 无玩家上报问题，建议结合 public_timeline 抽样复核。");
  } else {
    reports
      .slice()
      .sort((a, b) => {
        const rank = { critical: 4, high: 3, medium: 2, low: 1 } as const;
        return rank[b.severity] - rank[a.severity];
      })
      .forEach((report, idx) => {
        lines.push(
          `- [ ] [P${idx + 1}] 排查 ${report.category} 问题：${report.message}（actor=${report.actor_id}, day=${report.day}, phase=${report.phase}）`,
        );
      });
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
            "你是狼人杀后端调试助手。请输出 Markdown，必须包含：Session、Bug Report Stats、Findings、TODO 四个章节。TODO 必须是可执行排查项。",
        },
        {
          role: "user",
          content: [
            `session_id: ${input.manifest.session_id}`,
            `board: ${input.manifest.board}`,
            `winner: ${input.manifest.winner ?? "none"}`,
            `finish_reason: ${input.manifest.finish_reason}`,
            `reports_json: ${JSON.stringify(input.reports)}`,
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

