import { expect, test } from "bun:test";
import { bootstrapGame } from "../../../src/app/bootstrap";
import { redMoonTwelveConfig } from "../../../src/runtime/scenarios/red_moon_twelve";
import {
  COMPONENT,
  Camp,
  Role,
  createRandom,
  randomDraws,
  type RoleComponent,
} from "../../../src/core";
import { ObservedBot } from "../../../src/ai/agents/providers/observed_bot";
import { ObservedPlayersActionProvider } from "../../../src/ai/agents/providers/observed_players";
for (const policy of ["ends_game", "forbidden"] as const)
  for (const locale of ["zh-CN", "en"] as const)
    test(
      policy +
        "/" +
        locale +
        ": 20 full finite Red Moon games terminate with matching public deaths and side victory",
      async () => {
        for (let seed = 0; seed < 20; seed++) {
          const config = structuredClone(redMoonTwelveConfig);
          config.redMoon!.lastWolfBlastPolicy = policy;
          const random = createRandom("red-moon-world:" + policy + ":" + locale + ":" + seed);
          const game = bootstrapGame(config, { locale, random });
          const initial = new Map(
            game.playerIds.map((id) => [
              id,
              game.world.getComponent<RoleComponent>(id, COMPONENT.Role)!,
            ]),
          );
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
          const dead = new Set<number>();
          for (const e of game.phaseManager.getEvents()) {
            if (e.type === "night_resolved" || e.type === "additional_deaths")
              for (const id of e.payload.deaths) dead.add(id);
            if (e.type === "voted_out") dead.add(e.payload.target);
            if (e.type === "wolf_self_destruct") dead.add(e.payload.wolfId);
            if (e.type === "red_moon_delay_expired") dead.add(e.payload.actorId);
          }
          const alive = game.world.getAliveEntityIds();
          expect(game.playerIds.filter((id) => !dead.has(id))).toEqual(alive);
          const wolves = alive.filter((id) => initial.get(id)!.camp === Camp.Wolf);
          const villagers = alive.filter((id) => initial.get(id)!.role === Role.Villager);
          const gods = alive.filter(
            (id) => initial.get(id)!.camp === Camp.Good && initial.get(id)!.role !== Role.Villager,
          );
          const winner =
            wolves.length === 0 ? Camp.Good : !villagers.length || !gods.length ? Camp.Wolf : null;
          expect(winner).not.toBeNull();
          expect(result.result!.winner).toBe(winner);
          for (const [id, role] of initial)
            expect(game.world.getComponent<RoleComponent>(id, COMPONENT.Role)).toBe(role);
        }
      },
      120000,
    );
