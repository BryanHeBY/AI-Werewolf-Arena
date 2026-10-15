/**
 * 模拟场景测试：负责执行学者／导师原四十个种子和双语的实际 World。输入为原 preset 和动作矩阵；双持有者库存、模式只用一次、第二天历史边界及自然完成为明确预期，不替代归档 golden 或声称新增独立规则覆盖。
 */
import { expect, test } from "bun:test";
import { COMPONENT, createRandom, randomDraws, type RoleComponent } from "../../../../src/domain";
import { bootstrapGame } from "../../../../src/app/bootstrap";
import { scholarMentorTwelveConfig } from "../../../../src/runtime/scenarios/scholar_mentor_twelve";
import { scholarMentorStateForRole } from "../../../../src/game/mechanisms/roles/scholar_mentor/ports";
import { ObservedBot } from "../../../../src/ai/agents/providers/observed_bot";
import { ObservedPlayersActionProvider } from "../../../../src/app/observed-players-action-provider";
import { isScholarMentorPreset } from "../../../../src/rulesets";
for (const locale of ["zh-CN", "en"] as const)
  test(
    "Scholar Mentor actual World initial/" + locale,
    async () => {
      let choices = 0;
      for (let seed = 0; seed < 40; seed++) {
        const config = structuredClone(scholarMentorTwelveConfig);
        expect(isScholarMentorPreset(config)).toBe(true);
        const random = createRandom("scholar-mentor:" + locale + ":" + seed),
          game = bootstrapGame(config, { locale, random });
        expect(
          game.world
            .entityIds()
            .filter(
              (id) => game.world.getComponent(id, COMPONENT.Camp)?.camp === "wolf",
            ).length,
        ).toBe(4);
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
        const states = game.world
          .entityIds()
          .map((id) =>
            scholarMentorStateForRole(game.world.getComponent(id, COMPONENT.Role), () => game.world.getComponent(id, COMPONENT.Camp)),
          )
          .filter(Boolean);
        expect(states.length).toBe(2);
        for (const state of states) {
          choices += state!.history.length;
          expect(state!.history.filter((h) => h.mode === "enhance").length).toBeLessThanOrEqual(1);
          expect(state!.history.filter((h) => h.mode === "weaken").length).toBeLessThanOrEqual(1);
          expect(state!.history.every((h) => h.day >= 2)).toBe(true);
        }
      }
      expect(choices).toBeGreaterThan(0);
    },
    120000,
  );
