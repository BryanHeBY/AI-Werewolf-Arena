import { expect, test } from "bun:test";
import { bootstrapGame } from "../../../src/app/bootstrap";
import { COMPONENT, Role, type RoleComponent } from "../../../src/core";
import { createRandom, RANDOM_ALGORITHM } from "../../../src/core/domain/random";
import { BaselineBotActionProvider } from "../../../src/ai/agents/providers/action_providers";
import { sixPlayerMvpConfig } from "../../../src/runtime/scenarios/six_player_mvp";
import { twelvePlayerStandardConfig } from "../../../src/runtime/scenarios/twelve_player_standard";

test("named random streams have frozen versioned vectors and do not consume their parent", () => {
  const root = createRandom("awa-vector");
  expect(root.metadata.algorithm).toBe(RANDOM_ALGORITHM);
  // Independently calculated reference vectors; changing the algorithm requires a version change.
  expect(Array.from({ length: 4 }, () => root.next())).toEqual([
    0.8902139561250806, 0.4405340019147843, 0.7681344449520111, 0.4770409520715475,
  ]);
  const consumed = root.fork("player:1");
  for (let index = 0; index < 100; index++) consumed.next();
  expect(root.fork("deal").next()).toBe(createRandom("awa-vector").fork("deal").next());
  expect(root.fork("player:2").next()).not.toBe(root.fork("player:1").next());
  expect(createRandom("欢乐局").fork("night").fork("day:1:wolf-order").next()).toBe(
    0.8437032753136009,
  );
  expect(() => createRandom(" ")).toThrow("random_seed_empty");
});

test("fixed role fixtures preserve deck counts and never bypass board rules", () => {
  const fixedRoles = [Role.Wolf, Role.Seer, Role.Villager, Role.Wolf, Role.Guard, Role.Villager];
  const { world } = bootstrapGame(sixPlayerMvpConfig, {
    fixedRoles,
    random: createRandom("fixed"),
  });
  expect(
    world.entityIds().map((id) => world.getComponent<RoleComponent>(id, COMPONENT.Role)?.role),
  ).toEqual(fixedRoles);
  expect(() => bootstrapGame(sixPlayerMvpConfig, { fixedRoles: fixedRoles.slice(1) })).toThrow(
    "fixed_role_deck_mismatch",
  );
  expect(() => bootstrapGame(sixPlayerMvpConfig, { fixedRoles: Array(6).fill(Role.Wolf) })).toThrow(
    "fixed_role_deck_mismatch",
  );
});

for (const [board, config] of [
  ["six", sixPlayerMvpConfig],
  ["twelve", twelvePlayerStandardConfig],
] as const) {
  test(`${board}: 25 seeds reproduce complete engine games even with other games interleaved`, async () => {
    const run = async (seed: string, delayed: boolean) => {
      const context = bootstrapGame(config, { random: createRandom(seed) });
      // Existing privileged baseline is a deterministic controller fixture, not the T03 simulated player.
      const baseline = new BaselineBotActionProvider(context.world);
      const provider = {
        async getAction(request: Parameters<typeof baseline.getAction>[0]) {
          if (delayed) await Promise.resolve();
          return baseline.getAction(request);
        },
      };
      const snapshot = await context.phaseManager.runUntilGameOver(provider, 30);
      return {
        snapshot,
        events: context.phaseManager
          .getEvents()
          .map(({ timestamp: _timestamp, ...event }) => event),
      };
    };
    for (let index = 0; index < 25; index++) {
      const seed = `${board}:rng:${index}`;
      const [first, other, replay] = await Promise.all([
        run(seed, false),
        run(`other:${seed}`, true),
        run(seed, true),
      ]);
      expect(first.snapshot.gameOver).toBe(true);
      expect(first.snapshot.result?.reason).not.toBe("max_days_reached");
      expect(other.snapshot.gameOver).toBe(true);
      expect(replay).toEqual(first);
    }
  });
}
