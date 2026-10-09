import { expect, test } from "bun:test";
import { renderMessage } from "@ai-werewolf-arena/game-text";
import { collectObservations } from "../../src/audit/deterministic_checks";
import type { BuildDebugSummaryInput } from "../../src/audit/contracts";

for (const locale of ["zh-CN", "en"] as const)
  test(`${locale}: audit counts all successful gun origins and excludes blocked or silent shots`, () => {
    const input: BuildDebugSummaryInput = {
      manifest: {
        session_id: "shot-audit",
        board: "six_player_mvp",
        started_at: "t1",
        ended_at: "t2",
        winner: null,
        finish_reason: "test",
        players: [],
        files: {
          replay: "replay.json",
          logic_ops: "logic_ops.json",
          debug_reports: "debug_reports.json",
          debug_summary: "debug_summary.md",
          player_views: [],
        },
      },
      reports: [],
      publicEvents: [
        "hunter_shot",
        "player_shot",
        "wolf_king_shot",
        "mechanical_shot",
        "death_shot_blocked",
        "hunter_silent_due_to_poison",
      ].map((type, i) => ({
        seq: i + 1,
        timestamp: "t1",
        day: 1,
        phase: "day",
        type,
        payload: { actorId: 3, targetId: 2 },
      })),
    };
    const observation = collectObservations(input).find((row) => row.code === "process_counts")!;
    expect(observation.detail.parameters).toEqual({ night: 0, blast: 0, shot: 4 });
    expect(renderMessage(locale, observation.detail)).toBe(
      locale === "en"
        ? "Night resolutions=0, wolf self-destructions=0, death shots=4"
        : "夜间结算=0，狼人自爆=0，死亡开枪=4",
    );
  });
