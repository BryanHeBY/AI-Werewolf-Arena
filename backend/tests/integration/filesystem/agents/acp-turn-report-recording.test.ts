/**
 * 负责文件系统集成测试，核对 ACP 回合／思考／工具及限频 report_bug 在共用复盘内层格式持久化。
 * 输入为原 ACP 会话回调、实际录制 scope 及临时玩家／报告文件；输出由字面行动、回执／限频、时间线与报告字段核对。
 * 新外层封装不改内层记录和预期，不启动真实 ACP 服务或模型。
 */
import { readReplayPlayerView } from "@ai-werewolf-arena/replay-contract";
import { describe, expect, test } from "bun:test";
import { promises as fs } from "node:fs";
import * as path from "node:path";
import { createTestTempDirectory } from "../../../support/drivers/temp-directories";
import { bootstrapGame } from "../../../../src/app/bootstrap";
import { AcpActionProvider } from "../../../../src/agents/acp/acp-action-provider";
import { AcpSession, AcpSessionFactory } from "../../../../src/adapters/acp/session";
import { runWithSessionRecorder } from "../../../../src/recording/session/context";
import { SessionRecordManager } from "../../../../src/recording/session/recorder";
import { sixPlayerMvpConfig } from "../../../../src/rulesets/presets/six-player-mvp";
import { speakRequest } from "../../../support/builders/agents/acp-requests";

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
      const player = readReplayPlayerView(
        JSON.parse(
          await fs.readFile(
            path.join(recordRoot, "session_acp_audit", "players", "player_1.json"),
            "utf-8",
          ),
        ),
      );
      const turn = player.timeline.find(
        (entry: any) => entry.kind === "turn",
      ) as import("@ai-werewolf-arena/replay-contract").ReplayPlayerTurnEntry;
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
      expect(player.initial_prompt!.prompt_user![0]).toContain("transport=acp_mcp");

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
});
