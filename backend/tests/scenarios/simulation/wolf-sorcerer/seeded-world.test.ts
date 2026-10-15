/**
 * 模拟场景测试：负责执行狼术师原种子的首夜、枪目标及语言政策实际 World。输入保留原矩阵；历史下限、正选择次数及非超时终局检查资格时点，不替代归档 golden 或声称新增独立规则覆盖。
 */
import type { RoleComponent } from "../../../../src/domain/components/role";
import { getWolfSorcererState } from "../../../../src/features/wolf-sorcerer/state-slot";
import { expect, test } from "bun:test";
import { COMPONENT } from "../../../../src/domain/components/names";
import { bootstrapGame } from "../../../../src/app/bootstrap";
import { wolfSorcererTwelveConfig } from "../../../../src/rulesets/presets/wolf-sorcerer-twelve";
import { createRandom, randomDraws } from "../../../../src/domain";
import { ObservedBot } from "../../../../src/agents/providers/observed-bot";
import { ObservedPlayersActionProvider } from "../../../../src/app/observed-players-action-provider";
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
              new ObservedPlayersActionProvider(game.world, strategies),
              30,
            );
            expect(result.gameOver).toBe(true);
            expect(result.result!.reason).not.toBe("max_days_reached");
            const state = game.world
              .entityIds()
              .map((id) =>
                getWolfSorcererState(game.world.getComponent(id, COMPONENT.Role), () =>
                  game.world.getComponent(id, COMPONENT.Camp),
                ),
              )
              .find(Boolean);
            expect(state?.history.every((row) => row.day >= firstNight)).toBe(true);
            if (state?.history.some((row) => row.pair !== null)) activations++;
          }
          expect(activations).toBeGreaterThan(0);
        },
        120000,
      );
