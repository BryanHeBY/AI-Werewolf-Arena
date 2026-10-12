import { expect, test } from "bun:test";
import { readdir } from "node:fs/promises";
import path from "node:path";
import { runGame, type GameRunDependencies } from "../../src/runtime/game_runner";
import { resolveGameSetup } from "../../src/runtime/config/resolve_game_setup";
import { parseRuntimeConfig } from "../../src/runtime/config/parse_config";
import { readReproduction } from "../../src/runtime/simulation/replay_reproduction";
import { createTestTempDirectory } from "../support/drivers/temp-directories";

async function setup(maxRuntimeMs: number) {
  const root = await createTestTempDirectory("awa-run-dependencies-");
  const runtime = parseRuntimeConfig({
    providers: {
      default: "local",
      items: { local: { type: "openai", apiKey: "synthetic-only", baseURL: "http://127.0.0.1:1" } },
    },
    agents: {
      default: "local",
      items: { local: { kind: "llm", provider: "local", model: "unused" } },
    },
    game: { agent: "local" },
    debugSummary: { agent: { enabled: false } },
  });
  return {
    root,
    game: resolveGameSetup(runtime, {
      recordRootDir: root,
      maxRuntimeMs: Math.max(1, maxRuntimeMs),
      maxDays: 1,
      llmTimeoutMs: 10000,
      streamEvents: false,
      printThinking: false,
      color: false,
    }),
  };
}
test("runner reports one detached closed snapshot after actions and schedulers drain", async () => {
  const { game } = await setup(0);
  // Exercise an already exhausted run directly; JSON configuration stays positive.
  game.options.maxRuntimeMs = 0;
  const states: Parameters<NonNullable<GameRunDependencies["onRuntimeClosed"]>>[0][] = [];
  await runGame(game, { onRuntimeClosed: (state) => states.push(state) });
  expect(states).toHaveLength(1);
  expect(states[0]).toEqual({
    closed: true,
    sdk: { closed: true, turns: 0, scheduler: { closed: true, active: 0, queued: 0 } },
  });
});
test("runner preserves selector failure plus closed observer failure in both thrown result and persisted termination", async () => {
  const { root, game } = await setup(10000);
  const primary = new RangeError("synthetic_selector_failed"),
    secondary = new TypeError("synthetic_observer_failed");
  let closes = 0,
    caught: unknown;
  try {
    await runGame(game, {
      selectRequestDeadline: (request) => {
        expect(Object.keys(request).sort()).toEqual([
          "actorId",
          "actorOrdinal",
          "day",
          "nowMs",
          "ordinal",
          "retryAttempt",
          "stage",
        ]);
        throw primary;
      },
      onRuntimeClosed: (state) => {
        closes++;
        expect(state.closed).toBe(true);
        throw secondary;
      },
    });
  } catch (error) {
    caught = error;
  }
  expect(closes).toBe(1);
  expect(caught).toBeInstanceOf(AggregateError);
  expect((caught as AggregateError).errors).toContain(primary);
  expect((caught as AggregateError).errors).toContain(secondary);
  const session = (await readdir(root)).find((s) => s.startsWith("session_"))!;
  const record = await readReproduction(path.join(root, session, "reproduction.json"));
  expect(record.termination).toMatchObject({
    reason: "runtime_error",
    errors: [
      { scope: "cycle", name: "RangeError" },
      { scope: "cleanup", name: "TypeError" },
    ],
  });
});
test("nonfinite selected deadline fails before opening a model turn and still closes the runtime", async () => {
  const { game } = await setup(10000);
  let closed: Parameters<NonNullable<GameRunDependencies["onRuntimeClosed"]>>[0] | undefined;
  await expect(
    runGame(game, {
      selectRequestDeadline: () => NaN,
      onRuntimeClosed: (state) => {
        closed = state;
      },
    }),
  ).rejects.toThrow("game_request_deadline_invalid");
  expect(closed?.sdk?.turns).toBe(0);
  expect(closed?.closed).toBe(true);
});
