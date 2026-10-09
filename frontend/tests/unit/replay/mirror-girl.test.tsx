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
import skip from "../../fixtures/mirror-skip.replay.json";
import exhausted from "../../fixtures/mirror-exhausted.replay.json";
import twelve from "../../fixtures/mirror-twelve.replay.json";
import king from "../../fixtures/mirror-king_badge.replay.json";

for (const locale of ["zh-CN", "en"] as const)
  for (const empty of [false, true])
    test(`${locale}/${empty}: actual Mirror pass/exhaustion labels close a private opportunity without changing any seat or reports`, () => {
      const raw = structuredClone(empty ? exhausted : skip),
        before = structuredClone(raw),
        replay = readReplayDocument(raw),
        event = replay.events.find(
          (e) => e.type === "role_inspection_skipped" && e.day === (empty ? 6 : 2),
        )!,
        index = replay.events.indexOf(event);
      expect(buildReplaySnapshot(replay, index).players).toEqual(
        buildReplaySnapshot(replay, index - 1).players,
      );
      expect(
        buildReplaySnapshot(replay, index).players.find((p) => p.playerId === 3),
      ).toMatchObject({ role: "mirror_girl", camp: "good", alive: true, isWinner: false });
      const label =
        locale === "en"
          ? `Player 3 ends the inspection opportunity on night ${empty ? 6 : 2}: ${empty ? "No eligible living targets" : "Passed"}`
          : `3号在第${empty ? 6 : 2}夜结束查验机会：${empty ? "没有可查验的存活目标" : "主动跳过"}`;
      expect(eventLabel(event, locale)).toBe(label);
      const input = createReplayRenderInput(replay, { locale, timeZone: "UTC" }),
        frame = input.replay.events.findIndex((e) => e.seq === event.seq) * FRAMES_PER_EVENT + 10;
      expect(buildReplayFrame(input, frame).label).toBe(label);
      const markup = renderToStaticMarkup(<ReplayFrame input={input} frame={frame} />);
      expect(markup).toContain(label);
      expect(markup).toContain(locale === "en" ? "Mirror Girl" : "魔镜少女");
      expect(markup).toBe(renderToStaticMarkup(<ReplayFrame input={input} frame={frame} />));
      expect(raw).toEqual(before);
    });

for (const locale of ["zh-CN", "en"] as const)
  test(`${locale}: twelve actual Mirror reports contain different identities, keep real seats intact and retain dead winners`, () => {
    const replay = readReplayDocument(twelve),
      reports = replay.events.filter((e) => e.type === "role_inspected");
    expect(reports.map((e) => [e.payload.targetId, e.payload.result])).toEqual([
      [6, { kind: "role", role: "witch" }],
      [1, { kind: "role", role: "wolf" }],
      [8, { kind: "role", role: "guard" }],
    ]);
    const event = reports[2],
      index = replay.events.indexOf(event);
    expect(buildReplaySnapshot(replay, index).players).toEqual(
      buildReplaySnapshot(replay, index - 1).players,
    );
    expect(eventLabel(event, locale)).toBe(
      locale === "en" ? "Player 5 inspects player 8's role: Guard" : "5号查验8号的具体角色：守卫",
    );
    const final = buildReplaySnapshot(replay, replay.events.length - 1);
    expect(final.players.filter((p) => p.alive).map((p) => p.playerId)).toEqual([5, 8, 10, 11, 12]);
    expect(final.players.filter((p) => p.isWinner).map((p) => p.playerId)).toEqual([
      5, 6, 7, 8, 9, 10, 11, 12,
    ]);
  });

for (const locale of ["zh-CN", "en"] as const)
  test(`${locale}: actual Mirror death and both badge transfers remain separate from inspection and final victory`, () => {
    const replay = readReplayDocument(king),
      report = replay.events.findIndex((e) => e.type === "role_inspected"),
      shot = replay.events.findIndex((e) => e.type === "wolf_king_shot");
    expect(report).toBeLessThan(shot);
    expect(buildReplaySnapshot(replay, report).players.find((p) => p.playerId === 3)!.alive).toBe(
      true,
    );
    expect(buildReplaySnapshot(replay, shot).players.find((p) => p.playerId === 3)!.alive).toBe(
      false,
    );
    expect(
      replay.events
        .filter((e) => e.type === "sheriff_badge_transferred")
        .map((e) => [e.payload.fromId, e.payload.toId]),
    ).toEqual([
      [1, 2],
      [2, 4],
    ]);
    const final = buildReplaySnapshot(replay, replay.events.length - 1);
    expect(final.players.find((p) => p.playerId === 3)).toMatchObject({
      role: "mirror_girl",
      camp: "good",
      alive: false,
      isWinner: true,
    });
    expect(final.players.filter((p) => p.isSheriff).map((p) => p.playerId)).toEqual([4]);
  });
