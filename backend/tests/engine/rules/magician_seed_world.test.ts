import { expect, test } from "bun:test";
import { bootstrapGame } from "../../../src/app/bootstrap";
import { magicianTwelveConfig } from "../../../src/runtime/scenarios/magician_twelve";
import { createRandom, randomDraws } from "../../../src/core";
import { ObservedBot } from "../../../src/ai/agents/providers/observed_bot";
import { ObservedPlayersActionProvider } from "../../../src/ai/agents/providers/observed_players";
for (const firstNight of [1, 2] as const)
  for (const shot of ["original", "exchanged"] as const)
    for (const locale of ["zh-CN", "en"] as const)
      test(
        "Magician actual World 20 seeds/" + firstNight + "/" + shot + "/" + locale,
        async () => {
          for (let seed = 0; seed < 20; seed++) {
            const config = structuredClone(magicianTwelveConfig);
            config.magician!.firstNight = firstNight;
            config.magician!.deathShotTargetPolicy = shot;
            const random = createRandom(
              "magician:" + firstNight + ":" + shot + ":" + locale + ":" + seed,
            );
            const game = bootstrapGame(config, { locale, random });
            const styles = ["active", "conservative", "competitive", "random"] as const;
            const strategies = new Map(
              game.playerIds.map((id) => [
                id,
                new ObservedBot(
                  randomDraws(random.fork("players").fork("id:" + id)),
                  styles[id % 4]!,
                ),
              ]),
            );
            const result = await game.phaseManager.runUntilGameOver(
              new ObservedPlayersActionProvider(game.world, strategies, config),
              30,
            );
            expect(result.gameOver).toBe(true);
            expect(result.result!.reason).not.toBe("max_days_reached");
          }
        },
        120000,
      );
