/**
 * 负责测试构造器中的手写双语审计输入、独立标题及可选 fixture 内容。输入及字面预期仍归原测试，输出保持其 DTO／断言契约。
 * 本支持模块不运行生产结算来生成新的预期结果。
 */
import type { Locale } from "@ai-werewolf-arena/game-contract";

/** 手写协议标题预期，不从生产格式器生成 oracle。 */
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
