/**
 * 单元测试负责觉醒女巫God事实的时间线与帧投影。输入手写私密事件，输出两语自然标签与关联席位；逐字段字面值是独立人工预期，不由生产输出生成。
 * 该层不运行引擎，不决定玩家受众；资源、聊天、票和最终提案都不得自行改变生命/翻牌/警徽。
 */
import { PROJECT_ROOT } from "@ai-werewolf-arena/project-paths";
import { join } from "node:path";
import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { readReplayDocument } from "@ai-werewolf-arena/replay-contract";
import { renderToStaticMarkup } from "react-dom/server";
import type { ReplayDocument } from "@ai-werewolf-arena/replay-contract";
import { AWAKENED_WITCH_POLICY as policy } from "@ai-werewolf-arena/game-contract/facts/awakened-witch";
import { readReplayEvent } from "../../../../src/replay/replay-event-reader";
import { eventLabel } from "../../../../src/replay/event-labels";
import { buildReplaySnapshot } from "../../../../src/replay/replay-projection";
import { createReplayRenderInput, buildReplayFrame } from "../../../../src/replay/replay-frame";
import { EventTimeline } from "../../../../src/replay/EventTimeline";
function document(): ReplayDocument {
  const group = { ordinal: 2, targetId: 2, assistantIds: [6, 9] },
    data = [
      {
        type: "awakened_brew_chosen",
        payload: { policy, day: 2, actorId: 12, mode: "poison", ...group },
      },
      { type: "brew_started", payload: { policy, day: 2, ...group } },
      {
        type: "brew_discussion",
        payload: { policy, day: 2, ordinal: 2, actorId: 6, text: " RAW 🐺 " },
      },
      {
        type: "brew_approval",
        payload: { policy, day: 2, ordinal: 2, actorId: 6, approve: false },
      },
      {
        type: "brew_resolved",
        payload: { policy, day: 2, ...group, actorId: 12, outcome: "vetoed" },
      },
    ];
  return {
    schemaVersion: 2,
    perspective: "god",
    sessionId: "brew_literal",
    meta: { board: "awa_awakened_witch_12_v1", startedAt: "t1", endedAt: "t2" },
    result: { winner: null, reason: null },
    players: Array.from({ length: 12 }, (_, i) => ({
      player_id: i + 1,
      seat: i + 1,
      role: i === 11 ? "awakened_witch" : i < 4 ? "wolf" : "villager",
      camp: i < 4 ? "wolf" : "good",
    })),
    events: data.map((e, i) => ({
      ...e,
      seq: i + 1,
      day: 2,
      phase: "night",
      timestamp: `2026-10-16T00:00:0${i}Z`,
    })),
  } as ReplayDocument;
}
for (const locale of ["zh-CN", "en"] as const)
  test(`私密调毒五事实不替代真实死亡/${locale}`, () => {
    const r = document(),
      ids = r.players.map((p) => p.player_id),
      input = createReplayRenderInput(r, { locale, timeZone: "UTC" });
    for (const [i, e] of r.events.entries()) {
      const parsed = readReplayEvent(e, ids);
      expect(parsed).not.toBeNull();
      expect(parsed!.effects).toEqual([]);
      const before = buildReplaySnapshot(r, i - 1),
        after = buildReplaySnapshot(r, i);
      expect(after.players).toEqual(before.players);
      expect(buildReplayFrame(input, i * 90 + 45).snapshot).toEqual(after);
      const label = eventLabel(e, locale, ids);
      expect(label).not.toMatch(/targetId|policy|undefined|NaN/);
      if (locale === "en") expect(label).not.toMatch(/\p{Script=Han}/u);
      expect(readReplayEvent({ ...e, day: 3 }, ids)).toBeNull();
      expect(readReplayEvent({ ...e, phase: "day" }, ids)).toBeNull();
      expect(readReplayEvent({ ...e, payload: { ...e.payload, witchSeat: 12 } }, ids)).toBeNull();
    }
    expect(eventLabel(r.events[2]!, locale, ids)).toContain(" RAW 🐺 ");
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
    expect(html).toContain(locale === "en" ? "brew" : "调毒");
    expect(html).not.toMatch(/undefined|NaN/);
  });
test("秘密组不含女巫座位关联，严格拒组外ID与额外actor", () => {
  const r = document(),
    ids = r.players.map((p) => p.player_id);
  expect(readReplayEvent(r.events[1]!, ids)!.relatedPlayerIds).toEqual([2, 6, 9]);
  expect(
    readReplayEvent({ ...r.events[1]!, payload: { ...r.events[1]!.payload, actorId: 12 } }, ids),
  ).toBeNull();
  expect(
    readReplayEvent(
      { ...r.events[1]!, payload: { ...r.events[1]!.payload, assistantIds: [6, 99] } },
      ids,
    ),
  ).toBeNull();
  expect(
    readReplayEvent({ ...r.events[0]!, payload: { ...r.events[0]!.payload, targetId: 99 } }, ids),
  ).toBeNull();
});

for (const locale of ["zh-CN", "en"] as const)
  test(`真实四夜God教学档的秘密协作与帧/${locale}`, () => {
    const r = readReplayDocument(
        JSON.parse(
          readFileSync(
            join(PROJECT_ROOT, `docs/examples/awakened-witch/${locale}.replay.json`),
            "utf8",
          ),
        ),
      ),
      ids = r.players.map((p) => p.player_id),
      input = createReplayRenderInput(r, { locale, timeZone: "UTC" });
    const family = r.events.filter((e) =>
      [
        "awakened_brew_chosen",
        "brew_started",
        "brew_discussion",
        "brew_approval",
        "brew_resolved",
      ].includes(e.type),
    );
    expect(family).toHaveLength(22);
    expect(family.filter((e) => e.type === "brew_resolved").map((e) => e.payload.outcome)).toEqual([
      "poison",
      "vetoed",
      "poison",
    ]);
    for (const [i, e] of r.events.entries()) {
      if (!family.includes(e)) continue;
      const parsed = readReplayEvent(e, ids);
      expect(parsed).not.toBeNull();
      expect(parsed!.effects).toEqual([]);
      const before = buildReplaySnapshot(r, i - 1),
        after = buildReplaySnapshot(r, i),
        index = input.replay.events.findIndex((row) => row.seq === e.seq);
      expect(after.players).toEqual(before.players);
      expect(buildReplayFrame(input, index * 90 + 45).snapshot).toEqual(after);
      if (index > 0)
        expect(buildReplayFrame(input, index * 90 - 1).snapshot.players).toEqual(before.players);
      const label = eventLabel(e, locale, ids);
      expect(label).not.toMatch(/targetId|policy|undefined|NaN/);
      if (locale === "en") expect(label).not.toMatch(/\p{Script=Han}/u);
    }
    const html = renderToStaticMarkup(
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
    expect(html).toContain(locale === "en" ? "brew" : "调毒");
    expect(html).not.toMatch(/undefined|NaN/);
  });
