import { expect, test } from "bun:test";
import type { ReplayEvent } from "@ai-werewolf-arena/replay-contract";
import { readOrderPrinceRevoteFact } from "@ai-werewolf-arena/game-text";
import { readReplayEvent } from "../../../src/replay/replay-event-reader";
import { eventLabel } from "../../../src/replay/event-labels";
function event(payload: Record<string, unknown>, phase = "voting"): ReplayEvent {
  return {
    seq: 1,
    timestamp: new Date(0).toISOString(),
    day: 1,
    phase,
    type: "order_prince_revote_started",
    payload,
  } as ReplayEvent;
}
for (const locale of ["zh-CN", "en"] as const)
  test("Order Prince reveals without death or badge removal/" + locale, () => {
    const e = event({ actorId: 2 });
    const fact = readReplayEvent(e, [1, 2, 3])!;
    expect(fact.relatedPlayerIds).toEqual([2]);
    expect(fact.effects).toEqual([{ kind: "role_revealed", playerId: 2, role: "order_prince" }]);
    expect(eventLabel(e, locale, [1, 2, 3])).toContain("2");
    expect(eventLabel(e, locale, [1, 2, 3])).toContain(
      locale === "en" ? "Order Prince" : "定序王子",
    );
  });
test("Order Prince rejects malformed, foreign or wrong-phase facts", () => {
  for (const payload of [
    {},
    { actorId: 0 },
    { actorId: 1.5 },
    { actorId: 99 },
    { actorId: 2, secret: "leak" },
    { actorId: 2, target: 1 },
  ])
    expect(readReplayEvent(event(payload), [1, 2, 3])).toBeNull();
  for (const phase of ["night", "day", "game_over"])
    expect(readReplayEvent(event({ actorId: 2 }, phase), [1, 2, 3])).toBeNull();
  expect(readOrderPrinceRevoteFact("unrelated", { actorId: 2 })).toBeNull();
});

for (const locale of ["zh-CN", "en"] as const)
  test("Order Prince private choice has no public effects/" + locale, () => {
    const e = {
      ...event({ actorId: 2 }),
      type: "order_prince_choice_committed",
      payload: { actorId: 2, day: 1, activate: false },
    };
    expect(readReplayEvent(e, [1, 2, 3])?.effects).toEqual([]);
    expect(eventLabel(e, locale, [1, 2, 3])).toContain(locale === "en" ? "decline" : "不发动");
    for (const payload of [
      { actorId: 2, day: 2, activate: false },
      { actorId: 2, day: 1, activate: "false" },
      { actorId: 2, day: 1, activate: false, secret: "leak" },
    ])
      expect(readReplayEvent({ ...e, payload }, [1, 2, 3])).toBeNull();
  });
