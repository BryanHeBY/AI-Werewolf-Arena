import { promises as fs } from "fs";
import os from "os";
import path from "path";
import { createServer } from "../../src/server/index";
import { ReplayRecordRepository, ReplayRepositoryError } from "../../src/server/replay_record_repository";

async function createTestClient(app: Awaited<ReturnType<typeof createServer>>) {
  await app.listen({ port: 0, host: "127.0.0.1" });
  const address = app.server.address();
  if (!address || typeof address === "string") {
    throw new Error("test server did not expose a TCP address");
  }
  return async (url: string) => fetch(`http://127.0.0.1:${address.port}${url}`);
}

async function seedSession(root: string, sessionId: string): Promise<void> {
  const sessionDir = path.join(root, sessionId);
  await fs.mkdir(path.join(sessionDir, "players"), { recursive: true });
  await fs.writeFile(
    path.join(sessionDir, "manifest.json"),
    JSON.stringify(
      {
        session_id: sessionId,
        board: "six_qwen",
        started_at: "2026-04-16T00:00:00.000Z",
        ended_at: "2026-04-16T00:00:10.000Z",
        winner: "wolf",
        finish_reason: "wolves_reach_half",
        players: [],
        files: {
          public_timeline: "public_timeline.json",
          phase_windows: "phase_windows.json",
          timeline_index: "timeline_index.json",
          logic_ops: "logic_ops.json",
          debug_reports: "debug_reports.json",
          debug_summary: "debug_summary.md",
          player_views: ["players/player_1.json"],
        },
      },
      null,
      2,
    ),
    "utf-8",
  );
  await fs.writeFile(
    path.join(sessionDir, "public_timeline.json"),
    JSON.stringify(
      {
        events: [
          { seq: 1, timestamp: "t1", phase: "night", day: 1, stage: "night", type: "phase_changed", payload: {} },
          { seq: 2, timestamp: "t2", phase: "night", day: 1, stage: "wolf_discussion", type: "wolf_chat", payload: {} },
          { seq: 3, timestamp: "t3", phase: "night", day: 1, stage: "seer", type: "seer_checked", payload: { targetId: 2, isWerewolf: false } },
          { seq: 4, timestamp: "t4", phase: "night", day: 1, stage: "bootstrap", type: "god_private_game_info", payload: { players: [{ seat: 1, role: "wolf" }] } },
          { seq: 5, timestamp: "t5", phase: "day", day: 1, stage: "day_speech", type: "phase_changed", payload: {} },
        ],
      },
      null,
      2,
    ),
    "utf-8",
  );
  await fs.writeFile(
    path.join(sessionDir, "phase_windows.json"),
    JSON.stringify(
      {
        session_id: sessionId,
        windows: [
          {
            phase_id: "d1-night",
            day: 1,
            phase: "night",
            start_seq: 1,
            end_seq: 4,
            stages: [{ stage: "night", start_seq: 1, end_seq: 1 }],
          },
          {
            phase_id: "d1-day",
            day: 1,
            phase: "day",
            start_seq: 5,
            end_seq: 5,
            stages: [{ stage: "day_speech", start_seq: 5, end_seq: 5 }],
          },
        ],
      },
      null,
      2,
    ),
    "utf-8",
  );
  await fs.writeFile(
    path.join(sessionDir, "players", "player_1.json"),
    JSON.stringify(
      {
        player_id: 1,
        role: "villager",
        camp: "good",
        timeline: [
          {
            seq: 1,
            kind: "event",
            day: 1,
            phase: "night",
            stage: "night",
            request_id: "a",
            event: {
              seq: 1,
              type: "phase_changed",
              payload: { day: 1, phase: "night" },
            },
          },
          {
            seq: 2,
            kind: "turn",
            day: 1,
            phase: "night",
            stage: "wolf_discussion",
            request_id: "b",
            turn_seq: 1,
            delta_messages: [],
          },
        ],
      },
      null,
      2,
    ),
    "utf-8",
  );
}

describe("session timeline api", () => {
  test("should serve timeline/phases/player/result endpoints", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "awa-api-replay-"));
    await seedSession(root, "session_api_1");
    const repository = new ReplayRecordRepository(root);
    const app = await createServer({ recordRepository: repository, logger: false });
    try {
      const request = await createTestClient(app);
      const timelineResp = await request("/api/sessions/session_api_1/timeline?phaseId=d1-night");
      expect(timelineResp.status).toBe(200);
      const timeline = await timelineResp.json();
      expect(timeline.success).toBe(true);
      expect(timeline.data.events).toHaveLength(4);

      const phasesResp = await request("/api/sessions/session_api_1/phases");
      expect(phasesResp.status).toBe(200);
      expect((await phasesResp.json()).data.windows.length).toBe(2);

      const playerResp = await request("/api/sessions/session_api_1/players/1/timeline?kind=turn");
      expect(playerResp.status).toBe(200);
      expect((await playerResp.json()).data.timeline.length).toBe(1);

      const resultResp = await request("/api/sessions/session_api_1/result");
      expect(resultResp.status).toBe(200);
      expect((await resultResp.json()).data.result.winner).toBe("wolf");

      const replayResp = await request("/api/sessions/session_api_1/replay");
      expect(replayResp.status).toBe(200);
      const replay = await replayResp.json();
      expect(replay.data.perspective).toBe("unredacted");
      expect(replay.data.events.map((event: { type: string }) => event.type)).toEqual([
        "phase_changed",
        "wolf_chat",
        "seer_checked",
        "god_private_game_info",
        "phase_changed",
      ]);
    } finally {
      await app.close();
    }
  });

  test("should return 422/404 on invalid query and missing session", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "awa-api-replay-err-"));
    await seedSession(root, "session_api_2");
    const repository = new ReplayRecordRepository(root);
    const app = await createServer({ recordRepository: repository, logger: false });
    try {
      const request = await createTestClient(app);
      const invalid = await request("/api/sessions/session_api_2/timeline?fromSeq=10&toSeq=1");
      expect(invalid.status).toBe(422);
      expect((await invalid.json()).error.code).toBe("INVALID_QUERY");

      const missing = await request("/api/sessions/session_not_found/phases");
      expect(missing.status).toBe(404);
      expect((await missing.json()).error.code).toBe("SESSION_NOT_FOUND");
    } finally {
      await app.close();
    }
  });

  test("should return 503 when replay repository unavailable", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "awa-api-replay-503-"));
    await seedSession(root, "session_api_3");
    const repository = new ReplayRecordRepository(root);
    jest
      .spyOn(repository, "getPublicTimeline")
      .mockRejectedValueOnce(
        new ReplayRepositoryError("RECORD_UNAVAILABLE", "io down"),
      );
    const app = await createServer({ recordRepository: repository, logger: false });
    try {
      const request = await createTestClient(app);
      const resp = await request("/api/sessions/session_api_3/timeline");
      expect(resp.status).toBe(503);
      expect((await resp.json()).error.code).toBe("RECORD_UNAVAILABLE");
    } finally {
      await app.close();
    }
  });
});
