/** Agent-assisted replay audit pipeline orchestration. */
import { createAuditAgentExecutor } from "../ai/audit/executor_factory";
import type { ResolvedAuditConfig } from "../runtime/config/contracts";
import { AuditEvidencePolicy } from "./evidence_policy";
import { buildAuditTasks } from "./payload_builder";
import { AuditSummaryRenderer } from "./summary_renderer";
import { AuditTaskRunner } from "./task_runner";
import {
  ReplayDebugReport,
  ReplayLogicOp,
  ReplayManifest,
  ReplayPlayerView,
  ReplayPublicEvent,
} from "../recording/contracts";

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
