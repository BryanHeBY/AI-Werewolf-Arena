/**
 * ACP integration tests verify actual audit task subprocesses and the complete summary pipeline preserve locale, evidence and cleanup.
 * Input: Original local adapter fixture, temporary workspaces, mode/locale matrix and literal manifest/report payloads.
 * Output and oracle: Exact prompt/context/summary fields and closed agent/MCP PIDs retain the native process boundary; shared literal metadata does not generate expected game rules.
 */
import { acpAdapterEntry } from "../../../support/fixtures/manifest";
import { auditSummaryFixture } from "../../../support/builders/audit-summary";
import { buildDebugSummaryMarkdown } from "../../../../src/audit/debug_summary_generator";
import { expect, test } from "bun:test";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { AcpAuditAgentExecutor } from "../../../../src/ai/audit/acp_audit_runner";
import type { ReplayManifest } from "../../../../src/recording/contracts";
import { createTestTempDirectory } from "../../../support/drivers/temp-directories";

const han = /[\u4e00-\u9fff]/;

const manifest: ReplayManifest = {
  session_id: "synthetic-audit",
  board: "six_player_mvp",
  started_at: "2026-10-08T00:00:00.000Z",
  ended_at: "2026-10-08T00:01:00.000Z",
  winner: null,
  finish_reason: "completed",
  players: [],
  files: {
    replay: "replay.json",
    logic_ops: "logic_ops.json",
    debug_reports: "debug_reports.json",
    debug_summary: "debug_summary.md",
    player_views: [],
  },
};

for (const locale of ["zh-CN", "en"] as const)
  for (const mode of ["inspect", "summarize"] as const)
    test(`actual ACP and injected MCP audit ${locale}/${mode} preserve prompt language, payload and process cleanup`, async () => {
      const workspace = await createTestTempDirectory("awa-audit-locale-");
      const entry = acpAdapterEntry("audit");
      const executor = new AcpAuditAgentExecutor({
        workspaceRoot: workspace,
        profile: {
          kind: "acp",
          name: "synthetic",
          providerName: "synthetic",
          provider: {
            type: "acp",
            transport: "stdio",
            env: {},
            sessionConfigOptions: {},
            command: process.execPath,
            args: [entry],
          },
        },
      });
      const payload =
        mode === "inspect" ? { events: [{ seq: 7, text: "Original 玩家原话" }] } : { findings: [] };
      let result;
      try {
        result = await executor.runTurn(
          { mode, locale, taskName: "local-audit", source: "synthetic", payload },
          { timeoutMs: 4000 },
        );
      } finally {
        await executor.close();
      }
      expect(result?.kind).toBe(mode === "inspect" ? "findings" : "summary");
      if (result?.kind === "findings") expect(result.notes).toEqual(["Original 模型说明"]);
      if (result?.kind === "summary") expect(result.markdown).toContain("Original 模型报告");
      const trace = JSON.parse(
        await readFile(path.join(workspace, "local-audit-1/audit-fixture.json"), "utf8"),
      );
      expect(trace.locale).toBe(locale);
      expect(trace.prompts.length).toBe(2);
      expect(trace.prompts[0]).toContain(
        locale === "en" ? "no turn_id is valid yet" : "尚无有效 turn_id",
      );
      expect(trace.prompts[1]).toContain("a1");
      expect(JSON.stringify(trace.prompts)).not.toContain("Original 玩家原话");
      if (locale === "en") expect(JSON.stringify(trace.prompts)).not.toMatch(han);
      expect(trace.context.context).toEqual({
        mode,
        task_name: "local-audit",
        source: "synthetic",
        payload,
      });
      expect(trace.stale.error).toBe("audit_turn_not_open_or_session_invalid");
      if (locale === "en") expect(trace.stale.message).not.toMatch(han);
      expect(trace.submission).toEqual({ ok: true, accepted: true });
      expect(typeof trace.agentPid).toBe("number");
      expect(trace.agentPid).toBeGreaterThan(0);
      expect(typeof trace.mcpPid).toBe("number");
      expect(trace.mcpPid).toBeGreaterThan(0);
      expect(() => process.kill(trace.agentPid, 0)).toThrow();
      expect(() => process.kill(trace.mcpPid, 0)).toThrow();
    });

test("complete synthetic generator and pipeline preserve separate inspection and summary languages and close all child processes", async () => {
  await Promise.all(
    (["zh-CN", "en"] as const).map(async (locale) => {
      const displayLocale = locale === "en" ? "zh-CN" : "en";
      const sessionDir = await createTestTempDirectory("awa-audit-pipeline-locale-");
      const profile = {
        kind: "acp" as const,
        name: "synthetic",
        providerName: "synthetic",
        provider: {
          type: "acp" as const,
          transport: "stdio" as const,
          env: {},
          sessionConfigOptions: {},
          command: process.execPath,
          args: [acpAdapterEntry("audit")],
        },
      };
      const markdown = await buildDebugSummaryMarkdown(
        {
          locale,
          displayLocale,
          manifest,
          sessionDir,
          publicEvents: [],
          logicOps: [],
          playerViews: [],
          reports: [
            {
              report_id: "synthetic",
              timestamp: "2026-10-08T00:00:00.000Z",
              day: 1,
              phase: "day",
              stage: "day_speech",
              actor_id: 1,
              actor_role: "wolf",
              actor_camp: "wolf",
              category: "flow",
              severity: "high",
              message: "Original 报告",
              evidence_event_seq: [],
              status: "open",
            },
          ],
        },
        {
          profile,
          timeoutMs: 4000,
          maxAttempts: 1,
          concurrency: 2,
          publicMaxItems: 10,
          maxItems: 10,
          playerMaxItems: 10,
        },
      );
      expect(markdown).toBe(auditSummaryFixture(displayLocale, undefined, "Original 模型报告"));
      const root = path.join(sessionDir, "audit-workspaces");
      const tasks = await readdir(root);
      expect(tasks.length).toBe(4);
      for (const task of tasks) {
        const trace = JSON.parse(
          await readFile(path.join(root, task, "audit-fixture.json"), "utf8"),
        );
        expect(trace.locale).toBe(task.startsWith("agent_summary-") ? displayLocale : locale);
        expect(trace.context.context.mode).toBe(
          task.startsWith("agent_summary-") ? "summarize" : "inspect",
        );
        expect(typeof trace.agentPid).toBe("number");
        expect(trace.agentPid).toBeGreaterThan(0);
        expect(typeof trace.mcpPid).toBe("number");
        expect(trace.mcpPid).toBeGreaterThan(0);
        expect(() => process.kill(trace.agentPid, 0)).toThrow();
        expect(() => process.kill(trace.mcpPid, 0)).toThrow();
      }
    }),
  );
});
