/**
 * 组件单元测试负责胜利归档的复盘展示。输入为既有录制／字面事件、游标、语言和 frame 设置，输出保持原席位、时间线及画面断言。
 * 手写可见性／状态预期与不可变归档为独立 oracle，不运行真实对局或模型传输。
 */
import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { readReplayDocument, type ReplayDocument } from "@ai-werewolf-arena/replay-contract";
import type { SealedVictoryResult } from "@ai-werewolf-arena/game-contract";
import { eventLabel } from "../../../../src/replay/event-labels";
import { replayResultLabel } from "../../../../src/replay/replay-localization";
import { buildReplaySnapshot } from "../../../../src/replay/replay-projection";
import { createReplayRenderInput, buildReplayFrame } from "../../../../src/replay/replay-frame";
import { ReplayFrame } from "../../../../src/replay/ReplayComposition";
import { PlayerSeats } from "../../../../src/replay/PlayerSeats";
import { EventTimeline } from "../../../../src/replay/EventTimeline";

const result = (
  kind: "faction" | "individual" | "relationship" | "multiple" | "no_winner",
): SealedVictoryResult => ({
  winner: kind === "faction" ? "good" : null,
  reason: kind === "no_winner" ? "max_days_reached" : "scenario_win",
  outcome:
    kind === "no_winner"
      ? { kind }
      : {
          kind: "victory",
          primary:
            kind === "faction"
              ? { kind, faction: "good", winningPlayerIds: [1, 3] }
              : kind === "relationship"
                ? { kind, groupId: "scenario_pair", winningPlayerIds: [1, 2] }
                : {
                    kind: "individual",
                    playerId: 3,
                    goalId: "scenario_solo",
                    winningPlayerIds: [3],
                  },
          additional:
            kind === "multiple"
              ? [{ kind: "relationship", groupId: "scenario_pair", winningPlayerIds: [1, 2] }]
              : [],
          winningPlayerIds:
            kind === "faction"
              ? [1, 3]
              : kind === "relationship"
                ? [1, 2]
                : kind === "multiple"
                  ? [1, 2, 3]
                  : [3],
        },
  decidedAt: {
    day: 2,
    phase: kind === "no_winner" ? "night" : "voting",
    checkpoint: kind === "no_winner" ? "max_days_reached" : "exile_settled",
  },
});
function replay(kind: Parameters<typeof result>[0]): ReplayDocument {
  const decision = result(kind);
  return readReplayDocument({
    schemaVersion: 2,
    perspective: "god",
    sessionId: "synthetic-victory",
    meta: {
      board: "synthetic_victory_display",
      startedAt: "2026-10-08T00:00:00.000Z",
      endedAt: "2026-10-08T00:01:00.000Z",
    },
    result: { winner: decision.winner, reason: "runtime_error", decision },
    players: [
      { player_id: 1, name: "原名<Alpha>", role: "seer", camp: "good" },
      { player_id: 2, role: "wolf", camp: "wolf" },
      { player_id: 3, role: "villager", camp: "good" },
    ],
    events: [
      {
        seq: 1,
        timestamp: "2026-10-08T00:00:00.000Z",
        phase: "voting",
        day: 2,
        type: "voted_out",
        payload: { target: 1 },
      },
      {
        seq: 2,
        timestamp: "2026-10-08T00:01:00.000Z",
        phase: "game_over",
        day: 2,
        type: "game_over",
        payload: decision,
      },
    ],
  });
}

for (const locale of ["zh-CN", "en"] as const)
  for (const kind of ["faction", "individual", "relationship", "multiple", "no_winner"] as const)
    test(`${locale}/${kind}: result, timeline, seats and exported frame share explicit victory facts without premature winner marking`, () => {
      const document = replay(kind),
        before = structuredClone(document);
      const winners =
        kind === "faction"
          ? [1, 3]
          : kind === "relationship"
            ? [1, 2]
            : kind === "multiple"
              ? [1, 2, 3]
              : kind === "individual"
                ? [3]
                : [];
      const early = buildReplaySnapshot(document, 0),
        terminal = buildReplaySnapshot(document, 1);
      expect(early.decision).toBeNull();
      expect(early.players.filter((player) => player.isWinner)).toEqual([]);
      expect(
        terminal.players.filter((player) => player.isWinner).map((player) => player.playerId),
      ).toEqual(winners);
      expect(terminal.players[0].alive).toBe(false);
      const label = replayResultLabel(document, locale),
        event = eventLabel(document.events[1], locale);
      expect(event).toContain(label);
      if (kind !== "no_winner") expect(label).not.toBe(locale === "en" ? "No winner" : "无胜者");
      const input = createReplayRenderInput(document, { locale, timeZone: "UTC" });
      const frame = buildReplayFrame(input, 100);
      expect(frame.snapshot.decision).toEqual(result(kind));
      expect(frame.label).toContain(label);
      expect(frame.label).toContain(locale === "en" ? "Winning players" : "获胜玩家");
      expect(frame.victory).toContain(
        kind === "no_winner"
          ? locale === "en"
            ? "Day limit reached"
            : "达到天数上限"
          : locale === "en"
            ? "Exile settled"
            : "放逐结算完成",
      );
      const markup = renderToStaticMarkup(<ReplayFrame input={input} frame={100} />);
      expect(markup).toBe(renderToStaticMarkup(<ReplayFrame input={input} frame={100} />));
      expect(markup.match(/data-testid="composition-winner"/g)?.length ?? 0).toBe(winners.length);
      expect(markup).toContain("原名&lt;Alpha&gt;");
      const seats = renderToStaticMarkup(
        <PlayerSeats
          players={terminal.players}
          locale={locale}
          focusedPlayerId={null}
          onToggleFocus={() => {}}
        />,
      );
      expect(seats.match(/class="winner"/g)?.length ?? 0).toBe(winners.length);
      expect(document).toEqual(before);
    });

test("legacy files never derive winner membership from camps and malformed explicit terminal facts never fall back to a faction", () => {
  const document = replay("faction");
  delete document.result.decision;
  document.events[1].payload = { winner: "good", reason: "all_wolves_eliminated" };
  expect(replayResultLabel(document, "en")).toBe("Good team");
  expect(buildReplaySnapshot(document, 1).players.filter((player) => player.isWinner)).toEqual([]);
  document.events[1].payload = { ...document.events[1].payload, outcome: { kind: "malformed" } };
  expect(eventLabel(document.events[1], "en")).toBe("Unknown");
  expect(buildReplaySnapshot(document, 1).players.filter((player) => player.isWinner)).toEqual([]);
  let reads = 0;
  Object.defineProperty(document.events[1].payload, "outcome", {
    enumerable: true,
    get() {
      reads++;
      return result("faction").outcome;
    },
  });
  expect(eventLabel(document.events[1], "en")).toBe("Unknown");
  expect(reads).toBe(0);
});

for (const locale of ["zh-CN", "en"] as const)
  test(`${locale}: unknown winning players remain raw unknown facts consistently across summary, timeline, frame and seats`, () => {
    const document = replay("individual");
    delete document.result.decision;
    const bad = result("individual");
    bad.outcome = {
      kind: "victory",
      primary: {
        kind: "individual",
        playerId: 999,
        goalId: "scenario_unknown",
        winningPlayerIds: [999],
      },
      additional: [],
      winningPlayerIds: [999],
    };
    document.events[1].payload = { ...bad };
    const before = structuredClone(document),
      loaded = readReplayDocument(document),
      unknown = locale === "en" ? "Unknown" : "未知";
    const playerIds = loaded.players.map((player) => player.player_id);
    expect(replayResultLabel(loaded, locale)).toBe(unknown);
    expect(eventLabel(loaded.events[1], locale, playerIds)).toBe(unknown);
    expect(
      buildReplayFrame(createReplayRenderInput(loaded, { locale, timeZone: "UTC" }), 100).label,
    ).toBe(unknown);
    expect(buildReplaySnapshot(loaded, 1).players.filter((player) => player.isWinner)).toEqual([]);
    const markup = renderToStaticMarkup(
      <EventTimeline
        events={loaded.events}
        locale={locale}
        playerIds={playerIds}
        activeEventSeq={2}
        focusedPlayerId={null}
        onJumpTo={() => {}}
        onClearFocus={() => {}}
      />,
    );
    expect(markup).toContain(`<p>${unknown}</p>`);
    expect(markup).not.toContain("999");
    expect(document).toEqual(before);
    expect(loaded.events[1].payload).toEqual({ ...bad });
    // 只有终局记录的有效归档仍提供明确结果，不依赖额外最终头。
    loaded.events[1].payload = { ...result("individual") };
    expect(replayResultLabel(loaded, locale)).toContain(
      locale === "en" ? "personal goal victory" : "个人目标胜利",
    );
  });
