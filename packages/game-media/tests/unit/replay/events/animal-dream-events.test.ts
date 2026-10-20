/**
 * 单元测试验证动物梦境事实接收、对应标签与事件前缀展示。输入为原字面量、畸形 payload、语言和用例表；手写字段、标签与效果预期作为独立 oracle，不执行真实游戏或重生成 golden。
 */
import { expect, test } from "bun:test";
import { animalDreamEventLabel } from "@ai-werewolf-arena/game-presentation";
import { readReplayEvent } from "../../../../src/replay/replay-event-reader";
import { eventLabel } from "../../../../src/replay/event-labels";
import { buildReplaySnapshot } from "../../../../src/replay/replay-projection";
const ids = Array.from({ length: 12 }, (_, i) => i + 1),
  base = { policy: "awa_animal_dream_v1", day: 2 };
const rows = [
  ["animal_night_opened", {}, "night", "god"],
  ["animal_fox_chosen", { actorId: 10, targetId: 1 }, "night", "actor"],
  [
    "animal_fox_effect",
    { actorId: 10, targetId: 1, knifeBlocked: true, beautyBlocked: true },
    "night",
    "god",
  ],
  ["animal_knife_notified", { actorId: 1, eligible: false }, "night", "actor"],
  [
    "animal_beauty_notified",
    {
      actorId: 1,
      charmAllowed: false,
      linkAllowed: false,
      targetId: null,
      lastActedDay: 1,
      history: [{ day: 1, targetId: 5 }],
    },
    "night",
    "actor",
  ],
  ["animal_cat_revealed", { actorId: 9 }, "day", "public"],
  ["animal_puffer_revealed", { actorId: 12, reason: "knife_death" }, "day", "public"],
  ["animal_puffer_decided", { actorId: 12, activate: true }, "voting", "actor"],
  ["animal_puffer_targets", { actorId: 12, targetIds: [1, 5], round: 1 }, "voting", "god"],
  ["animal_wave_prepared", { phase: "day", proposedIds: [9, 12], blockedCatId: 9 }, "day", "god"],
  [
    "animal_wave_committed",
    { phase: "day", deaths: [12], deathSources: { 12: ["wolf_kill"] } },
    "day",
    "god",
  ],
  ["animal_cat_expiry_prepared", { actorId: 9, unit: 2, unitKind: "exile" }, "voting", "god"],
  ["animal_unit_completed", { unit: 2, kind: "exile" }, "voting", "god"],
] as const;
function event(row: (typeof rows)[number], seq = 1): any {
  return {
    seq,
    day: 2,
    phase: row[2],
    type: row[0],
    timestamp: "2026-10-12T00:00:00Z",
    payload: { ...base, ...row[1] },
  };
}
for (const locale of ["zh-CN", "en"] as const)
  for (const row of rows)
    test(`${locale} literal ${row[0]} labels across shared/backend/frontend`, () => {
      const e = event(row);
      expect(typeof animalDreamEventLabel(e.type, e.payload, locale)).toBe("string");
      expect(eventLabel(e, locale, ids)).toBe(animalDreamEventLabel(e.type, e.payload, locale)!);
      expect(eventLabel(e, locale, ids)).not.toMatch(
        /[{}]|awa_animal_dream_v1|wolf_kill|blockedCatId|targetId/,
      );
    });
test("literal finite facts reject invalid envelope, players and extra private data", () => {
  for (const row of rows) {
    const e = event(row);
    expect(readReplayEvent(e, ids)).not.toBeNull();
    expect(readReplayEvent({ ...e, day: 3 }, ids)).toBeNull();
    expect(readReplayEvent({ ...e, phase: "game_over" }, ids)).toBeNull();
    expect(
      readReplayEvent({ ...e, payload: { ...e.payload, sourceCamp: "wolf" } }, ids),
    ).toBeNull();
    if ("actorId" in row[1])
      expect(readReplayEvent({ ...e, payload: { ...e.payload, actorId: 13 } }, ids)).toBeNull();
  }
  const e = event(rows[10]);
  expect(readReplayEvent({ ...e, phase: "night" }, ids)).toBeNull();
  expect(
    readReplayEvent(
      {
        ...event(rows[4]),
        payload: { ...event(rows[4]).payload, history: [{ day: 1, targetId: 13 }] },
      },
      ids,
    ),
  ).toBeNull();
});
test("Cat/Puffer public reveals only reveal role; God wave and expiry never change alive", () => {
  const players = ids.map((player_id) => ({ player_id, role: "unknown", camp: "unknown" }));
  const events = rows.map((r, i) => event(r, i + 1));
  for (let i = 0; i < events.length; i++) {
    const e = events[i],
      fact = readReplayEvent(e, ids)!;
    expect(fact.effects).toEqual(
      e.type === "animal_cat_revealed"
        ? [{ kind: "role_revealed", playerId: 9, role: "white_cat" }]
        : e.type === "animal_puffer_revealed"
          ? [{ kind: "role_revealed", playerId: 12, role: "pufferfish" }]
          : [],
    );
    const snap = buildReplaySnapshot({ players, events }, i);
    expect(snap.players.every((p) => p.alive)).toBe(true);
    expect(snap.players.every((p) => p.role === "unknown" && p.camp === "unknown")).toBe(true);
  }
  const published = [
    ...events,
    {
      seq: 14,
      day: 2,
      phase: "day",
      type: "additional_deaths",
      timestamp: "2026-10-12T00:00:00Z",
      payload: { deaths: [12] },
    },
  ];
  const dead = buildReplaySnapshot({ players, events: published }, 13);
  expect(dead.players.find((p) => p.playerId === 12)!.alive).toBe(false);
  expect(dead.players.find((p) => p.playerId === 9)!.alive).toBe(true);
  expect(buildReplaySnapshot({ players, events: published }, 5).players.every((p) => p.alive)).toBe(
    true,
  );
});
test("retaliation flip cannot publish before final ballots in Night", () => {
  const e = {
    ...event(rows[6]),
    phase: "night",
    payload: { ...base, actorId: 12, reason: "retaliation" },
  };
  expect(readReplayEvent(e, ids)).toBeNull();
});
