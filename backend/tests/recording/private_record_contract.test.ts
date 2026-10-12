/**
 * Private-record parsing/writer integration verify explicit version conversion leaves user and tool content unchanged.
 * Input: Legacy player views, nested malformed versions and actual round-recorder writes.
 * Output and independent oracle: Literal metadata-only normalization, original text/events/results and versioned player JSON fields.
 * The test never calls a billed model or rewrites expected fixture/Tape bytes.
 */
import { expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { assertReplayPlayerView, readReplayPlayerView } from "@ai-werewolf-arena/replay-contract";
import { bootstrapGame } from "../../src/app/bootstrap";
import { sixPlayerMvpConfig } from "../../src/runtime/scenarios/six_player_mvp";
import { PlayerRoundRecorder } from "../../src/ai/agents/player/player_round_recorder";
import { SessionRecordManager } from "../../src/recording/session_recorder";
import { runWithSessionRecorder } from "../../src/recording/recording_context";
import { Phase, Role } from "../../src/core";
import { createTestTempDirectory } from "../support/drivers/temp-directories";

async function legacy() {
  return JSON.parse(
    await readFile(
      path.resolve(process.cwd(), "../packages/replay-contract/fixtures/board-unrecorded/legacy-player-view/locale-unrecorded/players/1-localized-role.player.json"),
      "utf8",
    ),
  );
}

test("private record reader converts only metadata paths and leaves prompts/events/tool results original", async () => {
  const old = await legacy();
  const before = structuredClone(old);
  const current = readReplayPlayerView(old);
  expect(current.schemaVersion).toBe(2);
  expect(current.locale).toBeUndefined();
  expect(current.role).toBe("wolf");
  expect(current.camp).toBe("wolf");
  expect(current.initial_prompt?.phase).toBe("night");
  expect(current.initial_prompt?.stage).toBe("wolf_discussion");
  expect(current.timeline.map((entry) => [entry.phase, entry.stage])).toEqual([
    ["night", "wolf_discussion"],
    ["night", "wolf_discussion"],
    ["未知阶段", "未知技能"],
  ]);
  expect(current.initial_prompt?.prompt_system).toBe(old.initial_prompt.prompt_system);
  expect(current.timeline[0].kind === "event" && current.timeline[0].event).toEqual(
    old.timeline[0].event,
  );
  expect(current.timeline[1].kind === "turn" && current.timeline[1].delta_messages).toEqual(
    old.timeline[1].delta_messages,
  );
  expect(current.timeline[2].day).toBe(0); // Preserve diagnosable historical anomalies.
  expect(old).toEqual(before);
  assertReplayPlayerView(current);
  expect(readReplayPlayerView(current)).toEqual(current);
  expect(readReplayPlayerView({ ...old, schemaVersion: 1 })).toEqual(current);
  const v2 = readReplayPlayerView({ ...old, schemaVersion: 2 });
  expect(v2.initial_prompt?.phase).toBe("夜晚");
});

test("private record versions and nested shapes fail explicitly", async () => {
  const old = await legacy();
  for (const version of [null, "2", 3])
    expect(() => readReplayPlayerView({ ...old, schemaVersion: version })).toThrow(
      "player.schemaVersion",
    );
  const mutate = (change: (value: any) => void) => {
    const value = structuredClone(old);
    change(value);
    expect(() => readReplayPlayerView(value)).toThrow("replay_document_invalid");
  };
  mutate((value) => {
    value.timeline[0].seq = 7;
  });
  mutate((value) => {
    value.timeline[0].event.payload = [];
  });
  mutate((value) => {
    value.timeline[1].delta_messages[0].content = 7;
  });
  mutate((value) => {
    value.locale = "en-US";
  });
  for (const version of [undefined, 2])
    for (const wrong of [["user"], { value: "user" }]) {
      mutate((value) => {
        value.schemaVersion = version;
        value.timeline[1].delta_messages[0].role = wrong;
      });
      mutate((value) => {
        value.schemaVersion = version;
        value.timeline[1].delta_messages[0].kind = Array.isArray(wrong)
          ? ["prompt"]
          : { value: "prompt" };
      });
    }
  mutate((value) => {
    value.timeline[1].turn_seq = 0;
  });
  mutate((value) => {
    value.initial_prompt.prompt_user = [7];
  });
});

for (const locale of ["zh-CN", "en"] as const)
  test(`actual player round writes v2 ${locale} machine phase/stage and original text`, async () => {
    const root = await createTestTempDirectory("awa-private-v2-");
    const { world } = bootstrapGame(sixPlayerMvpConfig, {
      locale,
      fixedRoles: [Role.Wolf, Role.Seer, Role.Villager, Role.Wolf, Role.Guard, Role.Villager],
    });
    const manager = await SessionRecordManager.create(
      {
        sessionId: "private-v2",
        locale,
        board: "synthetic",
        startedAtIso: "2026-10-08T00:00:00.000Z",
      },
      root,
    );
    await runWithSessionRecorder(manager, async () => {
      new PlayerRoundRecorder(world).record(
        {
          actorId: 1,
          phase: Phase.Night,
          allowedTools: ["speak_to_wolves"],
          context: {
            day: 1,
            stage: "wolf_discussion",
            visible_events: [],
            turn_constraints: {
              min_valid_actions: 1,
              max_valid_actions: 1,
              summary_message: { key: "request.summary.night_action" },
            },
          },
        },
        {
          systemPrompt: "Original 系统",
          userPrompt: "Original 当前提示",
          messages: [],
          isInitialRound: true,
          eventCursorBefore: 0,
          eventCursorAfter: 0,
          contextWindowStart: 0,
          contextWindowEnd: 0,
          contextWindowTotal: 0,
          turnId: "t1",
        },
        { actionMode: "none", toolCalls: [], thinkingText: "Original 思考" },
      );
      await manager.finalize({
        endedAtIso: "2026-10-08T00:01:00.000Z",
        winner: null,
        finishReason: "completed",
        players: [],
      });
    });
    const view = JSON.parse(
      await readFile(path.join(root, "private-v2/players/player_1.json"), "utf8"),
    );
    assertReplayPlayerView(view);
    expect(view.schemaVersion).toBe(2);
    expect(view.locale).toBe(locale);
    expect(view.initial_prompt!.phase).toBe("night");
    expect(view.initial_prompt!.stage).toBe("wolf_discussion");
    expect(view.timeline[0].phase).toBe("night");
    expect(view.timeline[0].stage).toBe("wolf_discussion");
    expect(view.timeline[0].request_id).toBe("1-night-1-1");
    expect(view.initial_prompt!.prompt_system).toBe("Original 系统");
    expect(JSON.stringify(view)).toContain("Original 思考");
    expect(JSON.stringify(view)).toContain("Original 当前提示");
  });
