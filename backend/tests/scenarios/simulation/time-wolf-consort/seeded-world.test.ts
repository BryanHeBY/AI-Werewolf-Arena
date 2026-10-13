/**
 * 模拟场景测试：负责执行时间狼妃两种反射范围、语言及原种子的实际 World。输入为原 preset 和策略；存活状态、自然终局及正选择次数采用明确预期，不替代归档 golden 或声称新增独立规则覆盖。
 */
import { expect, test } from "bun:test";
import { COMPONENT, createRandom, randomDraws, type RoleComponent } from "../../../../src/core";
import { bootstrapGame } from "../../../../src/app/bootstrap";
import { timeConsortTwelveConfig } from "../../../../src/runtime/scenarios/time_consort_twelve";
import { getTimeConsortState } from "../../../../src/game/mechanisms/roles/time_wolf_consort/state";
import { ObservedBot } from "../../../../src/ai/agents/providers/observed_bot";
import { ObservedPlayersActionProvider } from "../../../../src/app/observed-players-action-provider";
import { isTimeConsortPreset } from "../../../../src/rulesets";
for (const locale of ["zh-CN", "en"] as const)
  for (const scope of ["whole_night", "first_effect"] as const)
    test(
      "Consort actual World initial/" + locale + "/" + scope,
      async () => {
        let choices = 0;
        for (let seed = 0; seed < 20; seed++) {
          const config = structuredClone(timeConsortTwelveConfig);
          config.timeConsort!.reflectionScope = scope;
          expect(isTimeConsortPreset(config)).toBe(true);
          const random = createRandom("time-consort:" + locale + ":" + scope + ":" + seed),
            game = bootstrapGame(config, { locale, random });
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
              getTimeConsortState(game.world.getComponent(id, COMPONENT.Role)),
            )
            .find(Boolean);
          expect(state).toBeDefined();
          choices += state!.history.length;
        }
        expect(choices).toBeGreaterThan(0);
      },
      120000,
    );
