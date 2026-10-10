import type { RoleComponent } from "../../../src/core/domain/components/role";
import { getTricksterState } from "../../../src/game/mechanisms/roles/trickster/state";
import { expect, test } from "bun:test";
import { COMPONENT } from "../../../src/core/domain/components/names";
import { bootstrapGame } from "../../../src/app/bootstrap";
import { tricksterTwelveConfig } from "../../../src/runtime/scenarios/trickster_twelve";
import { createRandom, randomDraws } from "../../../src/core";
import { ObservedBot } from "../../../src/ai/agents/providers/observed_bot";
import { ObservedPlayersActionProvider } from "../../../src/ai/agents/providers/observed_players";
for (const locale of ["zh-CN", "en"] as const)
  test(
    "Trickster actual World 20 seeds/" + locale,
    async () => {
      let activations = 0;
      for (let seed = 0; seed < 20; seed++) {
        const config = structuredClone(tricksterTwelveConfig);
        const random = createRandom("trickster:" + locale + ":" + seed);
        const game = bootstrapGame(config, { locale, random });
        const styles = ["active", "conservative", "competitive", "random"] as const;
        const strategies = new Map(
          game.playerIds.map((id) => [
            id,
            new ObservedBot(randomDraws(random.fork("players").fork("id:" + id)), styles[id % 4]!),
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
            getTricksterState(game.world.getComponent<RoleComponent>(id, COMPONENT.Role)),
          )
          .find(Boolean);
        if (state?.history.some((row) => row.pair !== null)) activations++;
      }
      expect(activations).toBeGreaterThan(0);
    },
    120000,
  );
