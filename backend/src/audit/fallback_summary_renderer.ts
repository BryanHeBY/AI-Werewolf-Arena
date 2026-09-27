/** Render a deterministic summary when AI audit is unavailable or unnecessary. */
import type { ReplayDebugReport } from "../recording/contracts";
import type { BuildDebugSummaryInput } from "./contracts";
import { collectObservations, filterActionableReports, scanEventsForPotentialIssues, scanPlayerTimelineMetadataIssues } from "./deterministic_checks";

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

export function buildFallbackSummary(input: BuildDebugSummaryInput): string {
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
