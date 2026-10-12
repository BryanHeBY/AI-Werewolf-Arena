/**
 * Package unit contract for Lonely Girl choice and strict tool wire data.
 * Literal absent/present camp variants independently check optional disclosure,
 * exact keys, day-one and self-target restrictions. No admired-player relation,
 * camp conversion, resource state or selection authorization is established.
 */
import { expect, test } from "bun:test";
import {
  LONELY_GIRL_POLICY,
  LONELY_GIRL_EVENT_TYPES,
  readLonelyGirlEventFact,
  readLonelyGirlChoiceTool,
} from "@ai-werewolf-arena/game-contract/facts/lonely-girl";
test("optional camp is preserved verbatim rather than defaulted or required", () => {
  expect(LONELY_GIRL_POLICY).toBe("awa_netease_lonely_girl_v1");
  expect<unknown>(LONELY_GIRL_EVENT_TYPES).toEqual(["lonely_girl_admired_chosen"]);
  const base = { policy: LONELY_GIRL_POLICY, actorId: 1, day: 1, targetId: 2 };
  expect<unknown>(readLonelyGirlEventFact("lonely_girl_admired_chosen", base)).toEqual(base);
  for (const camp of ["good", "wolf"])
    expect<unknown>(
      readLonelyGirlEventFact("lonely_girl_admired_chosen", { ...base, camp }),
    ).toEqual({
      ...base,
      camp,
    });
  for (const camp of [undefined, null, "third_party"])
    expect(readLonelyGirlEventFact("lonely_girl_admired_chosen", { ...base, camp })).toBeNull();
});
test("inclusive ID edge does not weaken exact day/self/extra constraints", () => {
  const row = { policy: LONELY_GIRL_POLICY, actorId: Number.MAX_SAFE_INTEGER, day: 1, targetId: 2 };
  expect(readLonelyGirlEventFact("lonely_girl_admired_chosen", row)).not.toBeNull();
  for (const delta of [
    { targetId: Number.MAX_SAFE_INTEGER },
    { day: 2 },
    { extra: true },
    { targetId: null },
  ])
    expect(readLonelyGirlEventFact("lonely_girl_admired_chosen", { ...row, ...delta })).toBeNull();
});
test("tool DTO remains ordinary copied shape and rejects inaccessible target", () => {
  const input = { name: "choose_admired_player", args: { target_id: 2 } },
    fact = readLonelyGirlChoiceTool(input)!;
  expect<unknown>(fact).toEqual(input);
  expect(fact).not.toBe(input);
  expect(Object.getPrototypeOf(fact)).toBe(Object.prototype);
  let reads = 0;
  expect(
    readLonelyGirlChoiceTool({
      name: "choose_admired_player",
      args: {
        get target_id() {
          reads++;
          return 2;
        },
      },
    }),
  ).toBeNull();
  expect(reads).toBe(0);
  expect(
    readLonelyGirlChoiceTool({
      name: "choose_admired_player",
      args: { target_id: 2, turn_id: "extra" },
    }),
  ).toBeNull();
});
