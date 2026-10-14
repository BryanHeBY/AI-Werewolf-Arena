/**
 * 负责可选 AI 审计与确定性调试摘要的选择；输入录制快照和已解析审计配置，输出原语言策略下的 Markdown。
 * 只组织诊断，不修改游戏状态、原记录或终局；executor 的创建／关闭仍归实际 pipeline。
 * AI 分支的已捕获异常先告警再回退；告警格式化和回退自身未被此 catch 保护，失败仍按原路径传播。
 */
import { formatErrorDiagnostic } from "../utils/error_diagnostic";
import type { ResolvedAuditConfig } from "../runtime/config/contracts";
import type { BuildDebugSummaryInput } from "./contracts";
import { buildFallbackSummary } from "./fallback_summary_renderer";
import { buildDebugSummaryWithAgents } from "./pipeline";

/** 生成调试总结；AI 审计不可用时回退到确定性摘要。 */
export async function buildDebugSummaryMarkdown(
  input: BuildDebugSummaryInput,
  audit: ResolvedAuditConfig | null,
): Promise<string> {
  // 无结构化报告时不进入 AI 分支；确定性结果也只是现有记录的诊断候选，不重判对局。
  if (input.reports.length === 0) {
    return buildFallbackSummary(input);
  }

  // 只要求目录和两数组存在，空数组仍可进入；audit 是否可用由 pipeline 原门槛决定。
  if (input.sessionDir && input.logicOps && input.playerViews) {
    try {
      const pipeline = await buildDebugSummaryWithAgents(
        {
          locale: input.locale,
          displayLocale: input.displayLocale,
          manifest: input.manifest,
          reports: input.reports,
          publicEvents: input.publicEvents ?? [],
          logicOps: input.logicOps,
          playerViews: input.playerViews,
          sessionDir: input.sessionDir,
        },
        audit,
      );
      // 仅采用真值 Markdown；null／空结果和下方已捕获失败仍沿原确定性路径。
      if (pipeline?.markdown) {
        return pipeline.markdown;
      }
    } catch (error) {
      console.warn(
        `[debug_summary] pipeline_failed session_id=${input.manifest.session_id} error=${formatErrorDiagnostic(error, input.displayLocale ?? input.locale ?? "zh-CN")}`,
      );
    }
  }
  return buildFallbackSummary(input);
}
