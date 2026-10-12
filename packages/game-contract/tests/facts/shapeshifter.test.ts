/**
 * Package unit contract for Shapeshifter finite deal, selected card and tool DTO.
 * Literal decks/slots independently verify whitelist, mandatory choice and
 * original copier/prototype limits. No identity deal, RNG, component write or
 * action authorization is produced from these descriptive public readers.
 */
import { expect, test } from "bun:test";
import {
  SHAPESHIFTER_EVENT_TYPES,
  readShapeshifterEventFact,
  readShapeshifterChoiceTool,
} from "@ai-werewolf-arena/game-contract/facts/shapeshifter";
const policy = "awa_netease_shapeshifter_two_extra_villagers_v1";
test("deal whitelist and 130-card limit remain unchanged", () => {
  expect(SHAPESHIFTER_EVENT_TYPES).toHaveLength(2);
  const roles = ["shapeshifter", "wolf", "wolf", ...Array(127).fill("villager")];
  expect(
    readShapeshifterEventFact("shapeshifter_initial_deal", { policy, boardSize: 128, roles }),
  ).not.toBeNull();
  expect(
    readShapeshifterEventFact("shapeshifter_initial_deal", {
      policy,
      boardSize: 5,
      roles: ["shapeshifter", "wolf", "wolf", "villager", "villager", "villager", "villager"],
    }),
  ).toBeNull();
  expect(
    readShapeshifterEventFact("shapeshifter_initial_deal", {
      policy,
      boardSize: 128,
      roles: [...roles.slice(0, -1), "thief"],
    }),
  ).toBeNull();
});
test("chosen identity cannot keep the original role or null slot", () => {
  const base = { policy, actorId: Number.MAX_SAFE_INTEGER, day: 1 };
  expect(
    readShapeshifterEventFact("shapeshifter_identity_chosen", {
      ...base,
      slot: 1,
      role: "wolf",
      camp: "wolf",
    }),
  ).not.toBeNull();
  for (const row of [
    { slot: null, role: "wolf", camp: "wolf" },
    { slot: 0, role: "shapeshifter", camp: "good" },
    { slot: 0, role: "wolf", camp: "good" },
  ])
    expect(
      readShapeshifterEventFact("shapeshifter_identity_chosen", { ...base, ...row }),
    ).toBeNull();
});
test("choice tool returns ordinary detached data with only slots zero and one", () => {
  const input = { name: "choose_shapeshifter_card", args: { slot: 0 } },
    fact = readShapeshifterChoiceTool(input)!;
  expect<unknown>(fact).toEqual(input);
  expect(fact).not.toBe(input);
  expect(Object.getPrototypeOf(fact)).toBe(Object.prototype);
  for (const slot of [null, 2, "0", false])
    expect(
      readShapeshifterChoiceTool({ name: "choose_shapeshifter_card", args: { slot } }),
    ).toBeNull();
  expect(
    readShapeshifterChoiceTool({
      name: "choose_shapeshifter_card",
      args: { slot: 0, turn_id: "extra" },
    }),
  ).toBeNull();
});
