/**
 * Unit tests for wolf-sorcerer; Isolated wolf-sorcerer seat-mapping contract; native in-memory owner/frame/readers, no assembled game cycle.
 * Inputs are existing in-memory fixtures, original callback controls and explicit
 * invalid mutations. Original literal expectations, identity snapshots and
 * rejection assertions supply the oracle; none are regenerated during relocation.
 * Test-owned mocks/components exercise this boundary without a model or physical
 * transport. Support files, fixture bytes, policy and state behavior are retained.
 */
import { expect, test } from "bun:test";
import {
  resolveOrderedSeatTarget,
  type SeatExchangePair,
} from "../../../../src/game/mechanisms/roles/wolf_sorcerer/seat_mapping";
test("Wolf Sorcerer ordered seat composition matches physical occupant swaps exhaustively", () => {
  const ids = [1, 2, 3, 4, 5],
    pairs: Array<SeatExchangePair | null> = [null];
  for (const a of ids) for (const b of ids) if (a < b) pairs.push([a, b]);
  for (const mage of pairs)
    for (const wolf of pairs) {
      const occupants = [...ids];
      for (const pair of [mage, wolf])
        if (pair) {
          const a = pair[0] - 1,
            b = pair[1] - 1;
          [occupants[a], occupants[b]] = [occupants[b]!, occupants[a]!];
        }
      const mapped = ids.map((id) => resolveOrderedSeatTarget(id, mage, wolf));
      expect(mapped).toEqual(occupants);
      expect(new Set(mapped).size).toBe(ids.length);
    }
});
test("Wolf Sorcerer overlap is a directed three-cycle and equal pairs cancel", () => {
  expect([1, 2, 3].map((id) => resolveOrderedSeatTarget(id, [1, 2], [2, 3]))).toEqual([2, 3, 1]);
  expect([1, 2, 3].map((id) => resolveOrderedSeatTarget(id, [2, 3], [1, 2]))).toEqual([3, 1, 2]);
  for (const id of [1, 2, 3, 4]) expect(resolveOrderedSeatTarget(id, [1, 2], [2, 1])).toBe(id);
});
test("Wolf Sorcerer pure mapping rejects hostile or malformed number pairs", () => {
  for (const id of [0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER])
    expect(() => resolveOrderedSeatTarget(id, null, null)).toThrow("wolf_sorcerer_mapping_invalid");
  for (const pair of [
    [1, 1],
    [0, 2],
    [1],
    [1, 2, 3],
    ["1", 2],
    [1, NaN],
  ] as unknown as SeatExchangePair[])
    expect(() => resolveOrderedSeatTarget(1, pair, null)).toThrow("wolf_sorcerer_mapping_invalid");
  let reads = 0;
  const accessor = [1, 2];
  Object.defineProperty(accessor, "0", {
    get() {
      reads++;
      return 1;
    },
  });
  expect(() =>
    resolveOrderedSeatTarget(1, accessor as unknown as SeatExchangePair, null),
  ).toThrow();
  expect(reads).toBe(0);
  const proxy = new Proxy([1, 2], {
    get() {
      reads++;
      throw new Error("read");
    },
  });
  expect(() => resolveOrderedSeatTarget(1, null, proxy as unknown as SeatExchangePair)).toThrow();
  expect(reads).toBe(0);
});
