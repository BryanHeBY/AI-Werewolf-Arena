/**
 * 用手写狼爪归档核两语时间线与帧；私有库存事实不改变存活或公开原身份。
 * actual player_shot仍独立负责死亡效果；此测试不运行引擎，不将God文档当玩家授权流。
 */
import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { readReplayDocument } from "@ai-werewolf-arena/replay-contract";
import { renderToStaticMarkup } from "react-dom/server";
import type { ReplayDocument } from "@ai-werewolf-arena/replay-contract";
import { AWAKENED_CLAW_POLICY as policy } from "@ai-werewolf-arena/game-contract/facts/awakened-claws";
import { readReplayEvent } from "../../../../src/replay/replay-event-reader";
import { eventLabel } from "../../../../src/replay/event-labels";
import { buildReplaySnapshot } from "../../../../src/replay/replay-projection";
import { createReplayRenderInput, buildReplayFrame } from "../../../../src/replay/replay-frame";
import { EventTimeline } from "../../../../src/replay/EventTimeline";
function document(): ReplayDocument {
  const unit = "awakened_claw:native:1",
    received = "awakened_claw:bequest:3:1:1";
  return {
    schemaVersion: 2,
    perspective: "god",
    sessionId: "claws_literal",
    meta: { board: "awa_awakened_wolf_king_10_v1", startedAt: "t1", endedAt: "t2" },
    result: { winner: null, reason: null },
    players: Array.from({ length: 10 }, (_, i) => ({
      player_id: i + 1,
      seat: i + 1,
      name: `Player ${i + 1}`,
      role: i === 2 ? "awakened_wolf_king" : i < 2 ? "wolf" : "villager",
      camp: i < 3 ? "wolf" : "good",
    })),
    events: [
      {
        seq: 1,
        timestamp: "2026-10-16T00:00:00Z",
        day: 1,
        phase: "night",
        type: "awakened_claw_bequeathed",
        payload: {
          policy,
          day: 1,
          actorId: 3,
          targetId: 1,
          unitId: unit,
          receivedUnitId: received,
        },
      },
      {
        seq: 2,
        timestamp: "2026-10-16T00:00:01Z",
        day: 1,
        phase: "day",
        type: "awakened_claw_spent",
        payload: { policy, day: 1, actorId: 1, targetId: null, unitId: received },
      },
      {
        seq: 3,
        timestamp: "2026-10-16T00:00:02Z",
        day: 1,
        phase: "day",
        type: "awakened_claws_expired",
        payload: { policy, day: 1, actorId: 3, unitIds: ["awakened_claw:native:2"] },
      },
    ],
  } as ReplayDocument;
}
for (const locale of ["zh-CN", "en"] as const)
  test(`狼爪库存事实不提前死亡或翻牌/${locale}`, () => {
    const replay = document(),
      ids = replay.players.map((p) => p.player_id),
      input = createReplayRenderInput(replay, { locale, timeZone: "UTC" });
    for (const [i, e] of replay.events.entries()) {
      const parsed = readReplayEvent(e, ids);
      expect(parsed).not.toBeNull();
      expect(parsed!.effects).toEqual([]);
      const before = buildReplaySnapshot(replay, i - 1),
        after = buildReplaySnapshot(replay, i);
      expect(after.players).toEqual(before.players);
      expect(buildReplayFrame(input, i * 90 + 45).snapshot).toEqual(after);
      const label = eventLabel(e, locale, ids);
      expect(label).not.toMatch(/unitId|awakened_claw:|undefined|NaN/);
      if (locale === "en") expect(label).not.toMatch(/\p{Script=Han}/u);
      expect(readReplayEvent({ ...e, day: 2 }, ids)).toBeNull();
      expect(readReplayEvent({ ...e, payload: { ...e.payload, remaining: 99 } }, ids)).toBeNull();
    }
    const timeline = renderToStaticMarkup(
      <EventTimeline
        events={replay.events}
        locale={locale}
        playerIds={ids}
        activeEventSeq={1}
        focusedPlayerId={null}
        onJumpTo={() => {}}
        onClearFocus={() => {}}
      />,
    );
    expect(timeline).toContain(locale === "en" ? "claw" : "狼爪");
    expect(timeline).not.toMatch(/undefined|NaN/);
  });
test("spent关联实际目标但不产生击杀，严格拒陌生ID和日次/阶段错位", () => {
  const r = document(),
    ids = r.players.map((p) => p.player_id),
    e = r.events[1]!;
  const nonempty = { ...e, payload: { ...e.payload, targetId: 8 } };
  expect(readReplayEvent(nonempty, ids)!.relatedPlayerIds).toEqual([1, 8]);
  expect(readReplayEvent(nonempty, ids)!.effects).toEqual([]);
  expect(readReplayEvent({ ...e, payload: { ...e.payload, targetId: 99 } }, ids)).toBeNull();
  expect(readReplayEvent({ ...r.events[0]!, phase: "day" }, ids)).toBeNull();
  expect(readReplayEvent({ ...e, payload: { ...e.payload, targetId: 1 } }, ids)).toBeNull();
  expect(readReplayEvent({ ...e, payload: { ...e.payload, unitId: "native_1" } }, ids)).toBeNull();
});

for (const locale of ["zh-CN", "en"] as const)
  test(`真实亲传教学档的原生/受传消费与中立死亡/${locale}`, () => {
    const replay = readReplayDocument(
        JSON.parse(
          readFileSync(
            new URL(
              `../../../../../docs/examples/awakened-wolf-king/${locale}.replay.json`,
              import.meta.url,
            ),
            "utf8",
          ),
        ),
      ),
      ids = replay.players.map((p) => p.player_id),
      input = createReplayRenderInput(replay, { locale, timeZone: "UTC" }),
      family = replay.events.filter((e) => e.type.startsWith("awakened_claw"));
    expect(family).toHaveLength(3);
    expect(
      family
        .filter((e) => e.type === "awakened_claw_spent")
        .map((e) => (e.payload.unitId as string).includes(":bequest:"))
        .sort(),
    ).toEqual([false, true]);
    for (const [i, e] of replay.events.entries()) {
      if (!e.type.startsWith("awakened_claw") && e.type !== "player_shot") continue;
      const parsed = readReplayEvent(e, ids),
        before = buildReplaySnapshot(replay, i - 1),
        after = buildReplaySnapshot(replay, i),
        index = input.replay.events.findIndex((row) => row.seq === e.seq);
      expect(parsed).not.toBeNull();
      if (e.type.startsWith("awakened_claw")) {
        expect(parsed!.effects).toEqual([]);
        expect(after.players).toEqual(before.players);
      } else {
        expect(after.players.find((p) => p.playerId === e.payload.targetId)!.alive).toBe(false);
      }
      expect(buildReplayFrame(input, index * 90 + 45).snapshot).toEqual(after);
      if (index > 0)
        expect(buildReplayFrame(input, index * 90 - 1).snapshot.players).toEqual(before.players);
      const label = eventLabel(e, locale, ids);
      expect(label).not.toMatch(/awakened_claw:|unitId|undefined|NaN/);
      if (locale === "en") expect(label).not.toMatch(/\p{Script=Han}/u);
    }
    const timeline = renderToStaticMarkup(
      <EventTimeline
        events={family}
        locale={locale}
        playerIds={ids}
        activeEventSeq={family[0]!.seq}
        focusedPlayerId={null}
        onJumpTo={() => {}}
        onClearFocus={() => {}}
      />,
    );
    expect(timeline).toContain(locale === "en" ? "claw" : "狼爪");
    expect(timeline).not.toMatch(/unitId|undefined|NaN/);
  });
