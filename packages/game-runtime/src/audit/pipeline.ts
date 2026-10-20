/**
 * 负责已解析配置下的审计执行、证据过滤和摘要组合。输入为原会话快照与可选审计配置，输出 Markdown 和失败任务名单或 null。
 * 本流程创建并在原 finally 关闭 executor，检测结果经确定证据策略再渲染；不重判对局、不自己加载全局运行配置或修改原记录。
 */
import type { Locale } from "@ai-werewolf-arena/game-contract";
/** 模型辅助的复盘审计编排，游戏结算仍归引擎。 */
import { createAuditAgentExecutor } from "../app/audit-agent-factory";
import type { ResolvedAuditConfig } from "../app/config/contracts";
import { AuditEvidencePolicy } from "./evidence-policy";
import { buildAuditTasks } from "./payload-builder";
import { AuditSummaryRenderer } from "./summary-renderer";
import { AuditTaskRunner } from "./task-runner";
import {
  ReplayDebugReport,
  ReplayLogicOp,
  ReplayManifest,
  ReplayPlayerView,
  ReplayPublicEvent,
} from "../recording/contracts";

export interface DebugSummaryPipelineInput {
  locale?: Locale;
  displayLocale?: Locale;
  manifest: ReplayManifest;
  reports: ReplayDebugReport[];
  publicEvents: ReplayPublicEvent[];
  logicOps: ReplayLogicOp[];
  playerViews: ReplayPlayerView[];
  sessionDir: string;
}

interface PipelineResult {
  markdown: string;
  failedAgents: string[];
}

/** 执行审计并明确持有 executor 生命周期；检查结果在渲染前经过确定证据过滤。 */
export async function buildDebugSummaryWithAgents(
  input: DebugSummaryPipelineInput,
  audit: ResolvedAuditConfig | null,
): Promise<PipelineResult | null> {
  if (input.reports.length === 0 || !audit) return null;
  const settings = {
    timeoutMs: audit.timeoutMs,
    maxAttempts: audit.maxAttempts,
    concurrency: audit.concurrency,
    publicMaxItems: audit.publicMaxItems,
    maxItems: audit.maxItems,
    playerMaxItems: audit.playerMaxItems,
  };
  const executor = createAuditAgentExecutor({
    profile: audit.profile,
    workspaceRoot: `${input.sessionDir}/audit-workspaces`,
  });
  if (!executor) return null;

  try {
    const tasks = buildAuditTasks(input, settings);
    const runner = new AuditTaskRunner(executor, input.manifest.session_id, {
      ...settings,
      displayLocale: input.displayLocale ?? input.locale,
    });
    const outputs = await runner.run(tasks);
    const evidencePolicy = new AuditEvidencePolicy();
    const merged = evidencePolicy.merge(outputs);
    const allowedSequences = evidencePolicy.allowedSequences(input);
    const filtered = evidencePolicy.filterByEvidence(merged.findings, allowedSequences);
    merged.findings = filtered.findings;
    merged.missingInfo.push(...filtered.dropped.map((note) => `dropped: ${note}`));
    const renderer = new AuditSummaryRenderer(
      executor,
      evidencePolicy,
      settings.timeoutMs,
      input.displayLocale ?? input.locale ?? "zh-CN",
    );
    return {
      markdown: await renderer.render(input.manifest, input.reports, merged, allowedSequences),
      failedAgents: merged.failedAgents,
    };
  } finally {
    await executor.close();
  }
}
