import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { readReplayDocument } from "@ai-werewolf-arena/replay-contract";
import { eventLabel } from "../../../src/replay/event-labels";
import { buildReplaySnapshot } from "../../../src/replay/replay-projection";
import {
  createReplayRenderInput,
  buildReplayFrame,
  FRAMES_PER_EVENT,
} from "../../../src/replay/replay-frame";
import { ReplayFrame } from "../../../src/replay/ReplayComposition";
import twelve from "../../fixtures/mirror-twelve.replay.json";

for (const locale of ["zh-CN", "en"] as const)
  test(`${locale}: a neutral shot preserves legacy God seats and renders without a gun-owner role label`, () => {
    const old = readReplayDocument(twelve),
      oldIndex = old.events.findIndex((e) => e.type === "hunter_shot");
    expect(oldIndex).toBeGreaterThan(0);
    const raw = structuredClone(twelve);
    const shot = raw.events[oldIndex];
    const before = structuredClone(shot);
    shot.type = "player_shot";
    shot.stage = "death_shot";
    shot.payload = { actorId: 7, targetId: 2 } as typeof shot.payload;
    const replay = readReplayDocument(raw),
      event = replay.events[oldIndex];
    expect(
      buildReplaySnapshot(replay, oldIndex - 1).players.find((p) => p.playerId === 2)!.alive,
    ).toBe(true);
    expect(buildReplaySnapshot(replay, oldIndex).players).toEqual(
      buildReplaySnapshot(old, oldIndex).players,
    );
    expect(buildReplaySnapshot(replay, oldIndex).players.find((p) => p.playerId === 2)!.alive).toBe(
      false,
    );
    const label = locale === "en" ? "Player 7 shoots player 2" : "7号开枪带走2号";
    expect(eventLabel(event, locale)).toBe(label);
    const input = createReplayRenderInput(replay, { locale, timeZone: "UTC" });
    const frame = input.replay.events.findIndex((e) => e.seq === event.seq) * FRAMES_PER_EVENT + 10;
    expect(buildReplayFrame(input, frame).label).toBe(label);
    expect(renderToStaticMarkup(<ReplayFrame input={input} frame={frame} />)).toContain(label);
    expect(old.events[oldIndex]).toMatchObject(before);
    expect(eventLabel(old.events[oldIndex], locale)).toBe(
      locale === "en" ? "Hunter 7 shoots player 2" : "7号猎人开枪带走2号",
    );
  });
