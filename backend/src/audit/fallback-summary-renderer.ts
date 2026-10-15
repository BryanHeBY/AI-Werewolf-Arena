/**
 * 负责可选 AI 审计之外的确定性摘要渲染；输入原清单、报告和录制历史，输出本地化标题与原报告文本。
 * 组合筛选报告、事件疑点和玩家元数据观察，不确认真实违规、不重判胜负、不写记录或调用模型。
 * 翻译／字段展示及后续渲染异常原样传播；本模块不设失败汇总或取消／资源生命周期。
 */
import { auditHeadings, renderMessage, text, type MessageKey } from "@ai-werewolf-arena/game-text";
import { auditInline, auditSummaryHeader } from "./summary-format";
import type { ReplayDebugReport } from "../recording/contracts";
import type { BuildDebugSummaryInput } from "./contracts";
import {
  collectObservations,
  filterActionableReports,
  scanEventsForPotentialIssues,
  scanPlayerTimelineMetadataIssues,
} from "./deterministic-checks";

export function buildFallbackSummary(input: BuildDebugSummaryInput): string {
  const { manifest, reports } = input;
  const locale = input.displayLocale ?? input.locale ?? "zh-CN";
  const headings = auditHeadings(locale);
  const actionableReports = filterActionableReports(reports, input.publicEvents ?? []);
  const autoFindings = scanEventsForPotentialIssues(input);
  const metadataFindings = scanPlayerTimelineMetadataIssues(input.playerViews ?? []);
  // 原报告保持筛选顺序，随后附加两类候选；不跨来源去重或改写严重度，消息引用只在这里按 locale 渲染。
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
    ...[...autoFindings, ...metadataFindings].map((item) => ({
      ...item,
      message: renderMessage(locale, item.message),
    })),
  ];
  const observations = collectObservations(input);
  const lines = auditSummaryHeader(manifest, reports, locale, actionableReports.length);

  if (allFindings.length === 0) {
    lines.push(`- ${text(locale, "common.none")}`);
  } else {
    for (const report of allFindings) {
      const evidence = report.evidence.length > 0 ? ` evidence=${report.evidence.join(",")}` : "";
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
        obs.evidence && obs.evidence.length > 0 ? ` evidence=${obs.evidence.join(",")}` : "";
      lines.push(`- ${text(locale, obs.title)}: ${renderMessage(locale, obs.detail)}${evidence}`);
    }
  }

  lines.push("", `## ${headings.todo}`);
  // 待办单独复制后按严重度排序，不重排上方发现章节或任何原输入数组。
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
    // 没有收集到候选时移除刚追加的待办标题；这是本次摘要输出，不证明对局无隐藏问题。
    lines.pop(); // 仅移除刚写入的待办标题，保原空行和结论顺序。
    lines.push("", `## ${headings.conclusion}`, `- ${text(locale, "audit.conclusion")}`);
  }

  lines.push("", `## ${headings.pipeline}`, `- ${text(locale, "audit.pipeline.fallback")}`);
  return lines.join("\n");
}
