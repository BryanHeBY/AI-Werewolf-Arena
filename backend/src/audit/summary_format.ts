/** Shared Markdown presentation for agent summaries and deterministic fallback. */
import { auditHeadings, term, text, type Locale } from "@ai-werewolf-arena/game-text";
import type { ReplayDebugReport, ReplayManifest } from "../recording/contracts";

export function auditReportStats(reports: readonly ReplayDebugReport[]) {
  return { total: reports.length, critical: reports.filter(item => item.severity === "critical").length,
    high: reports.filter(item => item.severity === "high").length, medium: reports.filter(item => item.severity === "medium").length,
    low: reports.filter(item => item.severity === "low").length };
}

/** Encode line breaks so original text cannot introduce new Markdown sections. */
export function auditInline(value: string): string { return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\r/g, "\\r").replace(/\n/g, "\\n").replace(/evidence=/gi, marker => marker.replace("=", "\\=")); }

export function auditSummaryHeader(manifest: ReplayManifest, reports: readonly ReplayDebugReport[], locale: Locale, actionable?: number): string[] {
  const headings = auditHeadings(locale); const stats = auditReportStats(reports);
  const fields: Array<[string, string | number]> = [
    [text(locale, "audit.field.board"), manifest.board],
    [text(locale, "audit.field.winner"), manifest.winner ? term("camp_team", manifest.winner, locale) : text(locale, "common.none")],
    [text(locale, "audit.field.reason"), term("reason", manifest.finish_reason, locale)],
    [text(locale, "audit.field.started"), manifest.started_at], [text(locale, "audit.field.ended"), manifest.ended_at ?? ""],
  ];
  return [`# ${text(locale, "audit.title", { session: auditInline(manifest.session_id) })}`, "", `## ${headings.session}`,
    ...fields.map(([label, value]) => `- ${label}: ${auditInline(String(value))}`), "", `## ${headings.stats}`,
    `- ${text(locale, "audit.field.total")}: ${stats.total}`,
    ...(actionable === undefined ? [] : [`- ${text(locale, "audit.field.actionable")}: ${actionable}`]),
    ...(["critical", "high", "medium", "low"] as const).map(key => `- ${text(locale, `audit.field.${key}`)}: ${stats[key]}`),
    "", `## ${headings.findings}`,
  ];
}
