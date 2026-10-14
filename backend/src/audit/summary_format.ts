/**
 * 负责 Agent 摘要和确定性回退的共享 Markdown 展示。输入为既有审计报告、清单与语言；输出为统计和原摘要段落，不启动审计任务、修改录制或重新推导游戏结果。
 */
import { auditHeadings, term, text, type Locale } from "@ai-werewolf-arena/game-text";
import {
  outcomeLabel,
  outcomeWinnersLabel,
  victoryPointLabel,
} from "@ai-werewolf-arena/game-presentation";
import type { ReplayDebugReport, ReplayManifest } from "../recording/contracts";

/** 统计全部原报告条目；可行动数量由调用方另传，不在这里去重或重新判断严重度。 */
export function auditReportStats(reports: readonly ReplayDebugReport[]) {
  return {
    total: reports.length,
    critical: reports.filter((item) => item.severity === "critical").length,
    high: reports.filter((item) => item.severity === "high").length,
    medium: reports.filter((item) => item.severity === "medium").length,
    low: reports.filter((item) => item.severity === "low").length,
  };
}

/** 将换行写为字面转义并处理 HTML 三字符及证据标记，避免字段另起章节或伪造引用；其余 Markdown 字符沿原文保留。 */
export function auditInline(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\r/g, "\\r")
    .replace(/\n/g, "\\n")
    .replace(/evidence=/gi, (marker) => marker.replace("=", "\\="));
}

/** 仅组织共享标题、会话字段与统计，再交回发现章节起点；发现正文和后续章节归各自 renderer。 */
export function auditSummaryHeader(
  manifest: ReplayManifest,
  reports: readonly ReplayDebugReport[],
  locale: Locale,
  actionable?: number,
): string[] {
  const headings = auditHeadings(locale);
  const stats = auditReportStats(reports);
  // 有完整 game_result 时展示已封盘 outcome，否则沿用旧 winner；只读结果，不再次判胜或翻译原会话数据。
  const fields: Array<[string, string | number]> = [
    [text(locale, "audit.field.board"), manifest.board],
    [
      text(locale, "audit.field.winner"),
      manifest.game_result
        ? outcomeLabel(manifest.game_result.outcome, locale)
        : manifest.winner
          ? term("camp_team", manifest.winner, locale)
          : text(locale, "common.none"),
    ],
    [text(locale, "audit.field.reason"), term("reason", manifest.finish_reason, locale)],
    [text(locale, "audit.field.started"), manifest.started_at],
    [text(locale, "audit.field.ended"), manifest.ended_at ?? ""],
  ];
  if (manifest.game_result)
    fields.push(
      [
        text(locale, "victory.winner_badge"),
        outcomeWinnersLabel(manifest.game_result.outcome, locale),
      ],
      [
        text(locale, "replay.final_result"),
        victoryPointLabel(manifest.game_result.decidedAt, locale),
      ],
    );
  return [
    `# ${text(locale, "audit.title", { session: auditInline(manifest.session_id) })}`,
    "",
    `## ${headings.session}`,
    ...fields.map(([label, value]) => `- ${label}: ${auditInline(String(value))}`),
    "",
    `## ${headings.stats}`,
    `- ${text(locale, "audit.field.total")}: ${stats.total}`,
    ...(actionable === undefined
      ? []
      : [`- ${text(locale, "audit.field.actionable")}: ${actionable}`]),
    ...(["critical", "high", "medium", "low"] as const).map(
      (key) => `- ${text(locale, `audit.field.${key}`)}: ${stats[key]}`,
    ),
    "",
    `## ${headings.findings}`,
  ];
}
