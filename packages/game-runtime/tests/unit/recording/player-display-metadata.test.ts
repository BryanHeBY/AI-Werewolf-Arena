/**
 * 单元测试负责核对公开展示资料贯通与白名单边界。输入为真实 World、独立模型标签和旧档，
 * 预期为字面 seat/model；不借私有 Tape 生成预期，也不导出 provider 或密钥。
 */
import { expect, test } from "bun:test";
import { readReplayDocument, readReplayManifest } from "@ai-werewolf-arena/replay-contract";
import { bootstrapGame } from "../../../src/app/bootstrap";
import { sixPlayerMvpConfig } from "../../../src/rulesets/presets/six-player-mvp";
import { replayPlayerDisplay } from "../../../src/app/replay-player-display";
import { createReplayDocument } from "../../../src/recording/session/replay-document";
const manifest = {
  session_id: "display",
  board: "six_player_mvp",
  started_at: "2026-10-17T00:00:00Z",
  ended_at: "2026-10-17T00:00:01Z",
  winner: null,
  finish_reason: "in_progress",
  players: [
    {
      player_id: 7,
      seat: 3,
      model: "model/public-label",
      role: "wolf",
      camp: "wolf",
      name: "昵称",
      alive: true,
    },
  ],
  files: {
    replay: "replay.json",
    logic_ops: "logic_ops.json",
    debug_reports: "debug_reports.json",
    debug_summary: "debug_summary.md",
    player_views: [],
  },
};
test("真实身份座位与模型只投影展示白名单", () => {
  const context = bootstrapGame(sixPlayerMvpConfig);
  expect(replayPlayerDisplay(context.world, 1, "public-model")).toEqual({
    seat: 1,
    model: "public-model",
  });
  expect(replayPlayerDisplay(context.world, 1, "bad\nlabel")).toEqual({ seat: 1 });
  expect(replayPlayerDisplay(context.world, 1, "x".repeat(201))).toEqual({ seat: 1 });
});
test("manifest、writer和独立导入保留座位模型昵称，旧档缺省不补造", () => {
  const parsed = readReplayManifest(manifest);
  expect(parsed.players).toEqual(manifest.players);
  const replay = createReplayDocument({ manifest, events: [] });
  expect(readReplayDocument(replay).players).toEqual([
    {
      player_id: 7,
      seat: 3,
      model: "model/public-label",
      role: "wolf",
      camp: "wolf",
      name: "昵称",
    },
  ]);
  const old = structuredClone(replay);
  delete old.players[0]!.seat;
  delete old.players[0]!.model;
  expect(readReplayDocument(old).players[0]).not.toHaveProperty("model");
  expect(readReplayDocument(old).players[0]).not.toHaveProperty("seat");
  for (const model of [{ apiKey: "private" }, "", "bad\nlabel", "x".repeat(201)]) {
    const bad = structuredClone(replay);
    Object.assign(bad.players[0]!, { model });
    expect(() => readReplayDocument(bad)).toThrow("players[0].model");
  }
});
