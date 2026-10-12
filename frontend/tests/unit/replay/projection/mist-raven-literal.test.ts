/**
 * Unit projection tests for mist raven literal.
 * Input: existing literal or archived replay facts and their event prefixes;
 * output: original parsing, public/private state and display assertions.
 * Handwritten expectations and immutable fixture bytes are independent oracles.
 * Actual fixture lookup remains an input source; no live game executes here.
 */
import { frontendFixtureURL } from "../../../support/fixtures/manifest";
import { test, expect } from "bun:test";
import { readFileSync } from "node:fs";
import {
  readReplayDocument,
  type ReplayDocument,
  type ReplayEvent,
} from "@ai-werewolf-arena/replay-contract";
import { buildReplaySnapshot } from "../../../../src/replay/replay-projection";
const load = (v: string, l: string) =>
  readReplayDocument(
    JSON.parse(
      readFileSync(
        frontendFixtureURL(`frontend/tests/fixtures/mist-manual-${v}-${l}.replay.json`),
        "utf8",
      ),
    ),
  );
const at = (r: ReplayDocument, t: string, pred: (e: ReplayEvent) => boolean = () => true) =>
  buildReplaySnapshot(
    r,
    r.events.findIndex((e) => e.type === t && pred(e)),
  );
const sheriff = (s: ReturnType<typeof buildReplaySnapshot>) =>
  s.players.filter((p) => p.isSheriff).map((p) => p.playerId);
const alive = (s: ReturnType<typeof buildReplaySnapshot>, id: number) =>
  s.players.find((p) => p.playerId === id)!.alive;
for (const locale of ["en", "zh-CN"]) {
  test("Literal badge 10 to living 5 to 6/" + locale, () => {
    const r = load("blast-badge-chain", locale);
    const blast = at(r, "wolf_self_destruct");
    expect(sheriff(blast)).toEqual([10]);
    expect(alive(blast, 10)).toBe(false);
    expect(alive(blast, 5)).toBe(true);
    const first = at(r, "sheriff_badge_transferred", (e) => e.payload.fromId === 10);
    expect(sheriff(first)).toEqual([5]);
    expect(alive(first, 5)).toBe(true);
    const snake = at(r, "alchemist_snake_chosen", (e) => e.day === 1);
    expect(sheriff(snake)).toEqual([5]);
    expect(alive(snake, 5)).toBe(true);
    expect(snake.decision).toBeNull();
    const night = at(r, "night_resolved", (e) => e.day === 1);
    expect(sheriff(night)).toEqual([5]);
    expect(alive(night, 5)).toBe(false);
    expect(sheriff(at(r, "sheriff_badge_transferred", (e) => e.payload.fromId === 5))).toEqual([6]);
  });
  test("Literal losing intent 11 remains alive until ordinary knife/" + locale, () => {
    const r = load("blast-parallel-raw-loser", locale);
    for (const s of [
      at(r, "wolf_self_destruct"),
      at(r, "alchemist_snake_chosen", (e) => e.day === 1),
    ]) {
      expect(alive(s, 10)).toBe(false);
      expect(alive(s, 11)).toBe(true);
      expect(s.decision).toBeNull();
    }
    expect(
      alive(
        at(r, "night_resolved", (e) => e.day === 1),
        11,
      ),
    ).toBe(false);
  });
  test("Literal last wolf dies before healer and final Good result/" + locale, () => {
    const r = load("blast-last-wolf", locale);
    for (const s of [
      at(r, "wolf_self_destruct"),
      at(r, "alchemist_snake_chosen", (e) => e.day === 3),
      at(r, "night_resolved", (e) => e.day === 3),
    ]) {
      expect([9, 10, 11, 12].every((id) => !alive(s, id))).toBe(true);
      expect(alive(s, 2)).toBe(true);
      expect(s.decision).toBeNull();
    }
    const final = at(r, "game_over");
    expect(final.decision?.winner).toBe("good");
    expect(final.decision?.reason).toBe("all_wolves_eliminated");
    expect(final.players.filter((p) => p.isWinner).map((p) => p.playerId)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8,
    ]);
  });
}
