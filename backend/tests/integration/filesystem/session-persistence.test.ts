/**
 * 文件集成测试：验证 SessionRecordManager 落盘公开／玩家时间线、manifest、调试摘要及隔离录制 scope。输入为原临时目录、会话与事件；既有字面文件预期保留真实 I/O 边界，不重新生成 fixture。
 */
import { readReplayPlayerView, readReplayManifest } from "@ai-werewolf-arena/replay-contract";
import { readReplayDocument } from "@ai-werewolf-arena/replay-contract";
import { promises as fs } from "fs";
import path from "path";
import { Camp, Phase } from "../../../src/domain/model";
import { bootstrapGame } from "../../../src/app/bootstrap";
import { sixPlayerMvpConfig } from "../../../src/rulesets/presets/six-player-mvp";
import { buildAgentVisibleEvent } from "../../../src/agents/observation/event-feed";
import { getDefaultScriptEventRenderRegistry } from "../../../src/agents/presentation/event-render-registry";
import { COMPONENT } from "../../../src/domain/components/names";
import { SessionRecordManager, safeRecordLogicOp } from "../../../src/recording/session/recorder";
import { runWithSessionRecorder } from "../../../src/recording/session/context";
import { buildDebugSummaryMarkdown } from "../../../src/audit/debug-summary-generator";
import { createTestTempDirectory } from "../../support/drivers/temp-directories";

async function finalizeManager(
  manager: SessionRecordManager,
  meta: Parameters<SessionRecordManager["finalize"]>[0],
): Promise<void> {
  const summaryInput = await manager.finalize(meta);
  await manager.writeDebugSummary(await buildDebugSummaryMarkdown(summaryInput, null));
}

describe("SessionRecordManager", () => {
  test("should persist timeline and player files during game before finalize", async () => {
    const root = await createTestTempDirectory("awa-realtime-");
    const manager = await SessionRecordManager.create(
      {
        sessionId: "session_realtime_1",
        board: "six_player_mvp",
        startedAtIso: new Date("2026-04-11T00:00:00.000Z").toISOString(),
      },
      root,
    );

    manager.recordPublicEvent({
      type: "phase_changed",
      timestampMs: Date.now(),
      phase: "night",
      day: 1,
      payload: { phase: "night", day: 1 },
    });
    manager.recordLogicOp({
      scope: "phase_pipeline",
      op: "night_pipeline_start",
      phase: "night",
      status: "ok",
    });
    manager.recordPlayerEvent({
      playerId: 1,
      role: "wolf",
      camp: "wolf",
      day: 1,
      phase: "night",
      stage: "wolf_discussion",
      requestId: "1-night-1-event-1",
      event: { seq: 1, type: "phase_changed", payload: { phase: "night", day: 1 } },
    });
    manager.recordPlayerRound({
      playerId: 1,
      role: "wolf",
      camp: "wolf",
      day: 1,
      phase: "night",
      stage: "wolf_discussion",
      requestId: "1-night-1-1",
      actionMode: "none",
      toolCalls: [],
    });
    manager.recordDebugReport({
      day: 1,
      phase: "night",
      stage: "wolf_discussion",
      actorId: 1,
      actorRole: "wolf",
      actorCamp: "wolf",
      category: "flow",
      severity: "low",
      message: "realtime test",
      evidenceEventSeq: [1],
    });

    await manager.flushNow();

    const sessionDir = path.join(root, "session_realtime_1");
    const replay = readReplayDocument(
      JSON.parse(await fs.readFile(path.join(sessionDir, "replay.json"), "utf-8")),
    );
    const logic = JSON.parse(await fs.readFile(path.join(sessionDir, "logic_ops.json"), "utf-8"));
    const player1 = readReplayPlayerView(
      JSON.parse(await fs.readFile(path.join(sessionDir, "players", "player_1.json"), "utf-8")),
    );
    const reports = JSON.parse(
      await fs.readFile(path.join(sessionDir, "debug_reports.json"), "utf-8"),
    );

    expect(replay.events.length).toBe(1);
    expect(logic.ops.length).toBe(1);
    expect(Array.isArray(player1.timeline)).toBe(true);
    expect(player1.timeline.length).toBeGreaterThanOrEqual(1);
    expect(reports.reports.length).toBe(1);
  });

  test("should record structured player event stage without mixing", async () => {
    const root = await createTestTempDirectory("awa-replay-stage-");
    const manager = await SessionRecordManager.create(
      {
        sessionId: "session_stage_1",
        board: "six_player_mvp",
        startedAtIso: new Date("2026-04-11T00:00:00.000Z").toISOString(),
      },
      root,
    );
    const context = bootstrapGame(sixPlayerMvpConfig);
    const registry = getDefaultScriptEventRenderRegistry();
    const events = [
      {
        timestamp: Date.now(),
        type: "phase_changed",
        payload: { phase: Phase.Night, day: 1 },
      },
      {
        timestamp: Date.now(),
        type: "night_resolved",
        payload: { wolfTarget: 1, deaths: [] },
      },
    ];
    const playerId = 1;
    const role = context.world.getComponent(playerId, COMPONENT.Role);
    for (let index = 0; index < events.length; index += 1) {
      const event = events[index];
      const visibleEvent = buildAgentVisibleEvent(context.world, event as any, playerId, index + 1);
      expect(visibleEvent).toBeTruthy();
      manager.recordPlayerEvent({
        playerId,
        role: role?.role ?? "unknown",
        camp: (role && context.world.getComponent(playerId, COMPONENT.Camp)?.camp) ?? "unknown",
        day: 1,
        phase: Phase.Night,
        stage: registry.toReplayStage(event as any),
        requestId: `1-night-${playerId}-event-${event.type}`,
        event: visibleEvent!,
      });
    }
    await manager.flushNow();
    const view = readReplayPlayerView(
      JSON.parse(
        await fs.readFile(path.join(root, "session_stage_1", "players", "player_1.json"), "utf-8"),
      ),
    );
    const stages = view.timeline.map((entry: any) => entry.stage);
    expect(stages).toContain("night");
    expect(stages).toContain("night_resolved");
  });

  test("should create session folder and persist replay json files", async () => {
    const root = await createTestTempDirectory("awa-replay-");
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
    });
    manager.recordLogicOp({
      scope: "gateway",
      op: "validate_tool_call",
      actorId: 1,
      phase: "night",
      status: "ok",
      input: { tool: "speak_to_wolves" },
    });
    manager.recordPlayerEvent({
      playerId: 1,
      role: "wolf",
      camp: "wolf",
      day: 1,
      phase: "night",
      stage: "wolf_discussion",
      requestId: "1-night-1-event-1",
      event: { seq: 1, type: "phase_changed", payload: { phase: "night", day: 1 } },
    });
    manager.recordPlayerRound({
      playerId: 1,
      role: "wolf",
      camp: "wolf",
      day: 1,
      phase: "night",
      stage: "wolf_discussion",
      requestId: "1-night-1-1",
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

    await finalizeManager(manager, {
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
    expect(files).toContain("replay.json");
    expect(files).not.toContain("public_timeline.json");
    expect(files).toContain("phase_windows.json");
    expect(files).toContain("timeline_index.json");
    expect(files).toContain("logic_ops.json");
    expect(files).toContain("debug_reports.json");
    expect(files).toContain("debug_summary.md");
    expect(files).toContain("players");

    const manifest = readReplayManifest(
      JSON.parse(await fs.readFile(path.join(sessionDir, "manifest.json"), "utf-8")),
    );
    expect(manifest.session_id).toBe("session_test_1");
    expect(manifest.files.replay).toBe("replay.json");
    expect(manifest.files.phase_windows).toBe("phase_windows.json");
    expect(manifest.files.timeline_index).toBe("timeline_index.json");
    expect(manifest.files.debug_reports).toBe("debug_reports.json");
    expect(manifest.files.debug_summary).toBe("debug_summary.md");

    const replay = readReplayDocument(
      JSON.parse(await fs.readFile(path.join(sessionDir, "replay.json"), "utf-8")),
    );
    expect(replay.sessionId).toBe("session_test_1");
    expect(Array.isArray(replay.events)).toBe(true);
    expect(replay.events[0].type).toBe("phase_changed");
    expect(new Set(replay.events.map((event: any) => event.seq)).size).toBe(replay.events.length);
    expect(replay.players).toEqual([
      { player_id: 1, role: "wolf", camp: "wolf" },
      { player_id: 2, role: "wolf", camp: "wolf" },
    ]);
    expect(replay).not.toHaveProperty("phaseWindows");
    expect(replay).not.toHaveProperty("logicOps");
    expect(replay).not.toHaveProperty("playerViews");

    const phaseWindows = JSON.parse(
      await fs.readFile(path.join(sessionDir, "phase_windows.json"), "utf-8"),
    );
    expect(Array.isArray(phaseWindows.windows)).toBe(true);
    expect(phaseWindows.windows.length).toBeGreaterThan(0);
    expect(phaseWindows.windows[0].phase_id).toBe("d1-night");

    const timelineIndex = JSON.parse(
      await fs.readFile(path.join(sessionDir, "timeline_index.json"), "utf-8"),
    );
    expect(timelineIndex.public.count).toBe(1);
    expect(timelineIndex.public.min_seq).toBe(1);
    expect(timelineIndex.public.max_seq).toBe(1);
    expect(timelineIndex.players["1"].count).toBe(2);

    const logicOps = JSON.parse(
      await fs.readFile(path.join(sessionDir, "logic_ops.json"), "utf-8"),
    );
    expect(Array.isArray(logicOps.ops)).toBe(true);
    expect(logicOps.ops[0].op).toBe("validate_tool_call");

    const player1 = readReplayPlayerView(
      JSON.parse(await fs.readFile(path.join(sessionDir, "players", "player_1.json"), "utf-8")),
    );
    expect(player1.initial_prompt).toBeDefined();
    expect(player1.initial_prompt!.phase).toBe("night");
    expect(Array.isArray(player1.initial_prompt!.prompt_user)).toBe(true);
    expect(Array.isArray(player1.timeline)).toBe(true);
    expect(player1.timeline[0].kind).toBe("event");
    expect(
      (player1.timeline[0] as import("@ai-werewolf-arena/replay-contract").ReplayPlayerEventEntry)
        .event.type,
    ).toBe("phase_changed");
    expect(player1.timeline[0].stage).toBe("wolf_discussion");
    expect(player1.timeline[1].kind).toBe("turn");
    expect(player1.timeline[1].stage).toBe("wolf_discussion");
    expect(
      Array.isArray(
        (player1.timeline[1] as import("@ai-werewolf-arena/replay-contract").ReplayPlayerTurnEntry)
          .delta_messages,
      ),
    ).toBe(true);
    expect(
      (
        player1.timeline[1] as import("@ai-werewolf-arena/replay-contract").ReplayPlayerTurnEntry
      ).delta_messages.some(
        (item: any) => item.kind === "tool_call" && item.name === "speak_to_wolves",
      ),
    ).toBe(true);

    const debugReports = JSON.parse(
      await fs.readFile(path.join(sessionDir, "debug_reports.json"), "utf-8"),
    );
    expect(Array.isArray(debugReports.reports)).toBe(true);
    expect(debugReports.reports.length).toBe(1);
    expect(debugReports.reports[0].category).toBe("flow");

    const debugSummary = await fs.readFile(path.join(sessionDir, "debug_summary.md"), "utf-8");
    expect(debugSummary).toContain("## 对局");
    expect(debugSummary).toContain("## 待办");
  });

  test("should not emit TODO section when there are no debug reports", async () => {
    const root = await createTestTempDirectory("awa-replay-no-bug-");
    const manager = await SessionRecordManager.create(
      {
        sessionId: "session_test_no_bug",
        board: "six_player_mvp",
        startedAtIso: new Date("2026-04-10T00:00:00.000Z").toISOString(),
      },
      root,
    );

    await finalizeManager(manager, {
      endedAtIso: new Date("2026-04-10T00:00:10.000Z").toISOString(),
      winner: Camp.Wolf,
      finishReason: "all_good_eliminated",
      players: [],
    });

    const summary = await fs.readFile(
      path.join(root, "session_test_no_bug", "debug_summary.md"),
      "utf-8",
    );
    expect(summary).toContain("## 观察记录");
    expect(summary).toContain("对局事件规模");
    expect(summary).toContain("## 结论");
    expect(summary).not.toContain("## 待办");
  });

  test("should emit TODO from auto scan even when report_bug is empty", async () => {
    const root = await createTestTempDirectory("awa-replay-auto-scan-");
    const manager = await SessionRecordManager.create(
      {
        sessionId: "session_test_auto_scan",
        board: "twelve_player_standard",
        startedAtIso: new Date("2026-04-10T00:00:00.000Z").toISOString(),
      },
      root,
    );

    manager.recordPublicEvent({
      type: "phase_changed",
      timestampMs: Date.now(),
      phase: "voting",
      day: 1,
      payload: { phase: "voting", day: 1 },
    });
    manager.recordPublicEvent({
      type: "wolf_self_destruct",
      timestampMs: Date.now(),
      phase: "voting",
      day: 1,
      payload: { wolfId: 9, window: "on_pre_vote" },
    });

    await finalizeManager(manager, {
      endedAtIso: new Date("2026-04-10T00:00:10.000Z").toISOString(),
      winner: Camp.Wolf,
      finishReason: "all_good_eliminated",
      players: [
        { player_id: 1, role: "wolf", camp: "wolf", alive: true },
        { player_id: 2, role: "idiot", camp: "good", alive: true },
        { player_id: 3, role: "seer", camp: "good", alive: true },
        { player_id: 4, role: "witch", camp: "good", alive: true },
      ],
    });

    const summary = await fs.readFile(
      path.join(root, "session_test_auto_scan", "debug_summary.md"),
      "utf-8",
    );
    expect(summary).toContain("## 待办");
    expect(summary).toContain("首日出现狼人自爆");
  });

  test("should ignore strategy-only report_bug messages in debug summary", async () => {
    const root = await createTestTempDirectory("awa-replay-noise-report-");
    const manager = await SessionRecordManager.create(
      {
        sessionId: "session_test_noise_report",
        board: "twelve_player_standard",
        startedAtIso: new Date("2026-04-10T00:00:00.000Z").toISOString(),
      },
      root,
    );

    manager.recordDebugReport({
      day: 2,
      phase: "voting",
      stage: "on_pre_vote",
      actorId: 3,
      actorRole: "wolf",
      actorCamp: "wolf",
      category: "state",
      severity: "high",
      message:
        "3号狼人仍在带队，当前狼队：3、2、5、12。局势对狼队不利。3号报假查验继续悍跳，本轮投票是关键时刻。",
    });

    await finalizeManager(manager, {
      endedAtIso: new Date("2026-04-10T00:00:10.000Z").toISOString(),
      winner: Camp.Wolf,
      finishReason: "all_good_eliminated",
      players: [],
    });

    const summary = await fs.readFile(
      path.join(root, "session_test_noise_report", "debug_summary.md"),
      "utf-8",
    );
    expect(summary).toContain("- 总数: 1");
    expect(summary).toContain("- 待核查上报: 0");
    expect(summary).not.toContain("## 待办");
    expect(summary).toContain("## 结论");
  });

  test("should not promote unverified flow reports without timeline anomalies", async () => {
    const root = await createTestTempDirectory("awa-replay-unverified-flow-");
    const manager = await SessionRecordManager.create(
      {
        sessionId: "session_test_unverified_flow",
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
    });
    manager.recordPublicEvent({
      type: "phase_changed",
      timestampMs: Date.now() + 1000,
      phase: "day",
      day: 1,
      payload: { phase: "day", day: 1 },
    });
    manager.recordPublicEvent({
      type: "night_resolved",
      timestampMs: Date.now() + 1200,
      phase: "day",
      day: 1,
      payload: { wolfTarget: null, deaths: [] },
    });

    manager.recordDebugReport({
      day: 1,
      phase: "day",
      stage: "day_speech",
      actorId: 1,
      actorRole: "villager",
      actorCamp: "good",
      category: "flow",
      severity: "critical",
      message: "流程异常：阶段切换错乱，白天夜晚混杂且广播缺失。",
    });

    await finalizeManager(manager, {
      endedAtIso: new Date("2026-04-10T00:00:10.000Z").toISOString(),
      winner: Camp.Wolf,
      finishReason: "all_good_eliminated",
      players: [],
    });

    const summary = await fs.readFile(
      path.join(root, "session_test_unverified_flow", "debug_summary.md"),
      "utf-8",
    );
    expect(summary).toContain("- 总数: 1");
    expect(summary).toContain("- 待核查上报: 0");
    expect(summary).not.toContain("## 待办");
    expect(summary).toContain("## 结论");
  });

  test("should detect timeline metadata mismatch in deterministic summary when reports are empty", async () => {
    const root = await createTestTempDirectory("awa-replay-metadata-mismatch-");
    const manager = await SessionRecordManager.create(
      {
        sessionId: "session_test_metadata_mismatch",
        board: "six_player_mvp",
        startedAtIso: new Date("2026-04-10T00:00:00.000Z").toISOString(),
      },
      root,
    );

    manager.recordPlayerRound({
      playerId: 1,
      role: "hunter",
      camp: "good",
      day: 0,
      phase: "night",
      stage: "night",
      requestId: "0-night-1-1",
      actionMode: "tool_call",
      toolCalls: [
        {
          name: "shoot",
          args: { target_id: 2 },
          accepted: true,
        },
      ],
    });

    await finalizeManager(manager, {
      endedAtIso: new Date("2026-04-10T00:00:10.000Z").toISOString(),
      winner: Camp.Good,
      finishReason: "all_wolves_eliminated",
      players: [],
    });

    const summary = await fs.readFile(
      path.join(root, "session_test_metadata_mismatch", "debug_summary.md"),
      "utf-8",
    );
    expect(summary).toContain("## 待办");
    expect(summary).toContain("day<=0");
  });

  test("should keep main flow when write fails and only warn", async () => {
    const root = await createTestTempDirectory("awa-replay-write-fail-");
    const manager = await SessionRecordManager.create(
      {
        sessionId: "session_test_write_fail",
        board: "six_player_mvp",
        startedAtIso: new Date("2026-04-10T00:00:00.000Z").toISOString(),
      },
      root,
    );

    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
    const writeSpy = jest.spyOn(fs, "writeFile");
    writeSpy.mockRejectedValueOnce(new Error("disk full"));

    manager.recordPublicEvent({
      type: "phase_changed",
      timestampMs: Date.now(),
      phase: "night",
      day: 1,
      payload: { phase: "night", day: 1 },
    });

    await expect(manager.flushNow()).resolves.toBeUndefined();
    await expect(
      finalizeManager(manager, {
        endedAtIso: new Date("2026-04-10T00:00:10.000Z").toISOString(),
        winner: Camp.Good,
        finishReason: "all_wolves_eliminated",
        players: [],
      }),
    ).resolves.toBeUndefined();
    expect(
      warnSpy.mock.calls.some((args) =>
        String(args[0]).includes("[observability] write_json_failed"),
      ),
    ).toBe(true);

    warnSpy.mockRestore();
    writeSpy.mockRestore();
  });

  test("isolates concurrent scoped recorders without cross-talk", async () => {
    const firstRoot = await createTestTempDirectory("awa-record-scope-a-");
    const secondRoot = await createTestTempDirectory("awa-record-scope-b-");
    const first = await SessionRecordManager.create(
      {
        sessionId: "session_scope_a",
        board: "six_player_mvp",
        startedAtIso: new Date().toISOString(),
      },
      firstRoot,
    );
    const second = await SessionRecordManager.create(
      {
        sessionId: "session_scope_b",
        board: "six_player_mvp",
        startedAtIso: new Date().toISOString(),
      },
      secondRoot,
    );
    const { promise: secondStarted, resolve: releaseSecond } = Promise.withResolvers<void>();
    const secondRun = runWithSessionRecorder(second, async () => {
      safeRecordLogicOp({ scope: "gateway", op: "second_before", status: "ok" });
      releaseSecond();
      await Promise.resolve();
      safeRecordLogicOp({ scope: "gateway", op: "second_after", status: "ok" });
    });
    const firstRun = runWithSessionRecorder(first, async () => {
      await secondStarted;
      safeRecordLogicOp({ scope: "gateway", op: "first_only", status: "ok" });
    });
    await Promise.all([firstRun, secondRun]);
    await first.finalize({
      endedAtIso: new Date().toISOString(),
      winner: null,
      finishReason: "test_done",
      players: [],
    });
    await second.finalize({
      endedAtIso: new Date().toISOString(),
      winner: null,
      finishReason: "test_done",
      players: [],
    });
    const firstOps = JSON.parse(
      await fs.readFile(path.join(firstRoot, "session_scope_a", "logic_ops.json"), "utf-8"),
    );
    const secondOps = JSON.parse(
      await fs.readFile(path.join(secondRoot, "session_scope_b", "logic_ops.json"), "utf-8"),
    );
    expect(firstOps.ops.map((op: { op: string }) => op.op)).toEqual(["first_only"]);
    expect(secondOps.ops.map((op: { op: string }) => op.op)).toEqual([
      "second_before",
      "second_after",
    ]);
  });
});
