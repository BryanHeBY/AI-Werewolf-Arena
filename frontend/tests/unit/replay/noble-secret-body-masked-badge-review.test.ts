import { test, expect } from "bun:test";
import { readFileSync } from "node:fs";
import { readReplayDocument, readReplayPlayerView } from "@ai-werewolf-arena/replay-contract";
import { createReplayRenderInput, buildReplayFrame } from "../../../src/replay/replay-frame";

// Actual backend-exported viewer archive; no God event or unmasked role is fed
// into the private movie. The God roster supplies only public seat/name fields.
for (const locale of ["en", "zh-CN"] as const) {
  test(`actual villager movie reveals the live Body only after public fact/${locale}`, () => {
    const root = new URL("../../fixtures/", import.meta.url).pathname;
    const god = readReplayDocument(
      JSON.parse(readFileSync(root + `noble-badge_reveal-${locale}.replay.json`, "utf8")),
    );
    const owner = readReplayPlayerView(
      JSON.parse(
        readFileSync(
          root + `player-views/noble-badge_reveal-${locale}-villager.player.json`,
          "utf8",
        ),
      ),
    );
    const events = owner.timeline
      .flatMap((row) =>
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
      )
      .map((e, i) => ({ ...e, seq: i + 1 }));
    const movie = readReplayDocument({
      ...god,
      result: { winner: null, reason: "private_render" },
      players: god.players.map((p) => ({
        ...p,
        role: p.player_id === owner.player_id ? owner.role : "unknown",
        camp: p.player_id === owner.player_id ? owner.camp : "unknown",
      })),
      events,
    });
    const reveal = events.find((e) => e.type === "secret_body_revealed")!;
    const bodyId = reveal.payload.actorId;
    expect(bodyId).not.toBe(owner.player_id);
    const input = createReplayRenderInput(movie, { locale, timeZone: "UTC" });
    const index = input.replay.events.findIndex((e) => e.seq === reveal.seq);
    expect(index).toBeGreaterThan(0);
    const at = (frame: number) =>
      buildReplayFrame(input, frame).players.find((p) => p.playerId === bodyId)!;
    const before = at(index * 90 - 1),
      shown = at(index * 90 + 45);
    expect(before.role).toBe("unknown");
    expect(before.publicRole).toBeUndefined();
    expect(before.roleLabel).toBe("unknown");
    expect(shown.publicRole).toBe("awakened_idiot");
    expect(shown.role).toBe("unknown");
    expect([shown.alive, shown.isSheriff, shown.camp]).toEqual([true, true, "unknown"]);
    expect(shown.roleLabel).toBe(locale === "en" ? "Awakened Village Idiot" : "觉醒愚者");
    expect(at(index * 90 - 1)).toEqual(before);
    expect(at(0).roleLabel).toBe("unknown");
  });
}
