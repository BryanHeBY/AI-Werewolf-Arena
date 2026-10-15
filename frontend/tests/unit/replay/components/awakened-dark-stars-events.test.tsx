/**
 * 单元测试负责暗夜星辰五类付款/公开结果的双语时间线和帧投影。输入手写字面事件，输出自然文案与关联席位。
 * 不运行后端或根据付款伪造实际死亡；God原伤害仅为展示，真正Alive变化由独立通用死亡事实拥有。
 */
import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { readReplayDocument } from "@ai-werewolf-arena/replay-contract";
import { createReplayRenderInput, buildReplayFrame } from "../../../../src/replay/replay-frame";
import { renderToStaticMarkup } from "react-dom/server";
import type { ReplayDocument } from "@ai-werewolf-arena/replay-contract";
import { AWAKENED_BEAUTY_POLICY as bp } from "@ai-werewolf-arena/game-contract/facts/awakened-beauty";
import { AWAKENED_PATROL_POLICY as pp } from "@ai-werewolf-arena/game-contract/facts/awakened-patrol";
import { eventLabel } from "../../../../src/replay/event-labels";
import { readReplayEvent } from "../../../../src/replay/replay-event-reader";
import { buildReplaySnapshot } from "../../../../src/replay/replay-projection";
import { EventTimeline } from "../../../../src/replay/EventTimeline";
function doc(): ReplayDocument {
  return {
    schemaVersion: 2,
    perspective: "god",
    sessionId: "dark_stars_literal",
    meta: { board: "dark_stars_literal", startedAt: "t1", endedAt: "t2" },
    result: { winner: null, reason: null },
    players: Array.from({ length: 10 }, (_, i) => ({
      player_id: i + 1,
      seat: i + 1,
      role: "villager",
      camp: "good",
    })),
    events: [
      {
        type: "awakened_charm_chosen",
        payload: { policy: bp, day: 1, actorId: 3, targetId: 8, nextAllowedNight: 3 },
        phase: "night",
      },
      {
        type: "awakened_beauty_replacement_paid",
        payload: {
          policy: bp,
          day: 1,
          actorId: 3,
          targetId: 8,
          phase: "voting",
          rootPhase: "voting",
          preventedCauses: ["exile"],
        },
        phase: "voting",
      },
      {
        type: "awakened_beauty_replaced",
        payload: { policy: bp, day: 1, actorId: 3, targetId: 8, targetDied: true },
        phase: "voting",
      },
      {
        type: "awakened_patrol_paid",
        payload: {
          policy: pp,
          day: 1,
          actorId: 8,
          rootPhase: "voting",
          direction: "clockwise",
          targetId: 3,
        },
        phase: "voting",
      },
      {
        type: "awakened_patrol_resolved",
        payload: { policy: pp, day: 1, actorId: 8, direction: "clockwise", targetId: null },
        phase: "voting",
      },
    ].map((e, i) => ({ ...e, seq: i + 1, day: 1, timestamp: `2026-10-16T00:00:0${i}Z` })),
  } as ReplayDocument;
}
for (const locale of ["zh-CN", "en"] as const)
  test(`字面五事实自然文案且不写生命/${locale}`, () => {
    const r = doc(),
      ids = r.players.map((p) => p.player_id);
    for (const [i, e] of r.events.entries()) {
      const parsed = readReplayEvent(e, ids);
      expect(parsed).not.toBeNull();
      expect(parsed!.effects).toEqual([]);
      expect(buildReplaySnapshot(r, i).players).toEqual(buildReplaySnapshot(r, i - 1).players);
      const label = eventLabel(e, locale, ids);
      expect(label).not.toMatch(/policy|targetId|undefined|NaN/);
      if (locale === "en") expect(label).not.toMatch(/\p{Script=Han}/u);
      expect(readReplayEvent({ ...e, day: 2 }, ids)).toBeNull();
      expect(readReplayEvent({ ...e, payload: { ...e.payload, secret: true } }, ids)).toBeNull();
    }
    expect(readReplayEvent(r.events[4]!, ids)!.relatedPlayerIds).toEqual([8]);
    const html = renderToStaticMarkup(
      <EventTimeline
        events={r.events}
        locale={locale}
        playerIds={ids}
        activeEventSeq={1}
        focusedPlayerId={null}
        onJumpTo={() => {}}
        onClearFocus={() => {}}
      />,
    );
    expect(html).not.toMatch(/undefined|NaN/);
    expect(html).toContain(locale === "en" ? "patrol" : "巡猎");
  });
test("严格拒绝错阶段/不存在目标，不把原命中目标伪成已死", () => {
  const r = doc(),
    ids = r.players.map((p) => p.player_id);
  expect(readReplayEvent({ ...r.events[0]!, phase: "voting" }, ids)).toBeNull();
  expect(readReplayEvent({ ...r.events[2]!, phase: "night" }, ids)).toBeNull();
  expect(
    readReplayEvent({ ...r.events[3]!, payload: { ...r.events[3]!.payload, targetId: 99 } }, ids),
  ).toBeNull();
  expect(
    readReplayEvent({ ...r.events[4]!, payload: { ...r.events[4]!.payload, targetId: 3 } }, ids)!
      .effects,
  ).toEqual([]);
});
for (const [size, path] of [
  [10, "night_patrol"],
  [12, "day_replacement"],
] as const)
  for (const locale of ["zh-CN", "en"] as const)
    test(`真实God档事件、关键帧和逆seek/${size}/${path}/${locale}`, () => {
      const r = readReplayDocument(
          JSON.parse(
            readFileSync(
              new URL(
                `../../../../../docs/examples/awakened-dark-stars/${size}-${path}-${locale}.replay.json`,
                import.meta.url,
              ),
              "utf8",
            ),
          ),
        ),
        ids = r.players.map((p) => p.player_id),
        input = createReplayRenderInput(r, { locale, timeZone: "UTC" });
      const family = r.events.filter((e) =>
        [
          "awakened_charm_chosen",
          "awakened_beauty_replacement_paid",
          "awakened_beauty_replaced",
          "awakened_patrol_paid",
          "awakened_patrol_resolved",
        ].includes(e.type),
      );
      expect(family).toHaveLength(size === 10 ? 3 : 5);
      for (const e of family) {
        const at = r.events.indexOf(e),
          parsed = readReplayEvent(e, ids)!;
        expect(parsed).not.toBeNull();
        expect(parsed.effects).toEqual([]);
        const before = buildReplaySnapshot(r, at - 1),
          after = buildReplaySnapshot(r, at),
          shown = input.replay.events.findIndex((x) => x.seq === e.seq);
        expect(after.players).toEqual(before.players);
        expect(buildReplayFrame(input, shown * 90 + 45).snapshot.players).toEqual(after.players);
        if (shown > 0)
          expect(buildReplayFrame(input, shown * 90 - 1).snapshot.players).toEqual(before.players);
        const label = eventLabel(e, locale, ids);
        expect(label).not.toMatch(/targetId|preventedCauses|policy|undefined|NaN/);
        if (locale === "en") expect(label).not.toMatch(/\p{Script=Han}/u);
      }
      const paid = r.events.find((e) => e.type === "awakened_patrol_paid")!,
        resolved = r.events.find((e) => e.type === "awakened_patrol_resolved")!,
        before = buildReplaySnapshot(r, r.events.indexOf(paid)),
        after = buildReplaySnapshot(r, r.events.indexOf(resolved));
      const hunter = size === 10 ? 4 : 2,
        beauty = size === 10 ? 5 : 3,
        actual = size === 10 ? 5 : 6;
      expect(before.players.find((p) => p.playerId === hunter)!.alive).toBe(false);
      expect(before.players.find((p) => p.playerId === beauty)!.alive).toBe(true);
      expect(after.players.find((p) => p.playerId === actual)!.alive).toBe(false);
      expect(after.players.find((p) => p.playerId === beauty)!.alive).toBe(size !== 10);
      expect(paid.payload.targetId).toBe(beauty);
      expect(resolved.payload.targetId).toBe(actual);
      expect(readReplayEvent(resolved, ids)!.relatedPlayerIds).toEqual(
        [hunter, actual].sort((a, b) => a - b),
      );
      const html = renderToStaticMarkup(
        <EventTimeline
          events={family}
          locale={locale}
          playerIds={ids}
          activeEventSeq={paid.seq}
          focusedPlayerId={actual}
          onJumpTo={() => {}}
          onClearFocus={() => {}}
        />,
      );
      expect(html).toContain(locale === "en" ? "patrol" : "巡猎");
      expect(html).not.toMatch(/undefined|NaN/);
    });
