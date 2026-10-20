/**
 * 组件单元测试用手写事实及两语字面预期核对 Web 时间线和 Remotion 画面，防止只修终端而遗漏浏览器。
 * 展示前后保持原事件和席位状态，公开死亡仍以 night_resolved 等正式结果事件为准。
 */
import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { readReplayDocument, type ReplayEvent } from "@ai-werewolf-arena/replay-contract";
import { eventLabel } from "../../../../src/replay/event-labels";
import { EventTimeline } from "../../../../src/replay/EventTimeline";
import { ReplayFrame } from "../../../../src/replay/ReplayComposition";
import { buildReplaySnapshot } from "../../../../src/replay/replay-projection";
import { createReplayRenderInput } from "../../../../src/replay/replay-frame";

const events: ReplayEvent[] = [
  {
    seq: 1,
    day: 1,
    phase: "night",
    type: "animal_wave_prepared",
    timestamp: "2026-10-15T00:00:00Z",
    payload: {
      policy: "awa_animal_dream_v1",
      day: 1,
      phase: "night",
      proposedIds: [1],
      blockedCatId: null,
    },
  },
  {
    seq: 2,
    day: 1,
    phase: "night",
    type: "animal_wave_committed",
    timestamp: "2026-10-15T00:00:01Z",
    payload: {
      policy: "awa_animal_dream_v1",
      day: 1,
      phase: "night",
      deaths: [1],
      deathSources: { 1: ["wolf_kill"] },
    },
  },
];

for (const locale of ["zh-CN", "en"] as const)
  test(`${locale}: vote summaries describe votes and abstentions in words`, () => {
    const base = { seq: 1, day: 1, phase: "voting", timestamp: "2026-10-15T00:00:00Z" };
    const votes = [
      { actorId: 1, targetId: 7, abstain: false, weight: 1.5 },
      { actorId: 3, targetId: null, abstain: true, weight: 1 },
    ];
    expect(
      eventLabel({ ...base, type: "vote_summary", payload: { votes } }, locale, [1, 3, 7]),
    ).toBe(
      locale === "en"
        ? "Exile votes: Player 1 votes for player 7 (weight 1.5), Player 3 abstains"
        : "放逐票型：1号投给7号（票权1.5），3号弃票",
    );
    expect(
      eventLabel(
        {
          ...base,
          phase: "day",
          type: "sheriff_vote_summary",
          payload: {
            votes: [
              { actorId: 1, targetId: 7, abstain: false },
              { actorId: 3, targetId: null, abstain: true },
            ],
            winnerId: 7,
          },
        },
        locale,
        [1, 3, 7],
      ),
    ).toContain(locale === "en" ? "Player 1 votes for player 7" : "1号投给7号");
  });

for (const locale of ["zh-CN", "en"] as const)
  test(`${locale}: timeline and video render readable proposals and deaths without leaking state changes`, () => {
    const document = readReplayDocument({
      schemaVersion: 2,
      perspective: "god",
      sessionId: "natural-labels",
      meta: {
        board: "twelve_player_animal_dream",
        locale,
        startedAt: "2026-10-15T00:00:00Z",
        endedAt: "2026-10-15T00:00:01Z",
      },
      result: { winner: null, reason: null },
      players: Array.from({ length: 12 }, (_, index) => ({
        player_id: index + 1,
        role: "unknown",
        camp: "unknown",
      })),
      events,
    });
    const before = structuredClone(document),
      ids = document.players.map((player) => player.player_id),
      input = createReplayRenderInput(document, { locale, timeZone: "UTC" }),
      expected =
        locale === "en"
          ? [
              "Day 1, Night: proposed deaths: Player 1; White Cat death deferred: None.",
              "Day 1, Night: actual deaths: Player 1 (wolf attack).",
            ]
          : ["第1天夜晚待结算死亡：1号；白猫延缓死亡：无。", "第1天夜晚实际死亡：1号（狼刀）。"];
    const timeline = renderToStaticMarkup(
      <EventTimeline
        events={document.events}
        locale={locale}
        playerIds={ids}
        activeEventSeq={2}
        focusedPlayerId={null}
        onJumpTo={() => {}}
        onClearFocus={() => {}}
      />,
    );
    for (const [index, event] of document.events.entries()) {
      expect(eventLabel(event, locale, ids)).toBe(expected[index]!);
      expect(timeline).toContain(expected[index]!);
      const frame = renderToStaticMarkup(<ReplayFrame input={input} frame={index * 90 + 45} />);
      expect(frame).toContain(expected[index]!);
      expect(frame).not.toMatch(/awa_animal_dream_v1|proposedIds|deathSources|wolf_kill/);
      expect(buildReplaySnapshot(document, index).players.every((player) => player.alive)).toBe(
        true,
      );
    }
    expect(timeline).not.toMatch(/awa_animal_dream_v1|blockedCatId|deathSources|wolf_kill/);
    expect(document).toEqual(before);
  });
