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
import king from "../../fixtures/gargoyle-king-link.replay.json";
import twelve from "../../fixtures/gargoyle-twelve.replay.json";
for (const locale of ["zh-CN", "en"] as const)
  for (const large of [false, true])
    test(`${locale}/${large}: actual Gargoyle inheritance changes no seat/identity and the later real death preserves membership and pure frames`, () => {
      const raw = structuredClone(large ? twelve : king);
      raw.meta.locale = locale;
      const before = structuredClone(raw),
        replay = readReplayDocument(raw),
        index = replay.events.findIndex((e) => e.type === "gargoyle_awakened"),
        event = replay.events[index],
        previous = buildReplaySnapshot(replay, index - 1),
        snapshot = buildReplaySnapshot(replay, index);
      expect(event.payload).toEqual({ actorId: 1, day: large ? 2 : 1 });
      expect(snapshot.players).toEqual(previous.players);
      expect(snapshot.players.find((p) => p.playerId === 1)!.alive).toBe(true);
      expect(snapshot.decision).toBeNull();
      const label =
        locale === "en"
          ? `Gargoyle 1 inherits the knife on day ${large ? 2 : 1}`
          : `1号石像鬼在第${large ? 2 : 1}天获得刀权`;
      expect(eventLabel(event, locale)).toBe(label);
      const input = createReplayRenderInput(replay, { locale, timeZone: "UTC" }),
        frame = input.replay.events.findIndex((e) => e.seq === event.seq) * FRAMES_PER_EVENT + 10;
      expect(buildReplayFrame(input, frame).label).toBe(label);
      const markup = renderToStaticMarkup(<ReplayFrame input={input} frame={frame} />);
      expect(markup).toContain(label);
      expect(markup).toBe(renderToStaticMarkup(<ReplayFrame input={input} frame={frame} />));
      const final = buildReplaySnapshot(replay, replay.events.length - 1);
      expect(final.players.find((p) => p.playerId === 1)!.alive).toBe(false);
      expect(final.players.filter((p) => p.isWinner).map((p) => p.playerId)).toEqual(
        large ? [5, 6, 7, 8, 9, 10, 11, 12] : [3, 4, 5, 6],
      );
      expect(raw).toEqual(before);
    });
for (const locale of ["zh-CN", "en"] as const)
  test(`${locale}: concrete role reports change no public seat and remain different from camp results`, () => {
    const raw = structuredClone(twelve),
      replay = readReplayDocument(raw),
      index = replay.events.findIndex((e) => e.type === "role_inspected"),
      event = replay.events[index];
    expect(event.payload.result).toEqual({ kind: "role", role: "seer" });
    expect(buildReplaySnapshot(replay, index).players).toEqual(
      buildReplaySnapshot(replay, index - 1).players,
    );
    const label =
      locale === "en" ? "Player 1 inspects player 5's role: Seer" : "1号查验5号的具体角色：预言家";
    expect(eventLabel(event, locale)).toBe(label);
    const input = createReplayRenderInput(replay, { locale, timeZone: "UTC" }),
      frame = input.replay.events.findIndex((e) => e.seq === event.seq) * FRAMES_PER_EVENT + 10;
    expect(buildReplayFrame(input, frame).label).toBe(label);
    expect(renderToStaticMarkup(<ReplayFrame input={input} frame={frame} />)).toContain(
      label.replaceAll("'", "&#x27;"),
    );
    expect(
      eventLabel(
        { ...event, payload: { ...event.payload, result: { kind: "camp", camp: "wolf" } } },
        locale,
      ),
    ).toBe(locale === "en" ? "Unknown" : "未知");
    expect(raw).toEqual(twelve);
  });
