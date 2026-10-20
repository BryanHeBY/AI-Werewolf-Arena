/**
 * 单元测试以字面 manifest／task context、本地受控 executor 和无全局状态的汉字正则为输入，核对审计提示、并发重试语言及证据过滤保留原玩家事实／发言。手写标题／消息、重试／context 次数及诊断排除为预期；不创建会话目录、listener 或审计子进程。
 */
import { auditSummaryFixture } from "../../support/builders/audit-summary";
import { expect, test } from "bun:test";
import { auditSystemPrompt, auditTurnPrompt } from "../../../src/audit/agents/prompts";
import { AuditTaskRunner } from "../../../src/audit/task-runner";
import { AuditSummaryRenderer } from "../../../src/audit/summary-renderer";
import { AuditEvidencePolicy } from "../../../src/audit/evidence-policy";
import { buildAuditTasks } from "../../../src/audit/payload-builder";
import {
  AuditToolTurnRegistry,
  type AuditToolContext,
} from "../../../src/audit/agents/audit-tool-protocol";
import type { DebugSummaryPipelineInput } from "../../../src/audit/pipeline";
import type { ReplayManifest } from "../../../src/recording/contracts";

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

test("shared audit prompts localize both modes without requesting actions during ACP initialization", () => {
  for (const locale of ["zh-CN", "en"] as const) {
    const initial = auditSystemPrompt(locale, true);
    expect(initial).toContain(locale === "en" ? "no turn_id is valid yet" : "尚无有效 turn_id");
    expect(initial).not.toContain(
      locale === "en" ? "First call get_audit_context" : "先调用 get_audit_context 读取当前任务",
    );
    expect(initial).toContain("session.decision");
    expect(initial).toContain(
      locale === "en" ? "individual or relationship victory" : "个人或关系胜利",
    );
    expect(initial).toContain(
      locale === "en" ? "does not override a sealed victory" : "不覆盖已封盘胜利",
    );
    for (const mode of ["inspect", "summarize"] as const) {
      const prompt = auditTurnPrompt("a7", mode, locale);
      expect(prompt).toContain("a7");
      expect(prompt).toContain(mode);
      if (locale === "en") expect(auditSystemPrompt(locale) + initial + prompt).not.toMatch(han);
    }
  }
});

test("inspection task locales survive parallel retries while final summary has its own language", async () => {
  const contexts: AuditToolContext[] = [];
  const counts = new Map<string, number>();
  const executor = {
    async close() {},
    async runTurn(context: AuditToolContext) {
      contexts.push(structuredClone(context));
      const attempt = (counts.get(context.taskName) ?? 0) + 1;
      counts.set(context.taskName, attempt);
      if (context.mode === "inspect")
        return attempt === 1
          ? null
          : {
              kind: "findings" as const,
              agent: context.taskName,
              findings: [],
              notes: [],
              missing_info: [],
            };
      return {
        kind: "summary" as const,
        markdown: auditSummaryFixture(context.locale ?? "zh-CN", undefined, "Original 模型报告"),
      };
    },
  };
  const input: DebugSummaryPipelineInput = {
    locale: "en",
    displayLocale: "zh-CN",
    manifest,
    reports: [],
    publicEvents: [],
    logicOps: [],
    playerViews: [{ player_id: 1, role: "wolf", camp: "wolf", timeline: [] }],
    sessionDir: "/tmp/synthetic",
  };
  const before = structuredClone(input);
  const tasks = buildAuditTasks(input, { publicMaxItems: 10, maxItems: 10, playerMaxItems: 10 });
  expect(tasks.map((task) => task.locale)).toEqual(["en", "en", "en", "en"]);
  const results = await new AuditTaskRunner(executor, manifest.session_id, {
    concurrency: 2,
    timeoutMs: 1000,
    maxAttempts: 2,
  }).run(tasks);
  expect(results.every((result) => !result.failed)).toBe(true);
  expect(contexts.length).toBe(8);
  expect(contexts.every((context) => context.locale === "en")).toBe(true);
  const summary = new AuditSummaryRenderer(
    executor,
    new AuditEvidencePolicy(),
    1000,
    input.displayLocale,
  );
  expect(
    await summary.render(
      manifest,
      [],
      { findings: [], missingInfo: [], failedAgents: [], totalAgents: 4 },
      new Set(),
    ),
  ).toContain("Original 模型报告");
  expect(contexts.at(-1)?.locale).toBe("zh-CN");
  expect(contexts.at(-1)?.mode).toBe("summarize");
  expect(input).toEqual(before);
});

test("audit getContext excludes transport exceptions and arbitrary diagnostics in both languages while preserving game facts and original speech", () => {
  for (const locale of ["zh-CN", "en"] as const) {
    const input: DebugSummaryPipelineInput = {
      locale,
      manifest,
      reports: [],
      playerViews: [],
      sessionDir: "/tmp/synthetic",
      publicEvents: [
        {
          seq: 1,
          timestamp: "2026-10-08T00:00:00.000Z",
          day: 1,
          phase: "day",
          stage: "day_speech",
          type: "day_speech",
          payload: { playerId: 1, text: "Original 玩家原话" },
        },
      ],
      logicOps: [
        {
          seq: 2,
          timestamp: "2026-10-08T00:00:00.000Z",
          scope: "llm_action_provider",
          op: "action_provider_error",
          actor_id: 1,
          phase: "night",
          status: "error",
          reason: "Error: Bearer PRIVATE_TRANSPORT_SECRET",
          input: { endpoint: "PRIVATE_TRANSPORT_SECRET" },
          output: { headers: "PRIVATE_TRANSPORT_SECRET" },
        },
        {
          seq: 3,
          timestamp: "2026-10-08T00:00:00.000Z",
          scope: "gateway",
          op: "validate_tool_call",
          actor_id: 1,
          phase: "day",
          status: "rejected",
          reason: "guard_repeat",
          input: { tool: "speak", args: { text: "Original 玩家原话" } },
        },
        {
          seq: 4,
          timestamp: "2026-10-08T00:00:00.000Z",
          scope: "llm_action_provider",
          op: "llm_fallback",
          actor_id: 1,
          phase: "night",
          status: "fallback",
          reason: "runtime_error",
        },
      ],
    };
    const before = structuredClone(input);
    const tasks = buildAuditTasks(input, { publicMaxItems: 10, maxItems: 10, playerMaxItems: 10 });
    for (const task of tasks) {
      const registry = new AuditToolTurnRegistry(locale);
      const turn = registry.openTurn(
        {
          mode: "inspect",
          locale,
          taskName: task.name,
          source: task.source,
          payload: task.payload,
        },
        "own-session",
      );
      const reply = registry.getContext("own-session", { turn_id: turn.turnId });
      expect(JSON.stringify(reply)).not.toContain("PRIVATE_TRANSPORT_SECRET");
      if (task.name === "agent_logic" && reply.ok && reply.context) {
        const ops = (reply.context.payload as any).ops;
        expect(ops[0]).toEqual({
          seq: 2,
          scope: "llm_action_provider",
          op: "action_provider_error",
          actor_id: 1,
          phase: "night",
          status: "error",
          reason: "runtime_error",
        });
        expect(ops[1].reason).toBe("guard_repeat");
        expect(ops[1].input).toContain("Original 玩家原话");
        expect(ops[2].reason).toBe("runtime_error");
      }
      if (task.name === "agent_public") {
        expect(JSON.stringify(reply)).toContain("Original 玩家原话");
        if (reply.ok && reply.context)
          expect((reply.context.payload as any).events[0].actorId).toBe(1);
      }
      registry.closeTurn();
    }
    expect(input).toEqual(before);
  }
});
