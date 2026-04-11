import { promises as fs } from "fs";
import os from "os";
import path from "path";
import { Camp } from "../../src/domain/model";
import { SessionRecordManager } from "../../src/session_recording";

describe("SessionRecordManager", () => {
  test("should create session folder and persist replay json files", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "awa-replay-"));
    const manager = await SessionRecordManager.create(
      {
        sessionId: "session_test_1",
        board: "six_player_mvp",
        startedAtIso: new Date("2026-04-10T00:00:00.000Z").toISOString(),
      },
      root,
    );

    manager.recordPublicEvent({
      type: "phase_changed",
      timestampMs: Date.now(),
      phase: "night",
      day: 1,
      payload: { phase: "night", day: 1 },
      renderText: "[上帝] 天黑请闭眼（第1天夜晚）",
    });
    manager.recordLogicOp({
      scope: "gateway",
      op: "validate_tool_call",
      actorId: 1,
      phase: "night",
      status: "ok",
      input: { tool: "speak_to_wolves" },
    });
    manager.recordPlayerBroadcast({
      playerId: 1,
      role: "wolf",
      camp: "wolf",
      day: 1,
      phase: "night",
      stage: "wolf_discussion",
      requestId: "1-night-1-broadcast-1",
      text: "[系统][公开] 天黑请闭眼（第1天夜晚）",
    });
    manager.recordPlayerRound({
      playerId: 1,
      role: "wolf",
      camp: "wolf",
      day: 1,
      phase: "night",
      stage: "wolf_discussion",
      requestId: "1-night-1-1",
      visibleFeedDelta: [],
      feedCursorBefore: 0,
      feedCursorAfter: 1,
      promptSystem: "仅可调用本轮可用工具：speak_to_wolves",
      promptUserDelta: ["玩家编号=1"],
      actionMode: "tool_call",
      toolCalls: [
        {
          name: "speak_to_wolves",
          args: { text: "test", end_chat: false },
          accepted: true,
          result: { ok: true },
        },
      ],
      finalAction: {
        name: "speak_to_wolves",
        args: { text: "test", end_chat: false },
      },
    });
    manager.recordDebugReport({
      day: 1,
      phase: "day",
      stage: "day_speech",
      actorId: 1,
      actorRole: "wolf",
      actorCamp: "wolf",
      category: "flow",
      severity: "high",
      message: "测试上报：放逐后仍发言",
      evidenceEventSeq: [12, 13],
    });

    await manager.finalize({
      endedAtIso: new Date("2026-04-10T00:00:10.000Z").toISOString(),
      winner: Camp.Wolf,
      finishReason: "all_good_eliminated",
      players: [
        { player_id: 1, role: "wolf", camp: "wolf", alive: true },
        { player_id: 2, role: "wolf", camp: "wolf", alive: true },
      ],
    });

    const sessionDir = path.join(root, "session_test_1");
    const files = await fs.readdir(sessionDir);
    expect(files).toContain("manifest.json");
    expect(files).toContain("public_timeline.json");
    expect(files).toContain("logic_ops.json");
    expect(files).toContain("debug_reports.json");
    expect(files).toContain("debug_summary.md");
    expect(files).toContain("players");

    const manifest = JSON.parse(
      await fs.readFile(path.join(sessionDir, "manifest.json"), "utf-8"),
    );
    expect(manifest.session_id).toBe("session_test_1");
    expect(manifest.files.public_timeline).toBe("public_timeline.json");
    expect(manifest.files.debug_reports).toBe("debug_reports.json");
    expect(manifest.files.debug_summary).toBe("debug_summary.md");

    const publicTimeline = JSON.parse(
      await fs.readFile(path.join(sessionDir, "public_timeline.json"), "utf-8"),
    );
    expect(Array.isArray(publicTimeline.events)).toBe(true);
    expect(publicTimeline.events[0].type).toBe("phase_changed");

    const logicOps = JSON.parse(
      await fs.readFile(path.join(sessionDir, "logic_ops.json"), "utf-8"),
    );
    expect(Array.isArray(logicOps.ops)).toBe(true);
    expect(logicOps.ops[0].op).toBe("validate_tool_call");

    const player1 = JSON.parse(
      await fs.readFile(path.join(sessionDir, "players", "player_1.json"), "utf-8"),
    );
    expect(player1.initial_prompt).toBeDefined();
    expect(player1.initial_prompt.phase).toBe("night");
    expect(Array.isArray(player1.initial_prompt.prompt_user)).toBe(true);
    expect(Array.isArray(player1.timeline)).toBe(true);
    expect(player1.timeline[0].kind).toBe("broadcast");
    expect(player1.timeline[0].stage).toBe("wolf_discussion");
    expect(player1.timeline[1].kind).toBe("tool_call");
    expect(player1.timeline[1].stage).toBe("wolf_discussion");
    expect(player1.timeline[1].name).toBe("speak_to_wolves");
    expect(player1.timeline[1].accepted).toBe(true);

    const debugReports = JSON.parse(
      await fs.readFile(path.join(sessionDir, "debug_reports.json"), "utf-8"),
    );
    expect(Array.isArray(debugReports.reports)).toBe(true);
    expect(debugReports.reports.length).toBe(1);
    expect(debugReports.reports[0].category).toBe("flow");

    const debugSummary = await fs.readFile(
      path.join(sessionDir, "debug_summary.md"),
      "utf-8",
    );
    expect(debugSummary).toContain("## Session");
    expect(debugSummary).toContain("## TODO");
  });

  test("should not emit TODO section when there are no debug reports", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "awa-replay-no-bug-"));
    const manager = await SessionRecordManager.create(
      {
        sessionId: "session_test_no_bug",
        board: "six_player_mvp",
        startedAtIso: new Date("2026-04-10T00:00:00.000Z").toISOString(),
      },
      root,
    );

    await manager.finalize({
      endedAtIso: new Date("2026-04-10T00:00:10.000Z").toISOString(),
      winner: Camp.Wolf,
      finishReason: "all_good_eliminated",
      players: [],
    });

    const summary = await fs.readFile(
      path.join(root, "session_test_no_bug", "debug_summary.md"),
      "utf-8",
    );
    expect(summary).toContain("## Conclusion");
    expect(summary).not.toContain("## TODO");
  });
});
