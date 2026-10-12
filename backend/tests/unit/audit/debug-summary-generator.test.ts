/**
 * Unit tests: Debug summaries use literal localized timeline phases and machine request
 * IDs; exact matching expectations check that display vocabulary does not break turn
 * association. Inputs and expected outcomes remain the original literal or
 * immutable-fixture oracle; these module assertions invoke no model or complete-game
 * driver.
 */
import { buildDebugSummaryMarkdown } from "../../../src/audit/debug_summary_generator";
import { ReplayManifest, ReplayPlayerView } from "../../../src/recording/contracts";

describe("debug summary metadata checks", () => {
  test("treats localized timeline phases as matching machine request ids", async () => {
    const manifest: ReplayManifest = {
      session_id: "test-localized-request-phase",
      board: "six_player_mvp",
      started_at: "2026-01-01T00:00:00.000Z",
      ended_at: "2026-01-01T00:00:01.000Z",
      winner: null,
      finish_reason: "test",
      players: [],
      files: {
        replay: "replay.json",
        logic_ops: "logic_ops.json",
        debug_reports: "debug_reports.json",
        debug_summary: "debug_summary.md",
        player_views: ["players/player_1.json"],
      },
    };
    const playerViews: ReplayPlayerView[] = [
      {
        player_id: 1,
        role: "wolf",
        camp: "wolf",
        timeline: [
          {
            seq: 1,
            kind: "turn",
            day: 1,
            phase: "夜晚",
            stage: "狼人交流",
            request_id: "1-night-1-1",
            turn_seq: 1,
            delta_messages: [],
          },
        ],
      },
    ];

    const markdown = await buildDebugSummaryMarkdown(
      {
        manifest,
        reports: [],
        playerViews,
      },
      null,
    );

    expect(markdown).not.toContain("request_id 与 day/phase 不一致");
    expect(markdown).not.toContain("请求编号异常");
  });
});
