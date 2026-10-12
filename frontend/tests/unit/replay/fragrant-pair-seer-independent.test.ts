import { test, expect } from "bun:test";
import { fragrantPrivateReplay, loadFragrant } from "../../support/fragrant-replay";
import { createReplayRenderInput, buildReplayFrame } from "../../../src/replay/replay-frame";
import { readReplayEvent } from "../../../src/replay/replay-event-reader";
import { eventLabel } from "../../../src/replay/event-labels";
for (const locale of ["en", "zh-CN"] as const) {
  test(`literal first link publication and reverse frame ${locale}`, () => {
    const r = loadFragrant(`fragrant-first_link-${locale}`, ".replay.json"),
      input = createReplayRenderInput(r, { locale, timeZone: "UTC" });
    const rows = [
      ["fragrant_link_triggered", [true, true]],
      ["night_resolved", [false, true]],
      ["additional_deaths", [false, false]],
    ] as const;
    for (const [type, expected] of [...rows, ...rows.slice().reverse()]) {
      const i = input.replay.events.findIndex((e) => e.day === 1 && e.type === type);
      expect(i).toBeGreaterThan(0);
      for (const offset of [0, 45, 89]) {
        const f = buildReplayFrame(input, i * 90 + offset);
        expect([5, 7].map((id) => f.players.find((p) => p.playerId === id)!.alive)).toEqual([
          ...expected,
        ]);
      }
    }
  });
  test(`literal gun then link publication ${locale}`, () => {
    const input = createReplayRenderInput(
      loadFragrant(`fragrant-inherited_gun-${locale}`, ".replay.json"),
      { locale, timeZone: "UTC" },
    );
    for (const [type, expected] of [
      ["night_resolved", [false, true, true]],
      ["hunter_shot", [false, false, true]],
      ["fragrant_link_triggered", [false, false, true]],
      ["additional_deaths", [false, false, false]],
    ] as const) {
      const i = input.replay.events.findIndex((e) => e.day === 3 && e.type === type);
      expect(i).toBeGreaterThan(0);
      expect(
        [2, 10, 3].map(
          (id) =>
            buildReplayFrame(input, i * 90 + 45).players.find((p) => p.playerId === id)!.alive,
        ),
      ).toEqual([...expected]);
    }
  });
  for (const owner of ["phantom", "seer", "villager", "pack"])
    test(`masked roles stay unknown at actual private events ${owner}/${locale}`, () => {
      const replay = fragrantPrivateReplay(`fragrant-expiry-${locale}`, owner),
        input = createReplayRenderInput(replay, { locale, timeZone: "UTC" }),
        self = replay.players.find((p) => p.role !== "unknown")!.player_id;
      for (const [i, e] of input.replay.events.entries()) {
        const f = buildReplayFrame(input, i * 90 + 45);
        expect(f.eventSeq).toBe(e.seq);
        for (const p of f.players)
          if (p.playerId !== self) {
            expect(p.role).toBe("unknown");
            expect(p.camp).toBe("unknown");
            expect(p.roleLabel).toBe("unknown");
          }
      }
    });
  test(`strict reader invalid day/phase/target cannot drive frame ${locale}`, () => {
    const replay = loadFragrant(`fragrant-first_link-${locale}`, ".replay.json"),
      e = replay.events.find((e: any) => e.type === "fragrant_pair_inspected");
    for (const patch of [
      { day: 99 },
      { phase: "voting" },
      { payload: { ...e.payload, containsWerewolf: "true" } },
      { payload: { ...e.payload, targetIds: [4, 13] } },
      { payload: { ...e.payload, wolfCount: 1 } },
    ])
      expect(
        readReplayEvent(
          { ...e, ...patch },
          Array.from({ length: 12 }, (_, i) => i + 1),
        ),
      ).toBeNull();
    expect(
      readReplayEvent({ ...e, type: "future_unknown_event", payload: { deaths: [5] } })?.effects,
    ).toEqual([]);
    expect(eventLabel(e, locale)).toContain(
      locale === "en" ? "at least one true wolf" : "至少一名真实狼人",
    );
  });
}
