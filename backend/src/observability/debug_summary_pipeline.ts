/** Agent-assisted replay audit pipeline orchestration. */
import { createAuditAgentExecutor } from "../ai/audit/audit_agent_executor";
import { loadRuntimeConfig, resolveAgentProfileByName } from "../runtime/config/runtime_config";
import { AuditEvidencePolicy } from "./audit_evidence_policy";
import { buildAuditTasks } from "./audit_payload_builder";
import { AuditSummaryRenderer } from "./audit_summary_renderer";
import { AuditTaskRunner } from "./audit_task_runner";
import {
  ReplayDebugReport,
  ReplayLogicOp,
  ReplayManifest,
  ReplayPlayerView,
  ReplayPublicEvent,
} from "./types";

export interface DebugSummaryPipelineInput {
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

/**
 * Executes the audit pipeline while keeping executor lifecycle explicit.
 * Deterministic evidence filtering always runs between inspection and rendering.
 */
export async function buildDebugSummaryWithAgents(
  input: DebugSummaryPipelineInput,
): Promise<PipelineResult | null> {
  if (input.reports.length === 0) return null;

  const runtime = await loadRuntimeConfig();
  if (runtime.debugSummary?.agent?.enabled === false) return null;
  const profile = resolveAgentProfileByName(
    runtime,
    runtime.debugSummary?.agent?.agentName ??
      runtime.game?.debugSummaryAgent ??
      runtime.game?.agent,
  );
  const settings = {
    timeoutMs: runtime.debugSummary?.agent?.timeoutMs ?? 15000,
    maxAttempts: Math.max(1, runtime.debugSummary?.agent?.maxAttempts ?? 2),
    concurrency: Math.max(1, runtime.debugSummary?.agent?.concurrency ?? 4),
    publicMaxItems: Math.max(60, runtime.debugSummary?.agent?.publicMaxItems ?? 200),
    maxItems: Math.max(50, runtime.debugSummary?.agent?.maxItems ?? 200),
    playerMaxItems: Math.max(60, runtime.debugSummary?.agent?.playerMaxItems ?? 120),
  };
  const executor = createAuditAgentExecutor({
    profile,
    workspaceRoot: `${input.sessionDir}/audit-workspaces`,
    llmOverride: runtime.debugSummary?.agent?.profile ?? {},
  });
  if (!executor) return null;

  try {
    const tasks = buildAuditTasks(input, settings);
    const runner = new AuditTaskRunner(executor, input.manifest.session_id, settings);
    const outputs = await runner.run(tasks);
    const evidencePolicy = new AuditEvidencePolicy();
    const merged = evidencePolicy.merge(outputs);
    const allowedSequences = evidencePolicy.allowedSequences(input);
    const filtered = evidencePolicy.filterByEvidence(merged.findings, allowedSequences);
    merged.findings = filtered.findings;
    merged.missingInfo.push(
      ...filtered.dropped.map((note) => `dropped: ${note}`),
    );
    const renderer = new AuditSummaryRenderer(
      executor,
      evidencePolicy,
      settings.timeoutMs,
    );
    return {
      markdown: await renderer.render(
        input.manifest,
        input.reports,
        merged,
        allowedSequences,
      ),
      failedAgents: merged.failedAgents,
    };
  } finally {
    await executor.close();
  }
}
