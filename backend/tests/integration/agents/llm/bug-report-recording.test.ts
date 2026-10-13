/**
 * 集成测试验证 bug-report-recording 的既有传输、回合与显式特权回退边界。输入为原假客户端、请求、取消／期限和回调控制；预期来自原手写动作、引用、记录与拒绝断言。特权 provider 保留原请求及测试状态控制，不进入默认生产观察策略。
 */
import { describe, expect, test } from "bun:test";
import { bootstrapGame } from "../../../../src/app/bootstrap";
import { COMPONENT } from "../../../../src/core/domain/components/names";
import { RoleComponent } from "../../../../src/core/domain/components/role";
import { Phase } from "../../../../src/core/domain/model";
import { sixPlayerMvpConfig } from "../../../../src/runtime/scenarios/six_player_mvp";
import { LlmActionProvider } from "../../../../src/ai/agents/llm/llm_action_provider";
import { runWithSessionRecorder } from "../../../../src/recording/recording_context";
import { SessionRecordManager } from "../../../../src/recording/session_recorder";
import path from "path";
import { promises as fs } from "fs";
import { createTestTempDirectory } from "../../../support/drivers/temp-directories";
import {
  REQUIRED_ACTION_CONSTRAINTS,
  ReportThenSpeakToolLoopClient,
  DuplicateReportThenSpeakToolLoopClient,
  FallbackProvider,
} from "../../../support/drivers/agents/llm-clients";

describe("LlmActionProvider audit", () => {
  test("should accept report_bug as optional tool and continue to final action", async () => {
    const root = await createTestTempDirectory("awa-report-bug-");
    const recorder = await SessionRecordManager.create(
      {
        sessionId: "session_report_bug_test",
        board: "six_player_mvp",
        startedAtIso: new Date("2026-04-11T00:00:00.000Z").toISOString(),
      },
      root,
    );
    const context = bootstrapGame(sixPlayerMvpConfig);
    const provider = new LlmActionProvider(context.world, new ReportThenSpeakToolLoopClient(), {
      privilegedFallbackProvider: new FallbackProvider(null),
    });

    const action = await runWithSessionRecorder(recorder, async () =>
      provider.getAction({
        phase: Phase.Day,
        actorId: 1,
        allowedTools: ["speak"],
        context: {
          visible_events: [],
          day: 1,
          stage: "day_speech",
          turn_constraints: REQUIRED_ACTION_CONSTRAINTS,
        },
      }),
    );

    expect(action).toEqual({
      name: "speak",
      args: { text: "继续发言" },
    });

    await recorder.finalize({
      endedAtIso: new Date("2026-04-11T00:00:01.000Z").toISOString(),
      winner: null,
      finishReason: "test_done",
      players: context.world.entityIds().map((id) => ({
        player_id: id,
        role: context.world.getComponent(id, COMPONENT.Role)?.role ?? "unknown",
        camp: context.world.getComponent(id, COMPONENT.Role)?.camp ?? "unknown",
        alive: true,
      })),
    });

    const reports = JSON.parse(
      await fs.readFile(path.join(root, "session_report_bug_test", "debug_reports.json"), "utf-8"),
    );
    expect(reports.reports.length).toBe(1);
    expect(reports.reports[0].category).toBe("flow");
    expect(reports.reports[0].severity).toBe("high");
  });

  test("should rate-limit duplicated report_bug in same stage", async () => {
    const root = await createTestTempDirectory("awa-report-bug-dup-");
    const recorder = await SessionRecordManager.create(
      {
        sessionId: "session_report_bug_dedupe_test",
        board: "six_player_mvp",
        startedAtIso: new Date("2026-04-11T00:00:00.000Z").toISOString(),
      },
      root,
    );
    const context = bootstrapGame(sixPlayerMvpConfig);
    const provider = new LlmActionProvider(
      context.world,
      new DuplicateReportThenSpeakToolLoopClient(),
      {
        privilegedFallbackProvider: new FallbackProvider(null),
      },
    );

    const action = await runWithSessionRecorder(recorder, async () =>
      provider.getAction({
        phase: Phase.Day,
        actorId: 1,
        allowedTools: ["speak"],
        context: {
          visible_events: [],
          day: 1,
          stage: "day_speech",
          turn_constraints: REQUIRED_ACTION_CONSTRAINTS,
        },
      }),
    );
    expect(action).toEqual({
      name: "speak",
      args: { text: "继续发言" },
    });

    await recorder.finalize({
      endedAtIso: new Date("2026-04-11T00:00:01.000Z").toISOString(),
      winner: null,
      finishReason: "test_done",
      players: context.world.entityIds().map((id) => ({
        player_id: id,
        role: context.world.getComponent(id, COMPONENT.Role)?.role ?? "unknown",
        camp: context.world.getComponent(id, COMPONENT.Role)?.camp ?? "unknown",
        alive: true,
      })),
    });

    const reports = JSON.parse(
      await fs.readFile(
        path.join(root, "session_report_bug_dedupe_test", "debug_reports.json"),
        "utf-8",
      ),
    );
    expect(reports.reports.length).toBe(1);

    const logicOps = JSON.parse(
      await fs.readFile(
        path.join(root, "session_report_bug_dedupe_test", "logic_ops.json"),
        "utf-8",
      ),
    );
    expect(
      logicOps.ops.some(
        (op: any) =>
          op.op === "report_bug_dropped" && op.reason === "report_bug_scope_rate_limited",
      ),
    ).toBe(true);
  });
});
