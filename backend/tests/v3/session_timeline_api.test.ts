import { promises as fs } from "fs";
import os from "os";
import path from "path";
import { createServer } from "../../src/server/index";
import { ReplayRecordRepository, ReplayRepositoryError } from "../../src/server/replay_record_repository";

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
        schema_version: "v1",
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
          { seq: 3, timestamp: "t3", phase: "day", day: 1, stage: "day_speech", type: "phase_changed", payload: {} },
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
            end_seq: 2,
            stages: [{ stage: "night", start_seq: 1, end_seq: 1 }],
          },
          {
            phase_id: "d1-day",
            day: 1,
            phase: "day",
            start_seq: 3,
            end_seq: 3,
            stages: [{ stage: "day_speech", start_seq: 3, end_seq: 3 }],
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
          { seq: 1, kind: "broadcast", day: 1, phase: "night", stage: "night", request_id: "a", role: "user", content: "x" },
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
      const timelineResp = await app.inject({
        method: "GET",
        url: "/api/v1/sessions/session_api_1/timeline?phaseId=d1-night",
      });
      expect(timelineResp.statusCode).toBe(200);
      const timeline = timelineResp.json();
      expect(timeline.success).toBe(true);
      expect(timeline.data.events.length).toBe(2);

      const phasesResp = await app.inject({
        method: "GET",
        url: "/api/v1/sessions/session_api_1/phases",
      });
      expect(phasesResp.statusCode).toBe(200);
      expect(phasesResp.json().data.windows.length).toBe(2);

      const playerResp = await app.inject({
        method: "GET",
        url: "/api/v1/sessions/session_api_1/players/1/timeline?kind=turn",
      });
      expect(playerResp.statusCode).toBe(200);
      expect(playerResp.json().data.timeline.length).toBe(1);

      const resultResp = await app.inject({
        method: "GET",
        url: "/api/v1/sessions/session_api_1/result",
      });
      expect(resultResp.statusCode).toBe(200);
      expect(resultResp.json().data.result.winner).toBe("wolf");
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
      const invalid = await app.inject({
        method: "GET",
        url: "/api/v1/sessions/session_api_2/timeline?fromSeq=10&toSeq=1",
      });
      expect(invalid.statusCode).toBe(422);
      expect(invalid.json().error.code).toBe("INVALID_QUERY");

      const missing = await app.inject({
        method: "GET",
        url: "/api/v1/sessions/session_not_found/phases",
      });
      expect(missing.statusCode).toBe(404);
      expect(missing.json().error.code).toBe("SESSION_NOT_FOUND");
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
      const resp = await app.inject({
        method: "GET",
        url: "/api/v1/sessions/session_api_3/timeline",
      });
      expect(resp.statusCode).toBe(503);
      expect(resp.json().error.code).toBe("RECORD_UNAVAILABLE");
    } finally {
      await app.close();
    }
  });
});
