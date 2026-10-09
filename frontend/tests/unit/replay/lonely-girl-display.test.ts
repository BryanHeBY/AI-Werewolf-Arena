import { expect, test } from "bun:test";
import type { ReplayEvent } from "@ai-werewolf-arena/replay-contract";
import { readReplayEvent } from "../../../src/replay/replay-event-reader";
import { lonelyGirlEventLabel, LONELY_GIRL_POLICY } from "@ai-werewolf-arena/game-text";
const payload = { policy: LONELY_GIRL_POLICY, actorId: 1, day: 1, targetId: 2 };
const fact = (p: Record<string, unknown>, day = 1, phase = "night"): ReplayEvent => ({
  seq: 1,
  timestamp: "2026-10-09T00:00:00Z",
  type: "lonely_girl_admired_chosen",
  day,
  phase,
  payload: p,
});
for (const full of [true, false])
  test(`${full ? "God" : "actor"}: strict relation links both seats without changing role/camp/life/badge`, () => {
    const p = { ...payload, ...(full ? { camp: "wolf" } : {}) };
    expect(readReplayEvent(fact(p), [1, 2])).toMatchObject({
      relatedPlayerIds: [1, 2],
      effects: [],
    });
    for (const bad of [
      { ...p, actorId: 99 },
      { ...p, targetId: 99 },
      { ...p, targetId: 1 },
      { ...p, day: 2 },
      { ...p, extra: true },
      { ...p, camp: "fox" },
      { ...p, targetId: "2" },
      { ...p, policy: "wrong" },
    ])
      expect(readReplayEvent(fact(bad), [1, 2])).toBeNull();
    expect(readReplayEvent(fact(p, 2), [1, 2])).toBeNull();
    expect(readReplayEvent(fact(p, 1, "day"), [1, 2])).toBeNull();
    let reads = 0;
    const getter = Object.defineProperty({ ...p }, "targetId", {
      get() {
        reads++;
        return 2;
      },
      enumerable: true,
    });
    expect(readReplayEvent(fact(getter), [1, 2])).toBeNull();
    expect(reads).toBe(0);
    for (const locale of ["zh-CN", "en"] as const) {
      const label = lonelyGirlEventLabel("lonely_girl_admired_chosen", p, locale);
      expect(label).not.toBeNull();
      expect(label).toContain("1");
      expect(label).toContain("2");
    }
  });
