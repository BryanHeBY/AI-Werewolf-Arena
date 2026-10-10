import { expect, test } from "bun:test";
import type { ReplayEvent } from "@ai-werewolf-arena/replay-contract";
import { readReplayEvent } from "../../../src/replay/replay-event-reader";
import { eventLabel } from "../../../src/replay/event-labels";
function event(
  type: string,
  payload: Record<string, unknown>,
  day = 1,
  phase = "night",
): ReplayEvent {
  return { seq: 1, timestamp: new Date(0).toISOString(), day, phase, type, payload } as ReplayEvent;
}
for (const locale of ["zh-CN", "en"] as const) {
  test(
    "Magician private full and own facts have labels without changing identities/" + locale,
    () => {
      const full = event("magician_exchange_committed", { actorId: 1, day: 1, pair: [1, 3] });
      const own = event("magician_exchange_committed", { day: 1, pair: [1, 3] });
      for (const e of [full, own]) {
        const fact = readReplayEvent(e, [1, 2, 3])!;
        expect(fact).not.toBeNull();
        expect([...fact.relatedPlayerIds].sort()).toEqual([1, 3]);
        expect(fact.effects).toEqual([]);
        expect(eventLabel(e, locale, [1, 2, 3])).toContain("3");
        expect(eventLabel(e, locale, [1, 2, 3])).not.toBe(e.type);
      }
    },
  );
  test("Magician pass and public missed shot have no extra-death effect/" + locale, () => {
    const pass = event("magician_exchange_committed", { day: 1, pair: null });
    expect(readReplayEvent(pass, [1, 2])?.effects).toEqual([]);
    expect(eventLabel(pass, locale)).toContain(locale === "en" ? "pass" : "弃用");
    const miss = event("death_shot_missed", { actorId: 2, reason: "no_effect" }, 1, "day");
    expect(readReplayEvent(miss, [1, 2])?.relatedPlayerIds).toEqual([2]);
    expect(readReplayEvent(miss, [1, 2])?.effects).toEqual([]);
    expect(eventLabel(miss, locale, [1, 2])).toContain("2");
  });
}
test("Magician replay rejects malformed, foreign, wrong-night and overexposed facts", () => {
  for (const payload of [
    { actorId: 1, day: 1, pair: [3, 1] },
    { actorId: 1, day: 1, pair: [1, 1] },
    { actorId: 1, day: 1, pair: [1, 99] },
    { actorId: 99, day: 1, pair: [1, 3] },
    { actorId: 1, day: 1, pair: [1, 3], secret: "leak" },
  ])
    expect(readReplayEvent(event("magician_exchange_committed", payload), [1, 2, 3])).toBeNull();
  const good = { actorId: 1, day: 1, pair: [1, 3] };
  expect(readReplayEvent(event("magician_exchange_committed", good, 2), [1, 2, 3])).toBeNull();
  expect(
    readReplayEvent(event("magician_exchange_committed", good, 1, "day"), [1, 2, 3]),
  ).toBeNull();
  for (const payload of [
    { actorId: 1, reason: "night_protection" },
    { actorId: 99, reason: "no_effect" },
    { actorId: 1, reason: "no_effect", targetId: 3 },
    { actorId: 1, reason: "no_effect", pair: [1, 3] },
  ])
    expect(readReplayEvent(event("death_shot_missed", payload), [1, 2, 3])).toBeNull();
});
