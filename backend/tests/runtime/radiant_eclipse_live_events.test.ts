import { expect, test } from "bun:test";
import { RULESET } from "@ai-werewolf-arena/game-catalog";
import { ReproductionTrace, type ReproductionMetadata } from "../../src/recording/reproduction";
import {
  captureCheckpoint,
  currentEngineVersion,
} from "../../src/runtime/simulation/reproduction_context";
import { radiantFixture } from "../support/radiant_eclipse";
async function fixture() {
  const f = await radiantFixture();
  const events = f.phaseManager.getEvents();
  const cp = captureCheckpoint(f.world, f.phaseManager.getSnapshot(), 0, true, events.length);
  const metadata: ReproductionMetadata = {
    engine: await currentEngineVersion(),
    boardId: f.board.definition.id,
    normalizedBoard: f.board.config,
    locale: f.world.locale,
    maxDays: 6,
    dealMode: f.dealMode,
    ruleset: RULESET,
    random: f.random.metadata,
    players: cp.players.map(({ id, name, role, camp }) => ({ id, name, role, camp })),
  };
  return { f, cp, metadata, events };
}
test("one owner snapshot per build is detached from source and returned mutable archive", async () => {
  const { f, cp, metadata, events } = await fixture();
  let source = structuredClone(events),
    calls = 0;
  const trace = new ReproductionTrace(
    metadata,
    () => {},
    () => {
      calls++;
      return source;
    },
  );
  trace.checkpoint(cp, events);
  const first = trace.build();
  expect(calls).toBe(1);
  const initial = JSON.stringify(first);
  const sourceInfo = source.find((e) => e.type === "god_private_game_info")!;
  sourceInfo.payload.players[0]!.name = "SYNTHETIC_CANARY";
  expect(JSON.stringify(first)).toBe(initial);
  expect(f.phaseManager.getEvents()).toEqual(events);
  source = structuredClone(events);
  const info = first.events.find((e) => e.type === "god_private_game_info")!;
  (info.payload.players as Array<{ name: string }>)[0]!.name = "RETURNED_CANARY";
  first.checkpoints[0]!.players[0]!.privateState.abilities = {};
  const second = trace.build();
  expect(calls).toBe(2);
  expect(JSON.stringify(second.events)).toBe(JSON.stringify(events));
  expect(second.checkpoints[0]).toEqual(cp);
});
test("short live stream is rejected without changing the checkpoint snapshot", async () => {
  const { cp, metadata, events } = await fixture();
  let short = true;
  const trace = new ReproductionTrace(
    metadata,
    () => {},
    () => (short ? events.slice(0, 1) : events),
  );
  trace.checkpoint(cp, events);
  expect(() => trace.build()).toThrow("reproduction_live_events_before_checkpoint");
  short = false;
  expect(trace.build().checkpoints).toEqual([cp]);
});
test("callback failure is propagated and a later valid snapshot has unchanged trace input", async () => {
  const { cp, metadata, events } = await fixture();
  let fail = true;
  const trace = new ReproductionTrace(
    metadata,
    () => {},
    () => {
      if (fail) throw new Error("synthetic_live_read_failure");
      return events;
    },
  );
  trace.checkpoint(cp, events);
  expect(() => trace.build()).toThrow("synthetic_live_read_failure");
  fail = false;
  expect(JSON.stringify(trace.build().events)).toBe(JSON.stringify(events));
  expect(trace.build().checkpoints).toEqual([cp]);
});
