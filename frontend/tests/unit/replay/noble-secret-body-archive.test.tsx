import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { readReplayDocument, readReplayPlayerView } from "@ai-werewolf-arena/replay-contract";
import { buildReplaySnapshot } from "../../../src/replay/replay-projection";
import {
  createReplayRenderInput,
  buildReplayFrame,
  FRAMES_PER_EVENT,
} from "../../../src/replay/replay-frame";
import { ReplayFrame } from "../../../src/replay/ReplayComposition";
import { readReplayEvent } from "../../../src/replay/replay-event-reader";
import { eventLabel } from "../../../src/replay/event-labels";
import { roleName } from "../../../src/replay/replay-localization";
const load = (name: string, suffix: string) =>
    JSON.parse(readFileSync(new URL(`../../fixtures/${name}${suffix}`, import.meta.url), "utf8")),
  families = ["expiry", "new_and_old_clear", "two_sources", "badge_reveal"] as const,
  dead = (s: ReturnType<typeof buildReplaySnapshot>) =>
    s.players.filter((p) => !p.alive).map((p) => p.playerId);
for (const locale of ["en", "zh-CN"] as const)
  test(`actual failed reveal prefix keeps the live badge without manufactured speech ${locale}`, () => {
    const fixture = `noble-failed-reveal-${locale}`,
      replay = readReplayDocument(load(fixture, ".replay.json")),
      cp = load(fixture, ".checkpoint.txt"),
      input = createReplayRenderInput(replay, { locale, timeZone: "UTC" }),
      id = Number(replay.events.find((e) => e.type === "secret_body_revealed")!.payload.actorId);
    expect(cp.complete).toBe(false);
    expect(cp.nobleBody.body.body).toEqual({ kind: "exile_revealed", day: 1 });
    expect(
      replay.events.some((e) =>
        [
          "game_over",
          "secret_body_reveal_speech",
          "sheriff_badge_transferred",
          "sheriff_badge_destroyed",
        ].includes(e.type),
      ),
    ).toBe(false);
    for (let frame = 0; frame < input.replay.events.length * 90; frame += 45)
      expect(buildReplayFrame(input, frame).snapshot.decision).toBeNull();
    const final = buildReplayFrame(input, (input.replay.events.length - 1) * 90 + 89).players.find(
      (p) => p.playerId === id,
    )!;
    expect([final.alive, final.isSheriff, final.publicRole]).toEqual([
      true,
      true,
      "awakened_idiot",
    ]);
    expect(
      dead(buildReplayFrame(input, (input.replay.events.length - 1) * 90 + 89).snapshot),
    ).toEqual([]);
  });
for (const locale of ["en", "zh-CN"] as const)
  for (const name of families) {
    const fixture = `noble-${name}-${locale}`;
    test(`actual Noble God frames preserve announcement boundaries and living reveal ${fixture}`, () => {
      const replay = readReplayDocument(load(fixture, ".replay.json")),
        cp = load(fixture, ".checkpoint.txt"),
        input = createReplayRenderInput(replay, { locale, timeZone: "UTC" }),
        ids = replay.players.map((p) => p.player_id);
      for (const e of replay.events.filter(
        (e) =>
          e.type.startsWith("noble_") ||
          e.type.startsWith("secret_body_") ||
          ["night_resolved", "sheriff_badge_transferred", "game_over"].includes(e.type),
      )) {
        const i = replay.events.findIndex((x) => x.seq === e.seq),
          before = buildReplaySnapshot(replay, i - 1),
          after = buildReplaySnapshot(replay, i),
          effects = readReplayEvent(e, ids)!.effects;
        if (
          e.type.startsWith("noble_") ||
          (e.type.startsWith("secret_body_") && e.type !== "secret_body_revealed")
        ) {
          expect(effects).toEqual([]);
          expect(after.players).toEqual(before.players);
        }
        if (e.type === "secret_body_revealed") {
          const id = Number(e.payload.actorId),
            p = after.players.find((p) => p.playerId === id)!,
            old = before.players.find((p) => p.playerId === id)!;
          expect(p.alive).toBe(true);
          expect(p.isSheriff).toBe(old.isSheriff);
          expect(p.publicRole).toBe("awakened_idiot");
          expect(dead(after)).toEqual(dead(before));
        }
        const j = input.replay.events.findIndex((x) => x.seq === e.seq);
        for (const offset of [0, 45, 89])
          expect(buildReplayFrame(input, j * FRAMES_PER_EVENT + offset).snapshot).toEqual(after);
        if (j > 0)
          expect(buildReplayFrame(input, j * 90 - 1).snapshot.players).toEqual(before.players);
        expect(eventLabel(e, locale, ids)).not.toContain("undefined");
        if (e.type !== "game_over") expect(after.decision).toBeNull();
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
    });
    for (const actor of ["noble", "body", "demon", "pack", "villager"] as const)
      test(`actual Noble authorized player frames and reveal ${fixture}/${actor}`, () => {
        const god = readReplayDocument(load(fixture, ".replay.json")),
          view = readReplayPlayerView(load(`player-views/${fixture}-${actor}`, ".player.json")),
          events = view.timeline.flatMap((row) =>
            row.kind === "event"
              ? [
                  {
                    seq: row.seq,
                    timestamp: row.timestamp!,
                    day: row.day,
                    phase: row.phase,
                    type: row.event.type,
                    payload: row.event.payload,
                  },
                ]
              : [],
          );
        for (const e of events) {
          expect(
            e.type.startsWith("noble_body_") ||
              ["noble_contract_closed", "secret_body_blocked"].includes(e.type),
          ).toBe(false);
          if (["noble_servant_chosen", "noble_night_notified"].includes(e.type))
            expect(actor).toBe("noble");
          if (["secret_body_chosen", "secret_body_night_notified"].includes(e.type))
            expect(actor).toBe("body");
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
          }),
          input = createReplayRenderInput(replay, { locale, timeZone: "UTC" });
        for (const [i, e] of input.replay.events.entries()) {
          if (
            !e.type.startsWith("noble_") &&
            !e.type.startsWith("secret_body_") &&
            e.type !== "night_resolved"
          )
            continue;
          const f = buildReplayFrame(input, i * 90 + 45);
          expect(f.label).toBe(
            eventLabel(
              e,
              locale,
              god.players.map((p) => p.player_id),
            ),
          );
          expect(
            f.snapshot.players
              .filter((p) => p.playerId !== view.player_id)
              .every((p) => p.role === "unknown" && p.camp === "unknown"),
          ).toBe(true);
          const html = renderToStaticMarkup(<ReplayFrame input={input} frame={i * 90 + 45} />);
          expect(html).not.toContain("undefined");
          if (e.type === "secret_body_revealed") {
            const id = Number(e.payload.actorId),
              p = f.players.find((p) => p.playerId === id)!;
            expect(p.alive).toBe(true);
            expect(p.roleLabel).toBe(roleName("awakened_idiot", locale));
            expect(p.isSheriff).toBe(true);
            expect(
              buildReplayFrame(input, i * 90 - 1).players.find((p) => p.playerId === id)!
                .publicRole,
            ).toBeUndefined();
            if (view.player_id !== id)
              expect(
                buildReplayFrame(input, i * 90 - 1).players.find((p) => p.playerId === id)!
                  .roleLabel,
              ).toBe("unknown");
          }
          if (i > 0)
            expect(buildReplayFrame(input, i * 90 - 1).snapshot.players).toEqual(
              buildReplaySnapshot(input.replay, i - 1).players,
            );
        }
        expect(buildReplayFrame(input, 0).snapshot.decision).toBeNull();
      });
  }
