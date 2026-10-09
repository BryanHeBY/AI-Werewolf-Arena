import { auditHeadings, text, type Locale } from "@ai-werewolf-arena/game-text";
import { AuditAgentFinding, AuditAgentOutput } from "./payload_builder";
import type { DebugSummaryPipelineInput } from "./pipeline";

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
    const findings = [...unique.values()].sort(
      (a, b) =>
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

  /** Generated summaries use a deliberately narrow Markdown protocol, not arbitrary Markdown. */
  validatesMarkdown(markdown: string, allowed: Set<number>, locale: Locale = "en"): boolean {
    const lines = markdown.split("\n").map((line) => line.replace(/\r$/, ""));
    for (const line of lines) {
      if (
        /^\s*(?:```|~~~)/.test(line) ||
        /<\/?[a-z][^>]*>|<!--|-->|<!|<\?/i.test(line) ||
        /^(?: {4}|[ \t]*\t)/.test(line) ||
        /^[ \t]*>/.test(line) ||
        /^[ \t]*(?:=+|-+)[ \t]*$/.test(line)
      )
        return false;
      let content = line.trimStart();
      let container = false;
      for (;;) {
        const prefix = /^(?:[-+*]|\d+[.)])[ \t]+/.exec(content);
        if (!prefix) break;
        container = true;
        content = content.slice(prefix[0].length).trimStart();
      }
      if (container && (/^#{1,6}(?:[ \t]|$)/.test(content) || content.startsWith(">")))
        return false;
    }
    const headings = auditHeadings(locale);
    const sections: Array<{ name: string; index: number }> = [];
    let titleSeen = false;
    const firstContent = lines.findIndex((line) => line.trim());
    for (let index = 0; index < lines.length; index++) {
      const line = lines[index];
      if (!/^[ \t]{0,3}#{1,6}(?:[ \t]|$)/.test(line)) continue;
      if (/^# [^#].*[^#]$/.test(line) && index === firstContent && !titleSeen) {
        titleSeen = true;
        continue;
      }
      const match = /^## ([^#]+)$/.exec(line);
      if (!match || !Object.values(headings).includes(match[1])) return false;
      sections.push({ name: match[1], index });
    }
    const names = sections.map((section) => section.name);
    const hasObservations = names.includes(headings.observations);
    const ending = names.includes(headings.todo) ? headings.todo : headings.conclusion;
    const expected = [
      headings.session,
      headings.stats,
      headings.findings,
      ...(hasObservations ? [headings.observations] : []),
      ending,
      headings.pipeline,
    ];
    if (JSON.stringify(names) !== JSON.stringify(expected)) return false;
    const evidenceValid = (line: string, required: boolean): boolean => {
      const markers = [...line.matchAll(/evidence=/gi)];
      if (!markers.length) return !required;
      if (markers.length !== 1) return false;
      const tail = line
        .slice(markers[0].index! + markers[0][0].length)
        .replace(/[ \t]*,[ \t]*/g, ",");
      const match = /^([1-9]\d*(?:,[1-9]\d*)*)(?:[ \t]+|$)/.exec(tail);
      if (!match) return false;
      return match[1]
        .split(",")
        .every((value) => Number.isSafeInteger(Number(value)) && allowed.has(Number(value)));
    };
    // References outside Findings have the same task-local authorization boundary.
    if (lines.some((line) => !evidenceValid(line, false))) return false;
    const start = sections.find((section) => section.name === headings.findings)!.index;
    const end = sections.find((section) => section.index > start)!.index;
    const entries = lines.slice(start + 1, end).filter((line) => line.trim());
    if (!entries.length) return false;
    const none = `- ${text(locale, "common.none")}`.toLowerCase();
    if (entries.length === 1 && entries[0].toLowerCase() === none) return true;
    return entries.every(
      (line) =>
        !/^[ \t]{4}/.test(line) &&
        line.startsWith("- ") &&
        line.trim().toLowerCase() !== none &&
        evidenceValid(line, true),
    );
  }
}
