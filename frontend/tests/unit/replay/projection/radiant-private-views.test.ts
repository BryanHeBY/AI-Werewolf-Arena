/**
 * Unit projection tests for radiant private views.
 * Input: existing literal or archived replay facts and their event prefixes;
 * output: original parsing, public/private state and display assertions.
 * Handwritten expectations and immutable fixture bytes are independent oracles.
 * Actual fixture lookup remains an input source; no live game executes here.
 */
import { frontendFixtureURL, frontendFixtureArtifacts } from "../../../support/fixtures/manifest";
import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { isDeepStrictEqual } from "node:util";
import { readReplayDocument, readReplayPlayerView } from "@ai-werewolf-arena/replay-contract";
import { buildReplaySnapshot } from "../../../../src/replay/replay-projection";
import { buildReplayFrame, createReplayRenderInput } from "../../../../src/replay/replay-frame";

const read = (n: string) => JSON.parse(readFileSync(frontendFixtureURL("frontend/tests/fixtures/" + n), "utf8"));
const load = (n: string) => readReplayDocument(read(n + ".replay.json"));
const dead = (s: ReturnType<typeof buildReplaySnapshot>) =>
  s.players.filter((p) => !p.alive).map((p) => p.playerId);
const holder = (s: ReturnType<typeof buildReplaySnapshot>) =>
  s.players.filter((p) => p.isSheriff).map((p) => p.playerId);
const live = (s: ReturnType<typeof buildReplaySnapshot>, id: number) =>
  s.players.find((p) => p.playerId === id)!.alive;
const privateByActor = new Set([
  "eclipse_swallowed",
  "radiant_shelter_chosen",
  "ability_changed",
  "seer_checked",
  "witch_potion_used",
  "witch_potion_skipped",
  "dream_applied",
]);
test("all 112 real owner archives preserve exact private actor and source facts", () => {
  const files = frontendFixtureArtifacts("player-view").map((file) => file.originPath.slice("frontend/tests/fixtures/player-views/".length)).filter(
    (n) => n.startsWith("radiant-") && n.endsWith(".player.json"),
  );
  expect(files).toHaveLength(112);
  for (const name of files) {
    const view = readReplayPlayerView(read("player-views/" + name));
    const base = name.replace(/-(maid|count|seer|witch|dreamer|pack|villager)\.player\.json$/, "");
    const god = load(base);
    expect(god.players.find((p) => p.player_id === view.player_id)?.role).toBe(view.role);
    for (const entry of view.timeline) {
      if (entry.kind !== "event") continue;
      const e = entry.event;
      expect(e.type).not.toBe("eclipse_lease_closed");
      if (privateByActor.has(e.type)) expect(e.payload.actorId).toBe(view.player_id);
      if (e.type === "eclipse_native_suppressed" || e.type === "eclipse_native_restored") {
        expect(e.payload).toEqual({ day: entry.day, playerId: view.player_id });
      }
      if (privateByActor.has(e.type) || e.type.startsWith("eclipse_")) {
        // God-only sourceDisclosed is deliberately omitted from an authorized player grant.
        if (e.type === "ability_changed")
          expect(Object.hasOwn(e.payload, "sourceDisclosed")).toBe(false);
        expect(
          god.events.some((g) => {
            if (g.type !== e.type || g.day !== entry.day || g.phase !== entry.phase) return false;
            const wire = { ...g.payload };
            if (g.type === "ability_changed") delete wire.sourceDisclosed;
            return isDeepStrictEqual(wire, e.payload);
          }),
        ).toBe(true);
      }
      if (view.role === "eclipse_maid") {
        expect(
          ["wolf_discussion", "wolf_discussion_ended", "wolf_tactical_order"].includes(e.type),
        ).toBe(false);
        if (e.type === "wolf_kill_vote_cast") expect(e.payload.actorId).toBe(view.player_id);
      }
    }
  }
});
for (const locale of ["en", "zh-CN"] as const) {
  test(
    "literal dead sheriff before transfer, dream idempotence and exact reverse frames/" + locale,
    () => {
      const r = load("radiant-borrowed-dream-death-badge-words-" + locale);
      const input = createReplayRenderInput(r, { locale, timeZone: "UTC" });
      const ni = r.events.findIndex((e) => e.type === "night_resolved" && e.day === 2);
      const di = r.events.findIndex((e) => e.type === "dream_death" && e.day === 2);
      const bi = r.events.findIndex((e) => e.type === "sheriff_badge_transferred");
      const before = buildReplaySnapshot(r, ni - 1),
        night = buildReplaySnapshot(r, ni),
        dream = buildReplaySnapshot(r, di),
        badge = buildReplaySnapshot(r, bi);
      expect(dead(before)).toEqual([2, 3]);
      expect(dead(night)).toEqual([2, 3, 5, 6, 10]);
      expect(holder(night)).toEqual([10]);
      expect(live(night, 10)).toBe(false);
      expect(live(night, 9)).toBe(true);
      expect(live(night, 4)).toBe(true);
      expect(dream.players).toEqual(night.players);
      expect(holder(badge)).toEqual([9]);
      expect(live(badge, 9)).toBe(true);
      for (const [ix, wanted] of [
        [ni, night],
        [di, dream],
        [bi, badge],
        [di, dream],
        [ni, night],
      ] as const) {
        const pi = input.replay.events.findIndex((e) => e.seq === r.events[ix]!.seq);
        expect(pi).toBeGreaterThanOrEqual(0);
        expect(buildReplayFrame(input, pi * 90 + 45).snapshot.players).toEqual(wanted.players);
        expect(buildReplayFrame(input, pi * 90 + 45).snapshot.decision).toBeNull();
        expect(buildReplayFrame(input, pi * 90 - 1).snapshot.players).toEqual(
          buildReplaySnapshot(r, ix - 1).players,
        );
      }
      expect(dead(buildReplayFrame(input, 0).snapshot)).toEqual([]);
      expect(holder(buildReplayFrame(input, 0).snapshot)).toEqual([]);
    },
  );
  test(
    "all failed paid-prefix frames and all seven player archives stay unfinished/" + locale,
    () => {
      const n = "radiant-failed-paid-potion-" + locale,
        r = load(n),
        input = createReplayRenderInput(r, { locale, timeZone: "UTC" });
      const start = r.events.find((e) => e.day === 2)!;
      const si = input.replay.events.findIndex((e) => e.seq === start.seq);
      for (let frame = si * 90; frame < input.replay.events.length * 90; frame += 45) {
        const s = buildReplayFrame(input, frame).snapshot;
        expect(dead(s)).toEqual([10, 11]);
        expect(s.decision).toBeNull();
      }
      for (const label of ["maid", "count", "seer", "witch", "dreamer", "pack", "villager"]) {
        const view = readReplayPlayerView(read("player-views/" + n + "-" + label + ".player.json"));
        for (const row of view.timeline) {
          if (row.kind !== "event") continue;
          expect(
            ["eclipse_native_restored", "eclipse_lease_closed", "game_over"].includes(
              row.event.type,
            ),
          ).toBe(false);
          if (row.day === 2)
            expect(["night_resolved", "dream_death"].includes(row.event.type)).toBe(false);
        }
      }
    },
  );
}
