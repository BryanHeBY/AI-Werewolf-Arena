/**
 * Scenario tests run fifty fixed-seed Cursed Fox games for each configured board and locale with the existing baseline provider.
 * Inputs are finite scripted/official-size rosters; independent literal terminal count, Fox survival, god-side/wolf-side membership and settlement invariants are the oracle.
 * The provider retains explicit true-camp simulation privilege and the known F01 exception; it is not an expected-rule oracle. No model transport or golden archive generation occurs.
 */
import { expect, test } from "bun:test";
import { bootstrapGame } from "../../../../src/app/bootstrap";
import { createRandom, Camp, COMPONENT, Role, type RoleComponent } from "../../../../src/core";
import { BaselineBotActionProvider } from "../../../../src/ai/agents/providers/action_providers";
import { FOX_CASES, foxScenario, foxBoard } from "../../../support/cursed_fox_scenarios";
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
            game.world.getComponent<RoleComponent>(id, COMPONENT.Role)!,
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
              alive.every((id) => roles.get(id)!.camp !== Camp.Wolf) ||
                alive.every((id) => roles.get(id)!.camp !== Camp.Good),
            ).toBe(true);
          } else {
            expect(result.outcome.primary.kind).toBe("faction");
            expect(alive).not.toContain(fox);
            expect(result.outcome.winningPlayerIds).toEqual(
              game.playerIds.filter((id) => roles.get(id)!.camp === result.winner),
            );
          }
        } else expect(result.reason).toBe("max_days_reached");
        for (const id of game.playerIds)
          for (const state of Object.values(roles.get(id)!.privateState.abilities ?? {}) as any[]) {
            expect(state.uses).toBeGreaterThanOrEqual(0);
            if (state.maxUses !== null) expect(state.uses).toBeLessThanOrEqual(state.maxUses);
          }
      }
  }, 60000);
