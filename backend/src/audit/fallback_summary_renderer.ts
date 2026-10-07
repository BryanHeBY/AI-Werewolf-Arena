import { auditHeadings, renderMessage, text, type MessageKey } from "@ai-werewolf-arena/game-text";
import { auditInline, auditSummaryHeader } from "./summary_format";
/** Render a deterministic summary when AI audit is unavailable or unnecessary. */
import type { ReplayDebugReport } from "../recording/contracts";
import type { BuildDebugSummaryInput } from "./contracts";
import { collectObservations, filterActionableReports, scanEventsForPotentialIssues, scanPlayerTimelineMetadataIssues } from "./deterministic_checks";

export function buildFallbackSummary(input: BuildDebugSummaryInput): string {
  const { manifest, reports } = input;
  const locale = input.displayLocale ?? input.locale ?? "zh-CN";
  const headings = auditHeadings(locale);
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
    ...[...autoFindings, ...metadataFindings].map(item => ({ ...item, message: renderMessage(locale, item.message) })),
  ];
  const observations = collectObservations(input);
  const lines = auditSummaryHeader(manifest, reports, locale, actionableReports.length);

  if (allFindings.length === 0) {
    lines.push(`- ${text(locale, "common.none")}`);
  } else {
    for (const report of allFindings) {
      const evidence =
        report.evidence.length > 0
          ? ` evidence=${report.evidence.join(",")}`
          : "";
      lines.push(
        `- [${report.severity.toUpperCase()}][${auditInline(report.category)}] day=${report.day} phase=${auditInline(report.phase)} actor=${report.actorId}: ${auditInline(report.message)}${evidence}`,
      );
    }
  }

  lines.push("", `## ${headings.observations}`);
  if (observations.length === 0) {
    lines.push(`- ${text(locale, "common.none")}`);
  } else {
    for (const obs of observations) {
      const evidence =
        obs.evidence && obs.evidence.length > 0
          ? ` evidence=${obs.evidence.join(",")}`
          : "";
      lines.push(`- ${text(locale, obs.title)}: ${renderMessage(locale, obs.detail)}${evidence}`);
    }
  }

  lines.push("", `## ${headings.todo}`);
  if (allFindings.length > 0) {
    allFindings
      .slice()
      .sort((a, b) => {
        const rank = { critical: 4, high: 3, medium: 2, low: 1 } as const;
        return rank[b.severity] - rank[a.severity];
      })
      .forEach((report, idx) => {
        lines.push(
          `- [ ] [P${idx + 1}] ${text(locale, "audit.todo", { category: text(locale, `audit.category.${report.category}` as MessageKey), message: auditInline(report.message) })} (actor=${report.actorId}, day=${report.day}, phase=${auditInline(report.phase)})`,
        );
      });
  } else {
    // 批量运行场景：无问题时避免输出待办噪声，给出明确“无需处理”结论。
    lines.pop(); // remove "## TODO"
    lines.push("", `## ${headings.conclusion}`, `- ${text(locale, "audit.conclusion")}`);
  }

  lines.push("", `## ${headings.pipeline}`, `- ${text(locale, "audit.pipeline.fallback")}`);
  return lines.join("\n");
}
