/**
 * Unit component tests for radiant eclipse archive replay display.
 * Input: existing recorded or literal replay data, event cursors and explicit
 * language/frame settings; output: the original seat, timeline and rendered
 * frame assertions. Handwritten visibility/state expectations and immutable
 * archives are independent oracles. No live game or model transport executes.
 */
import { frontendFixtureURL } from "../../../support/fixtures/manifest";
import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { readReplayDocument, readReplayPlayerView } from "@ai-werewolf-arena/replay-contract";
import { buildReplaySnapshot } from "../../../../src/replay/replay-projection";
import {
  createReplayRenderInput,
  buildReplayFrame,
  FRAMES_PER_EVENT,
} from "../../../../src/replay/replay-frame";
import { ReplayFrame } from "../../../../src/replay/ReplayComposition";
import { readReplayEvent } from "../../../../src/replay/replay-event-reader";
import { eventLabel } from "../../../../src/replay/event-labels";
const names = [
  "last-wolf-borrow-backlash",
  "last-villager-saved-then-double-cause",
  "last-god-restored-dream-gap",
  "borrowed-dream-death-badge-words",
  "independent-stock-card16-card17",
  "zero-one-then-empty",
  "one-zero-borrow-heal",
];
const load = (name: string, suffix: string) =>
  JSON.parse(readFileSync(frontendFixtureURL(`frontend/tests/fixtures/${name}${suffix}`), "utf8"));
const privateFact = (type: string) =>
  type.startsWith("eclipse_") || type === "radiant_shelter_chosen";
const dead = (snapshot: ReturnType<typeof buildReplaySnapshot>) =>
  snapshot.players.filter((p) => !p.alive).map((p) => p.playerId);
for (const locale of ["en", "zh-CN"] as const)
  for (const variant of names) {
    const name = `radiant-${variant}-${locale}`;
    test(`Radiant actual God archive announcement, intermediate badge, frame and rewind/${name}`, () => {
      const replay = readReplayDocument(load(name, ".replay.json"));
      const cp = load(name, ".checkpoint.txt");
      const input = createReplayRenderInput(replay, { locale, timeZone: "UTC" });
      for (const event of replay.events.filter(
        (e) =>
          privateFact(e.type) ||
          ["night_resolved", "dream_death", "sheriff_badge_transferred", "game_over"].includes(
            e.type,
          ),
      )) {
        const index = replay.events.findIndex((e) => e.seq === event.seq),
          before = buildReplaySnapshot(replay, index - 1),
          after = buildReplaySnapshot(replay, index);
        if (privateFact(event.type)) {
          expect(
            readReplayEvent(
              event,
              replay.players.map((p) => p.player_id),
            )?.effects,
          ).toEqual([]);
          expect(after.players).toEqual(before.players);
        }
        if (event.type === "night_resolved") {
          const deaths = event.payload.deaths as number[];
          expect(dead(after)).toEqual(
            [...new Set([...dead(before), ...deaths])].sort((a, b) => a - b),
          );
        }
        if (event.type === "sheriff_badge_transferred") {
          expect(before.players.filter((p) => p.isSheriff).map((p) => p.playerId)).toEqual([10]);
          expect(after.players.filter((p) => p.isSheriff).map((p) => p.playerId)).toEqual([9]);
        }
        const presentation = input.replay.events.findIndex((e) => e.seq === event.seq);
        expect(presentation).toBeGreaterThanOrEqual(0);
        for (const offset of [0, 45, 89])
          expect(
            buildReplayFrame(input, presentation * FRAMES_PER_EVENT + offset).snapshot,
          ).toEqual(after);
        if (presentation > 0)
          expect(
            buildReplayFrame(input, presentation * FRAMES_PER_EVENT - 1).snapshot.players,
          ).toEqual(before.players);
        if (event.type !== "game_over") expect(after.decision).toBeNull();
      }
      const last = buildReplayFrame(input, (input.replay.events.length - 1) * 90 + 89);
      expect(dead(last.snapshot)).toEqual(
        cp.players.filter((p: { alive: boolean }) => !p.alive).map((p: { id: number }) => p.id),
      );
      expect(last.snapshot.decision).toEqual(cp.snapshot.result);
      expect(last.snapshot.players.filter((p) => p.isSheriff).map((p) => p.playerId)).toEqual(
        cp.players
          .filter((p: { badge: { isSheriff: boolean } }) => p.badge.isSheriff)
          .map((p: { id: number }) => p.id),
      );
      expect(dead(buildReplayFrame(input, 0).snapshot)).toEqual([]);
      expect(buildReplayFrame(input, 0).snapshot.decision).toBeNull();
      expect(renderToStaticMarkup(<ReplayFrame input={input} frame={0} />)).not.toContain(
        "undefined",
      );
      const deaths = replay.events
        .filter((e) => e.type === "night_resolved")
        .map((e) => e.payload.deaths);
      if (variant === "last-wolf-borrow-backlash") expect(deaths).toEqual([[2], [11], [1, 10]]);
      if (variant === "last-god-restored-dream-gap") expect(deaths).toEqual([[8], [9], [4, 1]]);
      if (variant === "borrowed-dream-death-badge-words") expect(deaths).toEqual([[2], [6, 10, 5]]);
      if (variant === "independent-stock-card16-card17") expect(deaths).toEqual([[2], [6], [], []]);
    });
    for (const actor of ["maid", "count", "seer", "witch", "dreamer", "pack", "villager"] as const)
      test(`Radiant actual owner archive and authorized minimal movie/${variant}/${actor}/${locale}`, () => {
        const god = readReplayDocument(load(name, ".replay.json"));
        const view = readReplayPlayerView(load(`player-views/${name}-${actor}`, ".player.json"));
        const events = view.timeline.flatMap((row) =>
          row.kind === "event"
            ? [
                {
                  seq: row.seq,
                  timestamp: row.timestamp!,
                  phase: row.phase,
                  day: row.day,
                  type: row.event.type,
                  payload: row.event.payload,
                },
              ]
            : [],
        );
        expect(events.some((e) => e.type === "eclipse_lease_closed")).toBe(false);
        for (const e of events) {
          if (e.type === "eclipse_swallowed") expect(actor).toBe("maid");
          if (e.type === "eclipse_native_suppressed" || e.type === "eclipse_native_restored") {
            expect(e.payload.playerId).toBe(view.player_id);
            expect(Object.keys(e.payload).sort()).toEqual(["day", "playerId"]);
          }
          if (e.type === "radiant_shelter_chosen") expect(e.payload.actorId).toBe(view.player_id);
          if (
            actor === "maid" &&
            ["wolf_tactical_order", "wolf_discussion", "wolf_discussion_ended"].includes(e.type)
          )
            throw Error("maid_pack_history_exposed");
        }
        const replay = readReplayDocument({
          ...god,
          result: { winner: null, reason: "private_render" },
          players: god.players.map((p) => ({
            ...p,
            role: p.player_id === view.player_id ? view.role : "unknown",
            camp: p.player_id === view.player_id ? view.camp : "unknown",
          })),
          events: events.map((e, i) => ({ ...e, seq: i + 1 })),
        });
        const input = createReplayRenderInput(replay, { locale, timeZone: "UTC" });
        for (const e of input.replay.events.filter(
          (e) => privateFact(e.type) || e.type === "night_resolved",
        )) {
          const index = input.replay.events.findIndex((x) => x.seq === e.seq),
            f = buildReplayFrame(input, index * 90 + 45);
          expect(f.label).toBe(eventLabel(e, locale));
          expect(
            f.snapshot.players
              .filter((p) => p.playerId !== view.player_id)
              .every((p) => p.role === "unknown" && p.camp === "unknown"),
          ).toBe(true);
          expect(
            renderToStaticMarkup(<ReplayFrame input={input} frame={index * 90 + 45} />),
          ).toContain(renderToStaticMarkup(<span>{f.label}</span>).slice(6, -7));
          if (index > 0)
            expect(buildReplayFrame(input, index * 90 - 1).snapshot.players).toEqual(
              buildReplaySnapshot(input.replay, index - 1).players,
            );
        }
        expect(buildReplayFrame(input, 0).snapshot.decision).toBeNull();
      });
  }
for (const locale of ["en", "zh-CN"] as const)
  test(`Radiant actual aborted paid prefix has no night announcement, restoration or winner/${locale}`, () => {
    const name = `radiant-failed-paid-potion-${locale}`,
      replay = readReplayDocument(load(name, ".replay.json")),
      cp = load(name, ".checkpoint.txt");
    expect(cp.complete).toBe(false);
    expect(replay.events.filter((e) => e.type === "night_resolved")).toHaveLength(1);
    expect(
      replay.events.some((e) => e.type === "game_over" || e.type === "eclipse_native_restored"),
    ).toBe(false);
    expect(replay.events.at(-1)).toMatchObject({
      type: "eclipse_lease_closed",
      payload: { status: "aborted", day: 2 },
    });
    expect(
      replay.events.filter((e) => e.type === "witch_potion_used" && e.payload.actorId === 1),
    ).toHaveLength(1);
    const input = createReplayRenderInput(replay, { locale, timeZone: "UTC" });
    for (let frame = 0; frame < input.replay.events.length * 90; frame += 45)
      expect(buildReplayFrame(input, frame).snapshot.decision).toBeNull();
    expect(
      dead(buildReplayFrame(input, (input.replay.events.length - 1) * 90 + 89).snapshot),
    ).toEqual([10, 11]);
    const witch = readReplayPlayerView(load(`player-views/${name}-witch`, ".player.json"));
    const facts = witch.timeline.flatMap((row) => (row.kind === "event" ? [row.event.type] : []));
    expect(facts).toContain("eclipse_native_suppressed");
    expect(facts).not.toContain("eclipse_native_restored");
    expect(facts).not.toContain("eclipse_lease_closed");
  });
