/**
 * Unit tests for public Seer lifetime-freshness and Guard repeat predicates.
 * Inputs are handwritten policy states and throwing field getters; literal booleans
 * and exact short-circuit logs are the oracle. Queries cannot write history or stock,
 * reset a cycle or add a final Guard check that the original stage did not have.
 */
import { expect, test } from "bun:test";
import type { NightAbilityReadView } from "../../../src/game/mechanisms/roles/abilities";
import { seerTargetAllowed } from "../../../src/game/mechanisms/roles/seer/ports";
import { guardTargetRepeated } from "../../../src/game/mechanisms/roles/guard/ports";
function readerPermissions(
  state: Parameters<typeof seerTargetAllowed>[0],
  ability: NightAbilityReadView<"guard">,
) {
  if (state) {
    // @ts-expect-error Pure target inputs do not permit history mutation.
    state.history.push({ targetId: 4, isWerewolf: false });
  }
  // @ts-expect-error Guard query inputs cannot update target history.
  ability.state.lastTarget = 4;
  // @ts-expect-error Guard query inputs cannot spend stock.
  ability.uses++;
}
void readerPermissions;
test("Seer default/alive policy does not inspect lifetime history and fresh-self rejection short-circuits it", () => {
  let reads = 0;
  const value = {
    lastTarget: null,
    lastIsWerewolf: null,
    get history(): [] {
      reads++;
      throw new Error("history_not_needed");
    },
  };
  expect(seerTargetAllowed(undefined, 1, 1)).toBe(true);
  expect(seerTargetAllowed(value, 1, 2)).toBe(true);
  const fresh = Object.defineProperty(value, "targetPolicy", { value: "awa_fresh_others_v1" });
  expect(seerTargetAllowed(fresh, 1, 1)).toBe(false);
  expect(reads).toBe(0);
});
test("Seer freshness reads original lifetime rows without changing them", () => {
  const state = {
    targetPolicy: "awa_fresh_others_v1" as const,
    lastTarget: null,
    lastIsWerewolf: null,
    history: [{ targetId: 4, isWerewolf: false }],
  };
  expect(seerTargetAllowed(state, 1, 4)).toBe(false);
  expect(seerTargetAllowed(state, 1, 5)).toBe(true);
  expect(state.history).toEqual([{ targetId: 4, isWerewolf: false }]);
});
test("Guard mismatched target skips repeat policy/day while legacy repeat skips day only", () => {
  const log: string[] = [];
  const ability = {
    state: {
      lastTarget: 4,
      get repeatPolicy() {
        log.push("policy");
        return undefined;
      },
    },
    get lastUsedDay(): number {
      log.push("day");
      throw new Error("day_not_needed");
    },
  } as unknown as NightAbilityReadView<"guard">;
  expect(guardTargetRepeated(ability, 2, 5)).toBe(false);
  expect(log).toEqual([]);
  expect(guardTargetRepeated(ability, 2, 4)).toBe(true);
  expect(log).toEqual(["policy"]);
});
test("Guard actual-night policy preserves the exact two state reads then day read", () => {
  const log: string[] = [];
  const ability = {
    get state() {
      log.push("state");
      return { lastTarget: 4, repeatPolicy: "netease_consecutive_nights_v1" as const };
    },
    get lastUsedDay() {
      log.push("day");
      return 1;
    },
  } as unknown as NightAbilityReadView<"guard">;
  expect(guardTargetRepeated(ability, 2, 4)).toBe(true);
  expect(log).toEqual(["state", "state", "day"]);
});
