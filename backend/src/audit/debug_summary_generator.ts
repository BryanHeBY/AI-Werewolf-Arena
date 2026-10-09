import { formatErrorDiagnostic } from "../utils/error_diagnostic";
/** Choose agent audit when available, otherwise render deterministic findings. */
import type { ResolvedAuditConfig } from "../runtime/config/contracts";
import type { BuildDebugSummaryInput } from "./contracts";
import { buildFallbackSummary } from "./fallback_summary_renderer";
import { buildDebugSummaryWithAgents } from "./pipeline";

/** 生成调试总结；AI 审计不可用时回退到确定性摘要。 */
export async function buildDebugSummaryMarkdown(
  input: BuildDebugSummaryInput,
  audit: ResolvedAuditConfig | null,
): Promise<string> {
  // 无结构化 report 时走确定性汇总，避免 LLM 在低证据条件下产生误报。
  if (input.reports.length === 0) {
    return buildFallbackSummary(input);
  }

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
