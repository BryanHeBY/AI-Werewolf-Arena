import { describe, expect, test } from "bun:test";
import { promises as fs } from "node:fs";
import * as path from "node:path";
import { createTestTempDirectory } from "../../support/drivers/temp-directories";
import { bootstrapGame } from "../../../src/app/bootstrap";
import { AcpActionProvider } from "../../../src/ai/agents/acp/acp_action_provider";
import { AcpSession, AcpSessionFactory } from "../../../src/ai/integrations/acp/session";
import { runWithSessionRecorder } from "../../../src/recording/recording_context";
import { SessionRecordManager } from "../../../src/recording/session_recorder";
import { sixPlayerMvpConfig } from "../../../src/runtime/scenarios/six_player_mvp";
import { speakRequest } from "../../support/builders/agents/acp-requests";

describe("AcpActionProvider", () => {
  test("records ACP turns and report_bug with the same replay audit schema", async () => {
    const context = bootstrapGame(sixPlayerMvpConfig);
    const recordRoot = await createTestTempDirectory("awa-acp-audit-");
    const recorder = await SessionRecordManager.create(
      {
        sessionId: "session_acp_audit",
        board: "six_player_mvp",
        startedAtIso: new Date().toISOString(),
      },
      recordRoot,
    );
    const factory: AcpSessionFactory = {
      async createSession(input): Promise<AcpSession> {
        return {
          sessionId: "audit-session",
          async prompt(prompt: string): Promise<void> {
            const turnId = /当前回合 ID：(\S+)/.exec(prompt)?.[1] ?? "";
            expect(
              input.registry.reportBug("audit-session", {
                turn_id: turnId,
                category: "flow",
                severity: "high",
                message: "测试：阶段状态明显矛盾",
              }),
            ).toEqual({ ok: true, accepted: true });
            expect(
              input.registry.reportBug("audit-session", {
                turn_id: turnId,
                category: "flow",
                severity: "high",
                message: "测试：同阶段重复上报",
              }),
            ).toEqual({
              ok: true,
              accepted: false,
              dropped: true,
              reason: "report_bug_scope_rate_limited",
            });
            input.registry.submitAction("audit-session", {
              turn_id: turnId,
              action: "speak",
              arguments: { text: "审计动作已提交。" },
            });
          },
          async cancel(): Promise<void> {},
          async close(): Promise<void> {},
          takeAuditTrace() {
            return {
              thoughts: ["正在核对阶段信息"],
              messages: ["将通过 MCP 提交行动"],
            };
          },
        };
      },
    };
    const provider = new AcpActionProvider(context.world, {
      sessionFactory: factory,
      turnTimeoutMs: 1000,
    });

    try {
      await expect(
        runWithSessionRecorder(recorder, () => provider.getAction(speakRequest())),
      ).resolves.toEqual({
        name: "speak",
        args: { text: "审计动作已提交。" },
      });
      await recorder.flushNow();
      const player = JSON.parse(
        await fs.readFile(
          path.join(recordRoot, "session_acp_audit", "players", "player_1.json"),
          "utf-8",
        ),
      );
      const turn = player.timeline.find((entry: any) => entry.kind === "turn");
      expect(turn).toBeDefined();
      expect(
        turn.delta_messages.some(
          (item: any) =>
            item.kind === "assistant_output" && item.content.includes("正在核对阶段信息"),
        ),
      ).toBe(true);
      expect(
        turn.delta_messages.some(
          (item: any) =>
            item.kind === "tool_call" && item.name === "speak" && item.accepted === true,
        ),
      ).toBe(true);
      expect(player.initial_prompt.prompt_user[0]).toContain("transport=acp_mcp");

      const reports = JSON.parse(
        await fs.readFile(
          path.join(recordRoot, "session_acp_audit", "debug_reports.json"),
          "utf-8",
        ),
      );
      expect(reports.reports).toHaveLength(1);
      expect(reports.reports[0]).toMatchObject({
        actor_id: 1,
        day: 1,
        phase: "day",
        stage: "day_speech",
        category: "flow",
        severity: "high",
      });
    } finally {
      await provider.close();
    }
  });

  test("accepts an action only through the MCP bridge bound to its session", async () => {
    const context = bootstrapGame(sixPlayerMvpConfig);
    let cancelled = 0;
    let sessionsCreated = 0;
    const prompts: string[] = [];
    const factory: AcpSessionFactory = {
      async createSession(input): Promise<AcpSession> {
        sessionsCreated += 1;
        expect(input.initialPrompt).toContain("你的唯一目标是帮助你所在阵营赢得本局");
        expect(input.initialPrompt).toContain("你的性格与发言风格要求：先总结事实，再提出问题。");
        expect(input.initialPrompt).not.toContain("MCP 协议");
        expect(input.initialPrompt).not.toContain("werewolf-game");
        expect(input.initialPrompt).not.toContain("speak_to_wolves.text");
        return {
          sessionId: "fake-session-1",
          async prompt(prompt: string): Promise<void> {
            prompts.push(prompt);
            const turnId = /当前回合 ID：(\S+)/.exec(prompt)?.[1];
            expect(turnId).toBeDefined();
            expect(prompt).toContain("MCP 服务 werewolf-game 的 submit_action");
            expect(prompt).toContain(`参数 turn_id 必须为 ${turnId}`);
            const response = input.registry.submitAction("fake-session-1", {
              turn_id: turnId!,
              action: "speak",
              arguments: { text: "这是 MCP 工具提交的行动。" },
            });
            expect(response).toEqual({ ok: true, accepted: true, applied: false, action: "speak" });
          },
          async cancel(): Promise<void> {
            cancelled += 1;
          },
          async close(): Promise<void> {},
        };
      },
    };
    const provider = new AcpActionProvider(context.world, {
      sessionFactory: factory,
      turnTimeoutMs: 1000,
      personalityPromptResolver: () => "先总结事实，再提出问题。",
    });

    await expect(provider.getAction(speakRequest())).resolves.toEqual({
      name: "speak",
      args: { text: "这是 MCP 工具提交的行动。" },
    });
    // 同一 ACP session 会复用，但每一回合由不同的 turn_id 防重放。
    await expect(provider.getAction(speakRequest())).resolves.toEqual({
      name: "speak",
      args: { text: "这是 MCP 工具提交的行动。" },
    });
    expect(sessionsCreated).toBe(1);
    expect(cancelled).toBe(2);
    expect(prompts[0]).toContain('{"events":[[1,"phase_changed",{"day":1,"phase":"day"}]]}');
    expect(prompts[1]).not.toContain('"phase_changed"');
    await provider.close();
  });

  test("falls back as soon as a required ACP turn ends without submit_action", async () => {
    const context = bootstrapGame(sixPlayerMvpConfig);
    const factory: AcpSessionFactory = {
      async createSession(): Promise<AcpSession> {
        return {
          sessionId: "empty-session",
          async prompt(): Promise<void> {},
          async cancel(): Promise<void> {},
          async close(): Promise<void> {},
        };
      },
    };
    const provider = new AcpActionProvider(context.world, {
      sessionFactory: factory,
      turnTimeoutMs: 60_000,
      fallbackProvider: {
        async getAction() {
          return { name: "speak", args: { text: "立即回退。" } };
        },
      },
    });

    const startedAt = Date.now();
    const required = speakRequest();
    required.context.turn_constraints = { min_valid_actions: 1, max_valid_actions: 1 };
    await expect(provider.getAction(required)).resolves.toEqual({
      name: "speak",
      args: { text: "立即回退。" },
    });
    expect(Date.now() - startedAt).toBeLessThan(1_000);
    await provider.close();
  });
});
