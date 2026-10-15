/**
 * Filesystem integration tests verify recorded-session export produces a valid offline replay bundle and rejects malformed source fields.
 * Input: Temporary session documents, output paths and literal malformed nested replay data.
 * Output and oracle: Explicit bundle/file equality and validation failures are asserted; existing archived fixtures are only read.
 */
import { promises as fs } from "fs";
import path from "path";
import { exportReplayBundle } from "../../../src/app/cli/export-replay-bundle";
import { createTestTempDirectory } from "../../support/drivers/temp-directories";

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
      meta: {
        board: "six_player_mvp",
        startedAt: "2026-07-27T00:00:00.000Z",
        endedAt: "2026-07-27T00:01:00.000Z",
      },
      result: { winner: "good", reason: "wolves_eliminated" },
      players: [{ player_id: 1, role: "seer", camp: "good" }],
      events: [
        {
          seq: 1,
          timestamp: "2026-07-27T00:00:00.000Z",
          day: 1,
          phase: "day",
          type: "day_speech",
          payload: { actorId: 1, text: "测试发言" },
        },
      ],
    }),
    "utf-8",
  );
  const outputFile = path.join(root, "exports", `${sessionId}.replay.json`);
  const bundle = await exportReplayBundle({ recordRoot: root, sessionId, outputFile });

  expect(bundle.perspective).toBe("god");
  expect(bundle.events).toHaveLength(1);
  expect(JSON.parse(await fs.readFile(outputFile, "utf-8"))).toEqual(bundle);
});

test("rejects malformed nested replay fields instead of exporting them", async () => {
  const root = await createTestTempDirectory("awa-replay-invalid-");
  const sessionId = "session_bundle_invalid";
  const sessionDir = path.join(root, sessionId);
  await fs.mkdir(sessionDir, { recursive: true });
  await fs.writeFile(
    path.join(sessionDir, "replay.json"),
    JSON.stringify({
      perspective: "god",
      sessionId,
      meta: { board: "six_player_mvp", startedAt: "t1", endedAt: "t1" },
      result: { winner: null, reason: null },
      players: [{ player_id: 1, role: "seer", camp: "good" }],
      events: [
        { seq: 1, timestamp: "t1", phase: "night", day: 1, type: "phase_changed", payload: [] },
      ],
    }),
    "utf-8",
  );

  await expect(
    exportReplayBundle({
      recordRoot: root,
      sessionId,
      outputFile: path.join(root, "exports", `${sessionId}.replay.json`),
    }),
  ).rejects.toThrow("replay_bundle_invalid");
});
