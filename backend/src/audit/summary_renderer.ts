import { auditHeadings, text, type MessageKey } from "@ai-werewolf-arena/game-text";
import { auditInline, auditReportStats, auditSummaryHeader } from "./summary_format";
import type { Locale } from "@ai-werewolf-arena/game-catalog";
import type { AuditAgentExecutor } from "../ai/audit/contracts";
import { AuditAgentFinding } from "./payload_builder";
import { AuditEvidencePolicy, MergedAuditFindings } from "./evidence_policy";
import { ReplayDebugReport, ReplayManifest } from "../recording/contracts";

export class AuditSummaryRenderer {
  constructor(
    private readonly executor: AuditAgentExecutor,
    private readonly evidencePolicy: AuditEvidencePolicy,
    private readonly timeoutMs: number,
    private readonly locale: Locale = "zh-CN",
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
          locale: this.locale,
          taskName: "agent_summary",
          source: "merged_findings",
          payload: {
            session: {
              session_id: manifest.session_id,
              board: manifest.board,
              winner: manifest.winner ?? "none",
              ...(manifest.game_result ? { decision: structuredClone(manifest.game_result) } : {}),
              finish_reason: manifest.finish_reason,
              started_at: manifest.started_at,
              ended_at: manifest.ended_at,
            },
            report_stats: auditReportStats(reports),
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
      const visible = new Set(
        merged.findings
          .flatMap((finding) => finding.evidence)
          .filter((sequence) => allowed.has(sequence)),
      );
      return markdown && this.evidencePolicy.validatesMarkdown(markdown, visible, this.locale)
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
    const headings = auditHeadings(this.locale);
    const lines = auditSummaryHeader(manifest, reports, this.locale);
    if (!merged.findings.length) lines.push(`- ${text(this.locale, "common.none")}`);
    else for (const finding of merged.findings) lines.push(this.findingLine(finding));
    lines.push("");
    if (merged.findings.length) {
      lines.push(`## ${headings.todo}`);
      merged.findings.forEach((finding, index) => {
        lines.push(
          `- [ ] [P${index + 1}] ${text(this.locale, "audit.todo", { category: text(this.locale, `audit.category.${finding.category}` as MessageKey), message: auditInline(finding.message) })}`,
        );
      });
    } else {
      lines.push(`## ${headings.conclusion}`, `- ${text(this.locale, "audit.conclusion")}`);
    }
    lines.push("", `## ${headings.pipeline}`);
    lines.push(`- ${text(this.locale, "audit.field.agents_total")}: ${merged.totalAgents}`);
    lines.push(
      `- ${text(this.locale, "audit.field.agents_failed")}: ${merged.failedAgents.length}`,
    );
    if (merged.failedAgents.length)
      lines.push(
        `- ${text(this.locale, "audit.field.failed_list")}: ${auditInline(merged.failedAgents.join(", "))}`,
      );
    if (merged.missingInfo.length) {
      lines.push(`- ${text(this.locale, "audit.field.missing")}:`);
      for (const note of merged.missingInfo) lines.push(`- ${auditInline(note)}`);
    }
    return lines.join("\n");
  }

  private findingLine(finding: AuditAgentFinding): string {
    const evidence = finding.evidence.length ? ` evidence=${finding.evidence.join(",")}` : "";
    return `- [${finding.severity.toUpperCase()}][${auditInline(finding.category)}] ${auditInline(finding.message)}${evidence} (source=${auditInline(finding.source)})`;
  }
}
