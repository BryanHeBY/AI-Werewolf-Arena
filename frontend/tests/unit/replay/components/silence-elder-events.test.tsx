/**
 * 字面God教学事件验证两语时间线、关联席位与帧投影；不由规则引擎生成预期。
 * 动作及个人译文是展示事实，不能暗改生命、认证身份或修改投票权；玩家授权仍在后端投影。
 */
import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { readReplayDocument } from "@ai-werewolf-arena/replay-contract";
import { renderToStaticMarkup } from "react-dom/server";
import type { ReplayDocument, ReplayEvent } from "@ai-werewolf-arena/replay-contract";
import { SILENCE_ELDER_POLICY as policy } from "@ai-werewolf-arena/game-contract/facts/silence-elder";
import { readReplayEvent } from "../../../../src/replay/replay-event-reader";
import { eventLabel } from "../../../../src/replay/event-labels";
import { buildReplaySnapshot } from "../../../../src/replay/replay-projection";
import { createReplayRenderInput, buildReplayFrame } from "../../../../src/replay/replay-frame";
import { ReplayFrame } from "../../../../src/replay/ReplayComposition";
import { EventTimeline } from "../../../../src/replay/EventTimeline";
function document(): ReplayDocument {
  const data = [
    {
      type: "silence_chosen",
      phase: "night",
      payload: { policy, day: 1, actorId: 12, targetId: 1, translatorId: 9 },
    },
    {
      type: "silence_announced",
      phase: "day",
      payload: { policy, day: 1, targetId: 1, translatorId: 9 },
    },
    {
      type: "silence_gesture",
      phase: "day",
      payload: { policy, day: 1, actorId: 1, round: "day", description: "  🐺 → ?  " },
    },
    {
      type: "silence_translated",
      phase: "day",
      payload: {
        policy,
        day: 1,
        actorId: 9,
        targetId: 1,
        round: "day",
        text: "  My interpretation.  ",
      },
    },
    {
      type: "silence_translation_declined",
      phase: "voting",
      payload: { policy, day: 1, actorId: 9, targetId: 1, round: "pk" },
    },
    { type: "silence_expired", phase: "voting", payload: { policy, day: 1, targetId: 1 } },
  ];
  return {
    schemaVersion: 2,
    perspective: "god",
    sessionId: "silence_literal",
    meta: { board: "awa_silence_elder_12_gestures_v1", startedAt: "t1", endedAt: "t2" },
    result: { winner: null, reason: null },
    players: Array.from({ length: 12 }, (_, i) => ({
      player_id: i + 1,
      seat: i + 1,
      name: `Player ${i + 1}`,
      role: i === 11 ? "silence_elder" : i < 4 ? "wolf" : "villager",
      camp: i < 4 ? "wolf" : "good",
    })),
    events: data.map((e, i) => ({
      ...e,
      seq: i + 1,
      day: 1,
      timestamp: `2026-10-16T00:00:0${i}Z`,
    })),
  } as ReplayDocument;
}
for (const locale of ["zh-CN", "en"] as const)
  test(`6类事实、时间线与帧无身份/生命副作用/${locale}`, () => {
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
      const frameIndex = input.replay.events.findIndex((row) => row.seq === e.seq);
      expect(buildReplayFrame(input, frameIndex * 90 + 45).snapshot).toEqual(after);
      const label = eventLabel(e, locale, ids);
      expect(label).not.toMatch(/undefined|NaN|targetId|policy/);
      if (locale === "en") expect(label).not.toMatch(/\p{Script=Han}/u);
      expect(readReplayEvent({ ...e, day: 2 }, ids)).toBeNull();
      expect(
        readReplayEvent({ ...e, payload: { ...e.payload, privateReceipt: "secret" } }, ids),
      ).toBeNull();
    }
    expect(eventLabel(replay.events[2]!, locale, ids)).toContain("  🐺 → ?  ");
    expect(eventLabel(replay.events[3]!, locale, ids)).toContain(
      locale === "en" ? "personal interpretation" : "个人解读",
    );
    const timeline = renderToStaticMarkup(
      <EventTimeline
        events={replay.events as ReplayEvent[]}
        locale={locale}
        playerIds={ids}
        activeEventSeq={1}
        focusedPlayerId={null}
        onJumpTo={() => {}}
        onClearFocus={() => {}}
      />,
    );
    expect(timeline).toContain(locale === "en" ? "personal interpretation" : "个人解读");
    expect(timeline).not.toMatch(/undefined|NaN/);
    expect(renderToStaticMarkup(<ReplayFrame input={input} frame={300} />)).not.toMatch(
      /undefined|NaN/,
    );
  });
test("三种表达阶段和关联席位严格验证，公告不得私泄actor", () => {
  const r = document(),
    ids = r.players.map((p) => p.player_id);
  expect(readReplayEvent(r.events[1]!, ids)!.relatedPlayerIds).toEqual([1, 9]);
  expect(
    readReplayEvent({ ...r.events[1]!, payload: { ...r.events[1]!.payload, actorId: 12 } }, ids),
  ).toBeNull();
  for (const i of [2, 3, 4])
    expect(readReplayEvent({ ...r.events[i]!, phase: "night" }, ids)).toBeNull();
  expect(
    readReplayEvent(
      { ...r.events[0]!, payload: { ...r.events[0]!.payload, translatorId: 99 } },
      ids,
    ),
  ).toBeNull();
  expect(
    readReplayEvent(
      { ...r.events[0]!, payload: { ...r.events[0]!.payload, translatorId: 1 } },
      ids,
    ),
  ).toBeNull();
  for (const key of ["description", "text"] as const) {
    const e = r.events[key === "description" ? 2 : 3]!;
    expect(readReplayEvent({ ...e, payload: { ...e.payload, [key]: "   " } }, ids)).toBeNull();
  }
});

for (const locale of ["zh-CN", "en"] as const)
  test(`真实两语教学归档时间线及frame/${locale}`, () => {
    const replay = readReplayDocument(
      JSON.parse(
        readFileSync(
          new URL(
            `../../../../../docs/examples/silence-elder/${locale}.replay.json`,
            import.meta.url,
          ),
          "utf8",
        ),
      ),
    );
    const ids = replay.players.map((p) => p.player_id),
      input = createReplayRenderInput(replay, { locale, timeZone: "UTC" }),
      events = replay.events.filter((e) => e.type.startsWith("silence_"));
    expect(events).toHaveLength(15);
    for (const [i, e] of replay.events.entries())
      if (e.type.startsWith("silence_")) {
        const parsed = readReplayEvent(e, ids);
        expect(parsed).not.toBeNull();
        expect(parsed!.effects).toEqual([]);
        const before = buildReplaySnapshot(replay, i - 1),
          after = buildReplaySnapshot(replay, i);
        expect(after.players).toEqual(before.players);
        const index = input.replay.events.findIndex((row) => row.seq === e.seq);
        expect(buildReplayFrame(input, index * 90 + 45).snapshot).toEqual(after);
        if (index > 0)
          expect(buildReplayFrame(input, index * 90 - 1).snapshot.players).toEqual(before.players);
        const label = eventLabel(e, locale, ids);
        expect(label).not.toMatch(/undefined|NaN|targetId|policy/);
        if (locale === "en") expect(label).not.toMatch(/\p{Script=Han}/u);
      }
    const timeline = renderToStaticMarkup(
      <EventTimeline
        events={events}
        locale={locale}
        playerIds={ids}
        activeEventSeq={events[0]!.seq}
        focusedPlayerId={null}
        onJumpTo={() => {}}
        onClearFocus={() => {}}
      />,
    );
    expect(timeline).toContain(locale === "en" ? "personal interpretation" : "个人解读");
    expect(timeline).not.toMatch(/undefined|NaN/);
    expect(renderToStaticMarkup(<ReplayFrame input={input} frame={0} />)).not.toMatch(
      /undefined|NaN/,
    );
  });
