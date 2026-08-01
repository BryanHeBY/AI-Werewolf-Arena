import { promises as fs } from "fs";
import path from "path";
import { exportReplayBundle } from "../../src/replay/export_replay_bundle";
import { createTestTempDirectory } from "../support/temp_directory";

test("exports one offline replay bundle from a recorded session", async () => {
  const root = await createTestTempDirectory("awa-replay-export-");
  const sessionId = "session_bundle_1";
  const sessionDir = path.join(root, sessionId);
  await fs.mkdir(sessionDir, { recursive: true });
  await fs.writeFile(
    path.join(sessionDir, "manifest.json"),
    JSON.stringify({
      session_id: sessionId,
      board: "six_player_mvp",
      started_at: "2026-07-27T00:00:00.000Z",
      ended_at: "2026-07-27T00:01:00.000Z",
      winner: "good",
      finish_reason: "wolves_eliminated",
      players: [{ player_id: 1, role: "seer", camp: "good", alive: true }],
      files: { public_timeline: "public_timeline.json", logic_ops: "logic_ops.json", debug_reports: "debug_reports.json", debug_summary: "debug_summary.md", player_views: [] },
    }),
    "utf-8",
  );
  await fs.writeFile(
    path.join(sessionDir, "public_timeline.json"),
    JSON.stringify({
      events: [{ seq: 1, timestamp: "2026-07-27T00:00:00.000Z", day: 1, phase: "day", type: "day_speech", payload: { actorId: 1, text: "测试发言" } }],
    }),
    "utf-8",
  );
  const outputFile = path.join(root, "exports", `${sessionId}.replay.json`);
  const bundle = await exportReplayBundle({ recordRoot: root, sessionId, outputFile });

  expect(bundle.perspective).toBe("unredacted");
  expect(bundle.events).toHaveLength(1);
  expect(JSON.parse(await fs.readFile(outputFile, "utf-8"))).toEqual(bundle);
});
