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
    path.join(sessionDir, "replay.json"),
    JSON.stringify({
      perspective: "god",
      sessionId,
      meta: { board: "six_player_mvp", startedAt: "2026-07-27T00:00:00.000Z", endedAt: "2026-07-27T00:01:00.000Z" },
      result: { winner: "good", reason: "wolves_eliminated" },
      players: [{ player_id: 1, role: "seer", camp: "good" }],
      events: [{ seq: 1, timestamp: "2026-07-27T00:00:00.000Z", day: 1, phase: "day", type: "day_speech", payload: { actorId: 1, text: "测试发言" } }],
    }),
    "utf-8",
  );
  const outputFile = path.join(root, "exports", `${sessionId}.replay.json`);
  const bundle = await exportReplayBundle({ recordRoot: root, sessionId, outputFile });

  expect(bundle.perspective).toBe("god");
  expect(bundle.events).toHaveLength(1);
  expect(JSON.parse(await fs.readFile(outputFile, "utf-8"))).toEqual(bundle);
});
