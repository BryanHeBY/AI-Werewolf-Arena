/**
 * Unit component tests for miracle merchant replay display.
 * Input: existing recorded or literal replay data, event cursors and explicit
 * language/frame settings; output: the original seat, timeline and rendered
 * frame assertions. Handwritten visibility/state expectations and immutable
 * archives are independent oracles. No live game or model transport executes.
 */
import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { readReplayDocument } from "@ai-werewolf-arena/replay-contract";
import { eventLabel } from "../../../../src/replay/event-labels";
import { buildReplaySnapshot } from "../../../../src/replay/replay-projection";
import {
  createReplayRenderInput,
  buildReplayFrame,
  FRAMES_PER_EVENT,
} from "../../../../src/replay/replay-frame";
import { ReplayFrame } from "../../../../src/replay/ReplayComposition";
import poison from "../../../fixtures/six-player-merchant-poison/merchant-poison/zh-CN/god.replay.json";
import dream from "../../../fixtures/six-player-merchant-dream/merchant-dream/en/god.replay.json";
import twelve from "../../../fixtures/twelve-player-merchant-twelve/merchant-twelve/en/god.replay.json";
for (const locale of ["zh-CN", "en"] as const)
  for (const outcome of [false, true])
    test(`${locale}/${outcome}: real Merchant choice and God backlash proposal are labels, not premature deaths`, () => {
      const raw = structuredClone(outcome ? dream : poison),
        before = structuredClone(raw),
        replay = readReplayDocument(raw),
        event = replay.events.find(
          (e) => e.type === (outcome ? "merchant_trade_resolved" : "merchant_trade_committed"),
        )!,
        index = replay.events.indexOf(event);
      const previous = buildReplaySnapshot(replay, index - 1),
        snapshot = buildReplaySnapshot(replay, index);
      expect(snapshot.players).toEqual(previous.players);
      expect(snapshot.players.find((p) => p.playerId === 3)!.alive).toBe(true);
      expect(snapshot.players.find((p) => p.playerId === 3)!.role).toBe("miracle_merchant");
      expect(snapshot.decision).toBeNull();
      const label = outcome
        ? locale === "en"
          ? "God trade result: player 3 to player 1, Inspection, night 1: Backlash proposal."
          : "【上帝交易结果】第1夜3号对1号的查验：反噬提案。"
        : locale === "en"
          ? "Miracle Merchant player 3 chose to bestow Poison on player 5 on night 1."
          : "【奇迹商人】3号第1夜对5号选择赠予毒药。";
      expect(eventLabel(event, locale)).toBe(label);
      const input = createReplayRenderInput(replay, { locale, timeZone: "UTC" }),
        frame = input.replay.events.findIndex((e) => e.seq === event.seq) * FRAMES_PER_EVENT + 10;
      expect(buildReplayFrame(input, frame).label).toBe(label);
      const markup = renderToStaticMarkup(<ReplayFrame input={input} frame={frame} />);
      expect(markup).toContain(label);
      expect(markup).toBe(renderToStaticMarkup(<ReplayFrame input={input} frame={frame} />));
      expect(raw).toEqual(before);
      const final = buildReplaySnapshot(replay, replay.events.length - 1);
      expect(final.players.filter((p) => p.alive).map((p) => p.playerId)).toEqual(
        outcome ? [3, 4] : [3, 5, 6],
      );
    });
for (const locale of ["zh-CN", "en"] as const)
  test(`${locale}: extra Lucky inspection leaves the native Seer identity alive and final winners include dead Good players`, () => {
    const replay = readReplayDocument(twelve),
      event = replay.events.find(
        (e) => e.type === "seer_checked" && e.payload.abilityId === "gift:miracle",
      )!,
      index = replay.events.indexOf(event);
    expect(event.payload).toEqual({
      actorId: 5,
      abilityId: "gift:miracle",
      targetId: 2,
      isWerewolf: true,
      result: { kind: "camp", camp: "wolf" },
    });
    expect(buildReplaySnapshot(replay, index).players).toEqual(
      buildReplaySnapshot(replay, index - 1).players,
    );
    expect(eventLabel(event, locale)).toBe(
      locale === "en" ? "Player 5 checks player 2: Werewolves" : "5号查验2号：狼人",
    );
    const final = buildReplaySnapshot(replay, replay.events.length - 1);
    expect(final.players.filter((p) => p.alive).map((p) => p.playerId)).toEqual([5, 7, 10, 11, 12]);
    expect(final.players.filter((p) => p.isWinner).map((p) => p.playerId)).toEqual([
      5, 6, 7, 8, 9, 10, 11, 12,
    ]);
  });
for (const locale of ["zh-CN", "en"] as const)
  test(`${locale}: malformed Merchant enum/IDs never fabricate a successful transaction`, () => {
    const replay = readReplayDocument(poison),
      event = replay.events.find((e) => e.type === "merchant_trade_resolved")!,
      unknown = locale === "en" ? "Unknown" : "未知";
    for (const payload of [
      { ...event.payload, outcome: "unknown" },
      { ...event.payload, skill: "shoot" },
      { ...event.payload, actorId: 0 },
      { ...event.payload, targetId: 1.5 },
    ])
      expect(eventLabel({ ...event, payload }, locale)).toBe(unknown);
    let reads = 0;
    const payload = { ...event.payload };
    Object.defineProperty(payload, "outcome", {
      enumerable: true,
      get() {
        reads++;
        return "granted";
      },
    });
    expect(eventLabel({ ...event, payload }, locale)).toBe(unknown);
    expect(reads).toBe(0);
  });
