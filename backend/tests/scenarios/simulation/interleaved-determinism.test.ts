/**
 * Simulation scenario tests own repeated and interleaved complete engine games for the
 * original two boards and25seeds. The unchanged baseline provider and delayed replies
 * supply actions; exact snapshots/events and natural termination are the oracle. The
 * enclosing board/seed/interleaving matrices remain intact and no model is invoked.
 */
import { expect, test } from "bun:test";
import { bootstrapGame } from "../../../src/app/bootstrap";
import { createRandom } from "../../../src/core/domain/random";
import { BaselineBotActionProvider } from "../../../src/ai/agents/providers/action_providers";
import { sixPlayerMvpConfig } from "../../../src/runtime/scenarios/six_player_mvp";
import { twelvePlayerStandardConfig } from "../../../src/runtime/scenarios/twelve_player_standard";

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
  }, 20000); // 75 complete games; this is a determinism gate, not a 5-second performance budget.
}
