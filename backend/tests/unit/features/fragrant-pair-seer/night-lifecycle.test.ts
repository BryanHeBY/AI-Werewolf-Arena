/**
 * Unit tests for the concrete Fragrant night unit with original native roster setup.
 * Inputs are fixed players, handwritten choices and delegated runtime ports; literal
 * access order, authority night status and retained knowledge/bindings are the oracle.
 * Only one bounded night opens/closes; no transport, full game or paid model runs.
 * Publication failure may abort the window but never refunds a committed knowledge draw.
 */
import { expect, test } from "bun:test";
import type { GameEvent } from "@ai-werewolf-arena/game-contract";
import { fragrantRuntimeGame } from "../../../support/features/fragrant-pair-seer/builders/runtime-game";
import { FragrantNightUnit } from "../../../../src/game/mechanisms/roles/fragrant_pair_seer/ports";
import {
  fragrantAuthoritySnapshot,
  closeFragrantNight,
  openFragrantBindChoice,
  openPairCheckChoice,
} from "../../../../src/game/mechanisms/roles/fragrant_pair_seer/authority";

function fixture(failure?: Error) {
  const game = fragrantRuntimeGame("en"),
    events: GameEvent[] = [],
    accesses: string[] = [];
  let draws = 0;
  const unit = new FragrantNightUnit(
    {
      get world() {
        accesses.push("world");
        return game.world;
      },
      get events() {
        accesses.push("events");
        return events;
      },
      drawKnowledge() {
        accesses.push("factory");
        return {
          next() {
            draws++;
            accesses.push("draw");
            return 0;
          },
        };
      },
      recordOpening() {
        accesses.push("record");
        if (failure) throw failure;
      },
    },
    1,
  );
  return { game, unit, events, accesses, draws: () => draws };
}

test("construction is inert and opening retains snapshot, lazy draw, facts and recording order", () => {
  const f = fixture();
  expect(f.accesses).toEqual([]);
  f.unit.open(() => true);
  expect(f.accesses).toEqual([
    "world",
    "world",
    "factory",
    "draw",
    "world",
    "events",
    "events",
    "record",
  ]);
  expect(f.draws()).toBe(1);
  expect(f.events.map((event) => event.type)).toEqual([
    "fragrant_night_opened",
    "fragrant_night_notified",
  ]);
  f.unit.abortIfOwned();
  f.unit.abortIfOwned();
  expect(fragrantAuthoritySnapshot(f.game.world).nights).toEqual([
    { day: 1, status: "aborted", knife: false, bindCommitted: false, pairCommitted: false },
  ]);
  expect(f.draws()).toBe(1);
});

test("required recording failure aborts the acquired night while preserving knowledge and published facts", () => {
  const failure = new Error("required_opening_record_failed"),
    f = fixture(failure);
  let caught: unknown;
  try {
    f.unit.open(() => true);
  } catch (error) {
    caught = error;
  } finally {
    f.unit.abortIfOwned();
  }
  expect(caught).toBe(failure);
  expect(f.events.map((event) => event.type)).toEqual([
    "fragrant_night_opened",
    "fragrant_night_notified",
  ]);
  const snapshot = fragrantAuthoritySnapshot(f.game.world);
  expect(snapshot.nights[0]?.status).toBe("aborted");
  expect(snapshot.fragrant.knowledgeNight).toBe(1);
  expect(f.draws()).toBe(1);
  expect(() => f.unit.open(() => true)).toThrow("fragrant_night_unavailable");
  expect(f.draws()).toBe(1);
});

test("normal close retains paid binding and finally cannot abort or reread the completed owner", () => {
  const f = fixture();
  f.unit.open(() => true);
  openFragrantBindChoice(f.game.world, 1).commit([5, 6]);
  openPairCheckChoice(f.game.world, 1).commit([9, 2]);
  f.unit.closeNormally();
  const afterClose = [...f.accesses];
  f.unit.abortIfOwned();
  expect(f.accesses).toEqual(afterClose);
  const snapshot = fragrantAuthoritySnapshot(f.game.world);
  expect(snapshot.nights).toEqual([
    { day: 1, status: "normal", knife: false, bindCommitted: true, pairCommitted: true },
  ]);
  expect(snapshot.fragrant.bindings[0]?.pairIds).toEqual([5, 6]);
  expect(snapshot.fragrant.bindings[0]?.status.kind).toBe("pending");
  expect(() => f.unit.closeNormally()).toThrow("fragrant_night_unavailable");
});

test("a failed post-opening snapshot retains the original unacquired cleanup boundary", () => {
  const game = fragrantRuntimeGame("en"),
    failure = new Error("after_open_world_read_failed"),
    events: GameEvent[] = [];
  let reads = 0,
    draws = 0;
  const unit = new FragrantNightUnit(
    {
      get world() {
        if (++reads === 3) throw failure;
        return game.world;
      },
      events,
      drawKnowledge: () => ({
        next() {
          draws++;
          return 0;
        },
      }),
      recordOpening() {
        throw new Error("recording_must_not_run");
      },
    },
    1,
  );
  let caught: unknown;
  try {
    unit.open(() => true);
  } catch (error) {
    caught = error;
  } finally {
    unit.abortIfOwned();
  }
  expect(caught).toBe(failure);
  expect(reads).toBe(3);
  expect(draws).toBe(1);
  expect(events).toEqual([]);
  expect(fragrantAuthoritySnapshot(game.world).nights[0]?.status).toBe("open");
  expect(fragrantAuthoritySnapshot(game.world).fragrant.knowledgeNight).toBe(1);
  // The original pipeline also skips abort before acquisition is recorded.
  // This privileged fixture owner closes its retained night after the assertions.
  closeFragrantNight(game.world, 1, "aborted");
});
