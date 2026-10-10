import type { RoleComponent } from "../../../src/core/domain/components/role";
import { getWolfSorcererState } from "../../../src/game/mechanisms/roles/wolf_sorcerer/state";
import { expect, test } from "bun:test";
import { COMPONENT } from "../../../src/core/domain/components/names";
import { bootstrapGame } from "../../../src/app/bootstrap";
import { wolfSorcererTwelveConfig } from "../../../src/runtime/scenarios/wolf_sorcerer_twelve";
import { createRandom, randomDraws } from "../../../src/core";
import { ObservedBot } from "../../../src/ai/agents/providers/observed_bot";
import { ObservedPlayersActionProvider } from "../../../src/ai/agents/providers/observed_players";
for (const firstNight of [1, 2] as const)
  for (const shot of ["original", "exchanged"] as const)
    for (const locale of ["zh-CN", "en"] as const)
      test(
        "Wolf Sorcerer actual World 20 seeds/" + firstNight + "/" + shot + "/" + locale,
        async () => {
          let activations = 0;
          for (let seed = 0; seed < 20; seed++) {
            const config = structuredClone(wolfSorcererTwelveConfig);
            config.wolfSorcerer!.firstNight = firstNight;
            config.magician!.firstNight = firstNight;
            config.magician!.deathShotTargetPolicy = shot;
            const random = createRandom("wolf_sorcerer:" + locale + ":" + seed);
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
            const state = game.world
              .entityIds()
              .map((id) =>
                getWolfSorcererState(game.world.getComponent<RoleComponent>(id, COMPONENT.Role)),
              )
              .find(Boolean);
            expect(state?.history.every((row) => row.day >= firstNight)).toBe(true);
            if (state?.history.some((row) => row.pair !== null)) activations++;
          }
          expect(activations).toBeGreaterThan(0);
        },
        120000,
      );
