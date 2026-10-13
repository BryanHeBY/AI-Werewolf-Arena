/**
 * 场景模拟测试验证原有二十个 seed 下真实魔术师 World 的自然终局，覆盖枪、首夜、枪目标与语言政策。
 * 输入为固定 seed 的观察策略与原政策矩阵；输出以终局和未超时的字面断言检查自然结束。
 * 原 seed／行动矩阵及断言是预期来源；不调用模型，不替代归档 golden 或宣称新增独立规则覆盖。
 */
import { expect, test } from "bun:test";
import { bootstrapGame } from "../../../../src/app/bootstrap";
import { magicianTwelveConfig } from "../../../../src/runtime/scenarios/magician_twelve";
import { createRandom, randomDraws } from "../../../../src/core";
import { ObservedBot } from "../../../../src/ai/agents/providers/observed_bot";
import { ObservedPlayersActionProvider } from "../../../../src/app/observed-players-action-provider";
for (const gunPolicy of ["awa_qualified_sources_v1", "awa_day_deaths_v1"] as const)
  for (const firstNight of [1, 2] as const)
    for (const shot of ["original", "exchanged"] as const)
      for (const locale of ["zh-CN", "en"] as const)
        test(
          "Magician actual World 20 seeds/" +
            gunPolicy +
            "/" +
            firstNight +
            "/" +
            shot +
            "/" +
            locale,
          async () => {
            for (let seed = 0; seed < 20; seed++) {
              const config = structuredClone(magicianTwelveConfig);
              config.wolfKing = { deathActionPolicy: gunPolicy };
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
                new ObservedPlayersActionProvider(game.world, strategies),
                30,
              );
              expect(result.gameOver).toBe(true);
              expect(result.result!.reason).not.toBe("max_days_reached");
            }
          },
          120000,
        );
