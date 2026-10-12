/**
 * Agent/recording integration verify LLM report_bug acceptance and same-stage duplicate suppression.
 * Input: Injected native-tool clients, optional reports and temporary scoped recorder files.
 * Output and independent oracle: Literal final action, report counts and dropped-report reason in saved logic operations.
 * The test never calls a billed model or rewrites expected fixture/Tape bytes.
 */
import { describe, expect, test } from "bun:test";
import { bootstrapGame } from "../../../src/app/bootstrap";
import { COMPONENT } from "../../../src/core/domain/components/names";
import { RoleComponent } from "../../../src/core/domain/components/role";
import { Phase } from "../../../src/core/domain/model";
import { sixPlayerMvpConfig } from "../../../src/runtime/scenarios/six_player_mvp";
import { LlmActionProvider } from "../../../src/ai/agents/llm/llm_action_provider";
import { runWithSessionRecorder } from "../../../src/recording/recording_context";
import { SessionRecordManager } from "../../../src/recording/session_recorder";
import path from "path";
import { promises as fs } from "fs";
import { createTestTempDirectory } from "../../support/drivers/temp-directories";
import {
  REQUIRED_ACTION_CONSTRAINTS,
  ReportThenSpeakToolLoopClient,
  DuplicateReportThenSpeakToolLoopClient,
  FallbackProvider,
} from "../../support/llm_provider_clients";

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
      fallbackProvider: new FallbackProvider(null),
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
        role: context.world.getComponent<RoleComponent>(id, COMPONENT.Role)?.role ?? "unknown",
        camp: context.world.getComponent<RoleComponent>(id, COMPONENT.Role)?.camp ?? "unknown",
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
        fallbackProvider: new FallbackProvider(null),
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
        role: context.world.getComponent<RoleComponent>(id, COMPONENT.Role)?.role ?? "unknown",
        camp: context.world.getComponent<RoleComponent>(id, COMPONENT.Role)?.camp ?? "unknown",
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
