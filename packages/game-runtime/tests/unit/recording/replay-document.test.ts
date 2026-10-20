/**
 * 单元测试以字面重复／缺失序号及玩家档案为输入，用精确拒绝断言核对公开 replay 形状，不写输出文件。预期仍为原字面值或不可变夹具；不调用模型或完整对局驱动。
 */
import { expect, test } from "bun:test";
import { createReplayDocument } from "../../../src/recording/session/replay-document";
import { ReplayManifest } from "../../../src/recording/contracts";

function manifest(players: ReplayManifest["players"] = []): ReplayManifest {
  return {
    session_id: "session_integrity",
    board: "six_player_mvp",
    started_at: "2026-08-01T00:00:00.000Z",
    ended_at: "2026-08-01T00:01:00.000Z",
    winner: null,
    finish_reason: "in_progress",
    players,
    files: {
      replay: "replay.json",
      logic_ops: "logic_ops.json",
      debug_reports: "debug_reports.json",
      debug_summary: "debug_summary.md",
      player_views: [],
    },
  };
}

test("rejects missing or duplicated event sequence numbers", () => {
  expect(() =>
    createReplayDocument({
      manifest: manifest(),
      events: [
        {
          seq: 2,
          timestamp: "2026-08-01T00:00:00.000Z",
          phase: "night",
          day: 1,
          type: "phase_changed",
          payload: {},
        },
      ],
    }),
  ).toThrow("replay_document_non_canonical_event_sequence");
});

test("rejects duplicated player records", () => {
  expect(() =>
    createReplayDocument({
      manifest: manifest([
        { player_id: 1, role: "wolf", camp: "wolf", alive: true },
        { player_id: 1, role: "wolf", camp: "wolf", alive: false },
      ]),
      events: [],
    }),
  ).toThrow("replay_document_duplicate_player:1");
});
