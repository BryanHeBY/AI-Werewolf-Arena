/**
 * Provides the builder test boundary: Handwritten bilingual audit-summary protocol input, independently specified headings and optional fixture content. Inputs and literal expectations remain owned by the original tests; output preserves their original DTO/assertion contract. No production settlement supplies a new expected result.
 */
import type { Locale } from "@ai-werewolf-arena/game-catalog";

/** Handwritten expected protocol headings; never derive an oracle from production formatting. */
export function auditSummaryFixture(locale: Locale, findings?: string, tail = ""): string {
  const headings =
    locale === "en"
      ? ["Session", "Bug Report Stats", "Findings", "Conclusion", "Debug Pipeline"]
      : ["对局", "问题上报统计", "审查事项", "结论", "审计流程"];
  return [
    `## ${headings[0]}`,
    "- synthetic",
    "",
    `## ${headings[1]}`,
    "- total: 0",
    "",
    `## ${headings[2]}`,
    findings ?? (locale === "en" ? "- None" : "- 无"),
    "",
    `## ${headings[3]}`,
    "- synthetic",
    "",
    `## ${headings[4]}`,
    "- synthetic",
    ...(tail ? ["", tail] : []),
  ].join("\n");
}
