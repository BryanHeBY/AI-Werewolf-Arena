import { AuditAgentFinding, AuditAgentOutput } from "./audit_payload_builder";
import type { DebugSummaryPipelineInput } from "./debug_summary_pipeline";

const SEVERITY_RANK: Record<AuditAgentFinding["severity"], number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
};

export interface MergedAuditFindings {
  findings: AuditAgentFinding[];
  failedAgents: string[];
  missingInfo: string[];
  totalAgents: number;
}

/** Deterministic policy for merging findings and enforcing replay evidence references. */
export class AuditEvidencePolicy {
  merge(outputs: AuditAgentOutput[]): MergedAuditFindings {
    const unique = new Map<string, AuditAgentFinding>();
    const failedAgents: string[] = [];
    const missingInfo: string[] = [];
    for (const output of outputs) {
      if (output.failed) {
        failedAgents.push(output.agent);
        if (output.failure_reason) missingInfo.push(`${output.agent}: ${output.failure_reason}`);
      }
      for (const finding of output.findings) {
        const key = `${finding.category}|${finding.message}|${finding.evidence.join(",")}`;
        if (!unique.has(key)) unique.set(key, finding);
      }
      for (const note of output.missing_info) missingInfo.push(`${output.agent}: ${note}`);
    }
    const findings = [...unique.values()].sort((a, b) =>
      SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity] ||
      (a.evidence[0] ?? 0) - (b.evidence[0] ?? 0),
    );
    return { findings, failedAgents, missingInfo, totalAgents: outputs.length };
  }

  allowedSequences(input: DebugSummaryPipelineInput): Set<number> {
    const sequences = new Set<number>();
    for (const event of input.publicEvents) sequences.add(event.seq);
    for (const operation of input.logicOps) sequences.add(operation.seq);
    for (const view of input.playerViews) {
      for (const entry of view.timeline) sequences.add(entry.seq);
    }
    return sequences;
  }

  filterByEvidence(findings: AuditAgentFinding[], allowed: Set<number>) {
    const kept: AuditAgentFinding[] = [];
    const dropped: string[] = [];
    for (const finding of findings) {
      if (!finding.evidence?.length) {
        dropped.push(`[no_evidence] ${finding.message}`);
        continue;
      }
      const invalid = finding.evidence.filter((sequence) => !allowed.has(sequence));
      if (invalid.length) {
        dropped.push(`[invalid_evidence] ${finding.message} evidence=${invalid.join(",")}`);
      } else {
        kept.push(finding);
      }
    }
    return { findings: kept, dropped };
  }

  validatesMarkdown(markdown: string, allowed: Set<number>): boolean {
    const lines = markdown.split("\n");
    const start = lines.findIndex((line) => /^##\s+Findings\b/.test(line));
    if (start < 0) return false;
    for (let index = start + 1; index < lines.length && !/^##\s+/.test(lines[index]); index++) {
      const line = lines[index].trim();
      if (!line.startsWith("-") || /^-+\s*(none|无)\b/i.test(line)) continue;
      const match = line.match(/evidence=([0-9, ]+)/i);
      if (!match) return false;
      const sequences = match[1].split(",").map((value) => Number(value.trim()));
      if (!sequences.length || sequences.some((value) => Number.isNaN(value) || !allowed.has(value))) {
        return false;
      }
    }
    return true;
  }
}
