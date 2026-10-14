/**
 * 完整场景测试：负责按每种咒狐板子与语言的原五十个固定种子运行 baseline 对局。输入为原政策及策略；既有独立成员、数量、生命和终局断言为预期，不把策略决策当独立规则 oracle，不调用模型。
 */
import { expect, test } from "bun:test";
import { bootstrapGame } from "../../../../src/app/bootstrap";
import { createRandom, Camp, COMPONENT, Role, type RoleComponent } from "../../../../src/core";
import { BaselineBotActionProvider } from "../../../../src/game/drivers/privileged-baseline";
import {
  FOX_CASES,
  foxScenario,
  foxBoard,
} from "../../../support/features/cursed-fox/builders/scenario";
import {
  boardDefinitionFromConfig,
  parseBoardDefinition,
} from "../../../../src/runtime/config/board_definition";
const boards = [
  ...FOX_CASES.map((name) => ({ name, board: foxScenario(name).board.config })),
  {
    name: "official_10",
    board: parseBoardDefinition(
      boardDefinitionFromConfig(
        "fox_10",
        foxBoard([
          Role.CursedFox,
          Role.Wolf,
          Role.Wolf,
          Role.Wolf,
          Role.Villager,
          Role.Villager,
          Role.Villager,
          Role.Seer,
          Role.Witch,
          Role.Hunter,
        ]),
      ),
    ).config,
  },
  {
    name: "official_12",
    board: parseBoardDefinition(
      boardDefinitionFromConfig(
        "fox_12",
        foxBoard([
          Role.CursedFox,
          Role.Wolf,
          Role.Wolf,
          Role.Wolf,
          Role.Wolf,
          Role.Villager,
          Role.Villager,
          Role.Villager,
          Role.Seer,
          Role.Witch,
          Role.Hunter,
          Role.Idiot,
        ]),
      ),
    ).config,
  },
];
for (const { name, board } of boards)
  test(`${name}: 50 fixed seeds in both languages keep finite independent victory and settlement invariants`, async () => {
    for (const locale of ["zh-CN", "en"] as const)
      for (let seed = 0; seed < 50; seed++) {
        const game = bootstrapGame(board, {
            locale,
            random: createRandom(`fox-bulk:${name}:${seed}`),
          }),
          base = new BaselineBotActionProvider(game.world);
        const snapshot = await game.phaseManager.runUntilGameOver(base, 12),
          events = game.phaseManager.getEvents();
        expect(snapshot.gameOver).toBe(true);
        expect(events.filter((e) => e.type === "game_over")).toHaveLength(1);
        expect(events.at(-1)!.type).toBe("game_over");
        const roles = new Map(
          game.playerIds.map((id) => [
            id,
            game.world.getComponent(id, COMPONENT.Role)!,
          ]),
        );
        const alive = game.world.getAliveEntityIds(),
          fox = game.playerIds.find((id) => roles.get(id)!.role === Role.CursedFox)!;
        const result = snapshot.result!;
        if (result.outcome.kind === "victory") {
          if (result.outcome.primary.kind === "individual") {
            expect(result.winner).toBeNull();
            expect(result.outcome.winningPlayerIds).toEqual([fox]);
            expect(alive).toContain(fox);
            expect(
              alive.every((id) => game.world.getComponent(id, COMPONENT.Camp)!.camp !== Camp.Wolf) ||
                alive.every((id) => game.world.getComponent(id, COMPONENT.Camp)!.camp !== Camp.Good),
            ).toBe(true);
          } else {
            expect(result.outcome.primary.kind).toBe("faction");
            expect(alive).not.toContain(fox);
            expect(result.outcome.winningPlayerIds).toEqual(
              game.playerIds.filter((id) => game.world.getComponent(id, COMPONENT.Camp)!.camp === result.winner),
            );
          }
        } else expect(result.reason).toBe("max_days_reached");
        for (const id of game.playerIds)
          for (const state of Object.values(
            (roles.get(id)!.privateState as { readonly abilities?: unknown }).abilities ?? {},
          ) as any[]) {
            expect(state.uses).toBeGreaterThanOrEqual(0);
            if (state.maxUses !== null) expect(state.uses).toBeLessThanOrEqual(state.maxUses);
          }
      }
  }, 60000);
