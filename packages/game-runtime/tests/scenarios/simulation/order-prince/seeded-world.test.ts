/**
 * 模拟场景测试：执行序王双语与原二十个种子的实际 World。输入为有种子的观察玩家策略；自然终局及正激活次数为字面预期，验证原翻牌路径，不替代 golden 或声称新增独立规则覆盖。
 */
import type { RoleComponent } from "../../../../src/domain/components/role";
import { getOrderPrinceState } from "../../../../src/features/order-prince/ports";
import { expect, test } from "bun:test";
import { COMPONENT } from "../../../../src/domain/components/names";
import { bootstrapGame } from "../../../../src/app/bootstrap";
import { orderPrinceTwelveConfig } from "../../../../src/rulesets/presets/order-prince-twelve";
import { createRandom, randomDraws } from "../../../../src/domain";
import { ObservedBot } from "../../../../src/agents/providers/observed-bot";
import { ObservedPlayersActionProvider } from "../../../../src/app/observed-players-action-provider";
for (const locale of ["zh-CN", "en"] as const)
  test(
    "Order Prince actual World 20 seeds/" + locale,
    async () => {
      let activations = 0;
      for (let seed = 0; seed < 20; seed++) {
        const config = structuredClone(orderPrinceTwelveConfig);
        const random = createRandom("order-prince:" + locale + ":" + seed);
        const game = bootstrapGame(config, { locale, random });
        const styles = ["active", "conservative", "competitive", "random"] as const;
        const strategies = new Map(
          game.playerIds.map((id) => [
            id,
            new ObservedBot(randomDraws(random.fork("players").fork("id:" + id)), styles[id % 4]!),
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
            getOrderPrinceState(game.world.getComponent(id, COMPONENT.Role), () =>
              game.world.getComponent(id, COMPONENT.Camp),
            ),
          )
          .find(Boolean);
        if (state?.history.some((row) => row.activate)) activations++;
      }
      expect(activations).toBeGreaterThan(0);
    },
    120000,
  );
