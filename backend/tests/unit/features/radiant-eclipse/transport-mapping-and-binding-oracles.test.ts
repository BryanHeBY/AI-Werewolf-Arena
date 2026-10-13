/**
 * Oracle unit tests check Radiant transport mapping and current borrowed inventory binding. Inputs include the original public board file read by the plan builder, an independent literal mapping golden and mutated prompt strings; exact maps and rejection messages are the oracle. Original input URL/bytes remain unchanged; no recorded game or model executes.
 */
import { expect, test } from "bun:test";
import { radiantTransportScenario } from "../../../support/features/radiant-eclipse/builders/transport-plan";
import { assertTransportPrompt } from "../../../support/oracles/transport/observations";

test("transport mapping matches independent FNV/Mulberry/Fisher literal golden", async () => {
  const s = await radiantTransportScenario();
  expect(s.roles.map(String)).toEqual([
    "villager",
    "wolf",
    "wolf",
    "dreamer",
    "villager",
    "villager",
    "witch",
    "seer",
    "radiant_count",
    "eclipse_maid",
    "wolf",
    "villager",
  ]);
  expect(Object.fromEntries(s.mapping)).toEqual({
    1: 10,
    2: 9,
    3: 8,
    4: 7,
    5: 4,
    6: 1,
    7: 5,
    8: 6,
    9: 12,
    10: 2,
    11: 3,
    12: 11,
  });
  expect(s.ordinary).toEqual([2, 3, 11]);
});

test("borrow binding and current inventory cannot be replaced by historical substrings", async () => {
  const s = await radiantTransportScenario(),
    turn = s.turns.get(10)!.find((t) => t.day === 2 && t.stage === "witch")!;
  const plan = { actorId: 10, locale: "en" as const, role: s.roles[9]!, turns: [turn] };
  const bound =
    "This turn executes only the engine-bound ability copy:eclipse:night:2; do not add an ability ID to tool arguments.";
  const summary = `Ability copy:eclipse:night:2: Potion use; status=Effective; uses remaining=Unlimited; your resources and records=${JSON.stringify(turn.radiantBorrow!.state)}`;
  const prompt = `[Action prompt] Player 10, Current game day: 2. stage: Witch action; Current turn ID: t2\n${summary} ${bound} Wolf teammate identities revealed for this turn, excluding yourself: 2, 3, 11.`;
  expect(() => assertTransportPrompt(plan, turn, prompt)).not.toThrow();
  expect(() =>
    assertTransportPrompt(
      plan,
      turn,
      prompt.replace(bound, bound.replace("copy:eclipse:night:2", "native:potion")),
    ),
  ).toThrow();
  expect(() =>
    assertTransportPrompt(
      plan,
      turn,
      prompt.replace('"heal":1', '"heal":0') + '\nOld stock: "heal":1',
    ),
  ).toThrow();
  expect(() =>
    assertTransportPrompt(
      plan,
      turn,
      prompt.replace('"heal":1', '"sourceHistory":"SOURCE_HISTORY_PRIVATE","heal":1'),
    ),
  ).toThrow();
});
