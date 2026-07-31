import { AuditAgentExecutor } from "../ai/audit/audit_agent_executor";
import { AuditAgentFinding } from "./audit_payload_builder";
import { AuditEvidencePolicy, MergedAuditFindings } from "./audit_evidence_policy";
import { ReplayDebugReport, ReplayManifest } from "./types";

export class AuditSummaryRenderer {
  constructor(
    private readonly executor: AuditAgentExecutor,
    private readonly evidencePolicy: AuditEvidencePolicy,
    private readonly timeoutMs: number,
  ) {}

  async render(
    manifest: ReplayManifest,
    reports: ReplayDebugReport[],
    merged: MergedAuditFindings,
    allowedSequences: Set<number>,
  ): Promise<string> {
    const generated = await this.renderWithAgent(manifest, reports, merged, allowedSequences);
    return generated ?? this.renderDeterministically(manifest, reports, merged);
  }

  private async renderWithAgent(
    manifest: ReplayManifest,
    reports: ReplayDebugReport[],
    merged: MergedAuditFindings,
    allowed: Set<number>,
  ): Promise<string | null> {
    try {
      const result = await this.executor.runTurn(
        {
          mode: "summarize",
          taskName: "agent_summary",
          source: "merged_findings",
          payload: {
            session: {
              session_id: manifest.session_id,
              board: manifest.board,
              winner: manifest.winner ?? "none",
              finish_reason: manifest.finish_reason,
              started_at: manifest.started_at,
              ended_at: manifest.ended_at,
            },
            report_stats: this.reportStats(reports),
            findings: merged.findings,
            pipeline: {
              failed_agents: merged.failedAgents,
              missing_info: merged.missingInfo,
            },
          },
        },
        { timeoutMs: this.timeoutMs },
      );
      const markdown = result?.kind === "summary" ? result.markdown.trim() : "";
      return markdown && this.evidencePolicy.validatesMarkdown(markdown, allowed)
        ? markdown
        : null;
    } catch {
      return null;
    }
  }

  private renderDeterministically(
    manifest: ReplayManifest,
    reports: ReplayDebugReport[],
    merged: MergedAuditFindings,
  ): string {
    const stats = this.reportStats(reports);
    const lines = [
      `# Debug Summary (${manifest.session_id})`, "", "## Session",
      `- board: ${manifest.board}`,
      `- winner: ${manifest.winner ?? "none"}`,
      `- finish_reason: ${manifest.finish_reason}`,
      `- started_at: ${manifest.started_at}`,
      `- ended_at: ${manifest.ended_at}`, "", "## Bug Report Stats",
      `- total: ${stats.total}`,
      `- critical: ${stats.critical}`,
      `- high: ${stats.high}`,
      `- medium: ${stats.medium}`,
      `- low: ${stats.low}`, "", "## Findings",
    ];
    if (!merged.findings.length) lines.push("- none");
    else for (const finding of merged.findings) lines.push(this.findingLine(finding));
    lines.push("");
    if (merged.findings.length) {
      lines.push("## TODO");
      merged.findings.forEach((finding, index) => {
        lines.push(`- [ ] [P${index + 1}] 排查 ${finding.category} 问题：${finding.message}`);
      });
    } else {
      lines.push("## Conclusion", "- 本局未发现可执行问题，无需新增调试任务。");
    }
    lines.push("", "## Debug Pipeline");
    lines.push(`- agents_total: ${merged.totalAgents}`);
    lines.push(`- agents_failed: ${merged.failedAgents.length}`);
    if (merged.failedAgents.length) lines.push(`- failed_list: ${merged.failedAgents.join(", ")}`);
    if (merged.missingInfo.length) {
      lines.push("- missing_info:");
      for (const note of merged.missingInfo) lines.push(`- ${note}`);
    }
    return lines.join("\n");
  }

  private reportStats(reports: ReplayDebugReport[]) {
    return {
      total: reports.length,
      critical: reports.filter((report) => report.severity === "critical").length,
      high: reports.filter((report) => report.severity === "high").length,
      medium: reports.filter((report) => report.severity === "medium").length,
      low: reports.filter((report) => report.severity === "low").length,
    };
  }

  private findingLine(finding: AuditAgentFinding): string {
    const evidence = finding.evidence.length ? ` evidence=${finding.evidence.join(",")}` : "";
    return `- [${finding.severity.toUpperCase()}][${finding.category}] ${finding.message}${evidence} (source=${finding.source})`;
  }
}
