import { expect, test } from "bun:test";
import { readReplayDocument } from "@ai-werewolf-arena/replay-contract";
import { blackMarketEventLabel, text } from "@ai-werewolf-arena/game-text";
import { eventLabel } from "../../../src/replay/event-labels";
import { buildReplaySnapshot } from "../../../src/replay/replay-projection";
import { createReplayRenderInput, FRAMES_PER_EVENT } from "../../../src/replay/replay-frame";
import { ReplayFrame } from "../../../src/replay/ReplayComposition";
import { renderToStaticMarkup } from "react-dom/server";
import gun from "../../fixtures/black-market-twelve_gun.replay.json";
import backlash from "../../fixtures/black-market-twelve_backlash.replay.json";
import lastGod from "../../fixtures/black-market-last_god.replay.json";
import check from "../../fixtures/black-market-check_duplicate.replay.json";
import late from "../../fixtures/black-market-late_hold.replay.json";
for (const locale of ["zh-CN", "en"] as const) {
  test(`${locale}: actual Black choice and God outcome never change original role or prematurely kill`, () => {
    for (const raw of [gun, backlash]) { const original = structuredClone(raw), replay = readReplayDocument(raw);
      for (const type of ["black_market_trade_committed", "black_market_trade_resolved"]) { const i = replay.events.findIndex(e => e.type === type); expect(buildReplaySnapshot(replay, i).players).toEqual(buildReplaySnapshot(replay, i - 1).players); const event = replay.events[i], input = createReplayRenderInput(replay, { locale, timeZone: "UTC" }), frame = input.replay.events.findIndex(e => e.seq === event.seq) * FRAMES_PER_EVENT + 10; expect(renderToStaticMarkup(<ReplayFrame input={input} frame={frame} />)).toContain(eventLabel(event, locale)); }
      expect(buildReplaySnapshot(replay, 0).players[6]).toMatchObject({ role: "black_market_merchant", camp: "good", alive: true, isWinner: false }); expect(raw).toEqual(original);
    }
  });
  test(`${locale}: Black backlash respects actual death timing and both Sheriff transfers in the God archive`, () => {
    const replay = readReplayDocument(backlash), choice = replay.events.findIndex(e => e.type === "black_market_trade_resolved"), death = replay.events.findIndex(e => e.type === "night_resolved");
    expect(buildReplaySnapshot(replay, choice).players[6].alive).toBe(true); expect(buildReplaySnapshot(replay, death).players[6].alive).toBe(false);
    expect(replay.events.filter(e => e.type === "sheriff_badge_transferred").map(e => [e.payload.fromId, e.payload.toId])).toEqual([[7, 1], [1, 6]]);
    const final = buildReplaySnapshot(replay, replay.events.length - 1); expect(final.players.filter(p => p.alive).map(p => p.playerId)).toEqual([6, 8, 9, 10, 11, 12]); expect(final.players.filter(p => p.isWinner).map(p => p.playerId)).toEqual([5, 6, 7, 8, 9, 10, 11, 12]); expect(final.players[6]).toMatchObject({ alive: false, isWinner: true, role: "black_market_merchant" });
  });
  test(`${locale}: independent gift inspection and held poison remain choices until actual settlement`, () => {
    const replay = readReplayDocument(check), report = replay.events.findIndex(e => e.type === "seer_checked" && e.payload.targetId === 2); expect(buildReplaySnapshot(replay, report).players).toEqual(buildReplaySnapshot(replay, report - 1).players); expect(buildReplaySnapshot(replay, report).players[3].role).toBe("seer");
    const held = readReplayDocument(late), skipped = held.events.findIndex(e => e.type === "lucky_ability_skipped"), poison = held.events.findIndex(e => e.type === "witch_potion_used" && e.payload.actorId === 6); expect(held.events[skipped].day).toBe(3); expect(held.events[poison].day).toBe(4); expect(buildReplaySnapshot(held, poison).players[1].alive).toBe(true);
  });
  test(`${locale}: first gun clears the last God but the second gun still settles before victory`, () => {
    const replay = readReplayDocument(lastGod), native = replay.events.findIndex(e => e.type === "hunter_shot"), gift = replay.events.findIndex(e => e.type === "player_shot"); expect(replay.events[native].payload.targetId).toBe(3); expect(replay.events[gift].payload.targetId).toBe(1); expect(buildReplaySnapshot(replay, native).decision).toBeNull(); expect(buildReplaySnapshot(replay, gift).decision).toBeNull(); expect(buildReplaySnapshot(replay, replay.events.length - 1).players.filter(p => p.isWinner).map(p => p.playerId)).toEqual([3, 4, 5, 6]);
  });
  test(`${locale}: malformed Black labels return unknown without executing a getter`, () => {
    let reads = 0; const p = Object.defineProperty({ day: 1, targetId: 1, skill: "check", outcome: "backlash" }, "actorId", { enumerable: true, get() { reads++; throw new Error("must_not_execute"); } });
    expect(blackMarketEventLabel("black_market_trade_resolved", p, locale)).toBe(text(locale, "replay.unknown")); expect(blackMarketEventLabel("black_market_trade_committed", { actorId: 3, day: 1, targetId: 3, skill: "guard" }, locale)).toBe(text(locale, "replay.unknown")); expect(reads).toBe(0);
  });
}
