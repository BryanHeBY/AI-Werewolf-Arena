/**
 * 单元测试持有显式旧版／规范 replay 元数据路径、错误版本及纯新版本 writer 形状。输入为每次新读的不可变公开档案及字面变体；原用户文本、未知 ID、私密元数据省略及脱离来源输出为预期。不改写或导出档案到磁盘。
 */
import { expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  assertReplayDocument,
  readReplayDocument,
  ReplayDocumentValidationError,
} from "@ai-werewolf-arena/replay-contract";
import { createReplayDocument } from "../../../src/recording/session/replay-document";

async function fixture() {
  return JSON.parse(
    await readFile(
      path.resolve(
        process.cwd(),
        "../packages/replay-contract/fixtures/synthetic/legacy-localized/locale-unrecorded/god.replay.json",
      ),
      "utf8",
    ),
  );
}

test("legacy normalization follows explicit metadata paths, preserving unknown IDs and original text", async () => {
  const old = await fixture();
  const before = structuredClone(old);
  const parsed = readReplayDocument(old);
  expect(parsed.schemaVersion).toBe(2);
  expect(parsed.meta.locale).toBeUndefined();
  expect(parsed.players).toEqual([
    { player_id: 1, name: "玩家1", role: "wolf", camp: "wolf" },
    { player_id: 2, name: "古风小生", role: "old_role", camp: "旧阵营" },
  ]);
  expect(parsed.events.map((event) => [event.phase, event.stage])).toEqual([
    ["night", "wolf_discussion"],
    ["day", "day_speech"],
    ["未知阶段", "未知技能"],
    ["game_over", "game_over"],
  ]);
  expect(parsed.result).toEqual({ winner: "good", reason: "all_wolves_eliminated" });
  expect(parsed.events[0].payload).toEqual(old.events[0].payload);
  expect(parsed.events[1].payload).toEqual(old.events[1].payload);
  expect(parsed.events[2].payload).toEqual(old.events[2].payload);
  expect(parsed.events[3].payload).toEqual({ winner: "good", reason: "all_wolves_eliminated" });
  expect(old).toEqual(before);
  assertReplayDocument(parsed);
  expect(readReplayDocument({ ...old, schemaVersion: 1 })).toEqual(parsed);
  expect(readReplayDocument(parsed)).toEqual(parsed);
});

test("future/malformed version values fail before legacy conversion and canonical v2 is not guessed", async () => {
  const old = await fixture();
  for (const version of [0, 3, -1, 1.5, null, "2"]) {
    try {
      readReplayDocument({ ...old, schemaVersion: version });
      throw new Error("accepted_bad_version");
    } catch (error) {
      expect(error).toBeInstanceOf(ReplayDocumentValidationError);
      expect((error as ReplayDocumentValidationError).kind).toBe("unsupported_version");
    }
  }
  expect(() => assertReplayDocument(old)).toThrow("schemaVersion");
  const v2 = { ...old, schemaVersion: 2, meta: { ...old.meta, locale: "en" } };
  expect(readReplayDocument(v2).events[0].phase).toBe("夜晚"); // 新版本的不透明值绝不按旧版本解释。
  expect(() => readReplayDocument({ ...v2, meta: { ...v2.meta, locale: "en-US" } })).toThrow(
    "meta.locale",
  );
  const parsed = readReplayDocument(v2);
  parsed.events[0].payload.actorId = 999;
  expect(v2.events[0].payload.actorId).toBe(1);
});

test("new writer emits an explicit version and supplied game locale while excluding private metadata", () => {
  const written = createReplayDocument({
    manifest: {
      locale: "en",
      session_id: "new",
      board: "synthetic",
      started_at: "t1",
      ended_at: "t2",
      winner: null,
      finish_reason: "in_progress",
      players: [],
      random: {
        seed: "PRIVATE_SEED",
        algorithm: "mulberry32-fnv1a-utf16-v1",
        streamPolicy: "named-path-v1",
        path: [],
      },
      files: {
        replay: "replay.json",
        logic_ops: "logic_ops.json",
        debug_reports: "debug_reports.json",
        debug_summary: "debug_summary.md",
        player_views: [],
      },
    },
    events: [],
  });
  assertReplayDocument(written);
  expect(written.schemaVersion).toBe(2);
  expect(written.meta.locale).toBe("en");
  expect(JSON.stringify(written)).not.toContain("PRIVATE_SEED");
});

test("declared phase and initial-role paths normalize while their other content stays original", async () => {
  const old = await fixture();
  old.events = [
    {
      seq: 1,
      timestamp: "t1",
      phase: "白天",
      day: 1,
      type: "phase_changed",
      payload: {
        phase: "白天",
        winner: "好人",
        reason: "狼人全部出局",
        text: "夜晚",
        nested: { phase: "白天" },
      },
    },
    {
      seq: 2,
      timestamp: "t1",
      phase: "夜晚",
      day: 1,
      type: "god_private_game_info",
      payload: { players: [{ id: 1, role: "狼人", camp: "狼人阵营", name: "狼人", text: "狼人" }] },
    },
  ];
  const result = readReplayDocument(old);
  expect(result.events[0].payload).toEqual({
    phase: "day",
    winner: "good",
    reason: "all_wolves_eliminated",
    text: "夜晚",
    nested: { phase: "白天" },
  });
  expect(result.events[1].payload.players).toEqual([
    { id: 1, role: "wolf", camp: "wolf", name: "狼人", text: "狼人" },
  ]);
});

test("English archived payload metadata follows the same exact path contract", async () => {
  const old = await fixture();
  old.events = [
    {
      seq: 1,
      timestamp: "t1",
      phase: "Day",
      day: 1,
      type: "phase_changed",
      payload: {
        phase: "Day",
        winner: "Good team",
        reason: "All wolves eliminated",
        text: "Night",
        nested: { phase: "Day" },
      },
    },
    {
      seq: 2,
      timestamp: "t1",
      phase: "Night",
      day: 1,
      type: "god_private_game_info",
      payload: {
        players: [
          { id: 1, role: "Werewolf", camp: "Werewolf team", name: "Werewolf", text: "Werewolf" },
        ],
      },
    },
  ];
  const before = structuredClone(old);
  const parsed = readReplayDocument(old);
  expect(parsed.events[0].payload).toEqual({
    phase: "day",
    winner: "good",
    reason: "all_wolves_eliminated",
    text: "Night",
    nested: { phase: "Day" },
  });
  expect(parsed.events[1].payload.players).toEqual([
    { id: 1, role: "wolf", camp: "wolf", name: "Werewolf", text: "Werewolf" },
  ]);
  expect(old).toEqual(before);
});
