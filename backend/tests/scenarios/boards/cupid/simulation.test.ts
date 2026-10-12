/**
 * Scenario tests run fifty fixed-seed Cupid games per board and locale through the existing baseline simulation provider.
 * Inputs include both configured lovers-victory policies; independent literal membership, count, original-life and terminal-outcome expectations check the real game cycles.
 * The baseline retains its explicit true-camp test privilege and F01 production exception. These tests do not claim that provider is a player-knowledge or expected-rule oracle, and use no model transport.
 */
import { expect, test } from "bun:test";
import { bootstrapGame } from "../../../../src/app/bootstrap";
import {
  createRandom,
  Camp,
  COMPONENT,
  Role,
  type RoleComponent,
  type VictoryComponent,
} from "../../../../src/core";
import { BaselineBotActionProvider } from "../../../../src/ai/agents/providers/action_providers";
import { CUPID_CASES, cupidScenario, cupidBoard } from "../../../support/cupid_scenarios";
import { loversRecord } from "../../../../src/game/mechanisms/roles/cupid/relation";
const boards = [
  ...CUPID_CASES.map((name) => ({ name, board: cupidScenario(name).board.config })),
  ...(["netease_2017_cupid_follows_lovers_v1", "lui_meme_lovers_only_v1"] as const).map(
    (policy) => ({
      name: `twelve_${policy}`,
      board: cupidBoard(
        [
          Role.Cupid,
          Role.Wolf,
          Role.Wolf,
          Role.Wolf,
          Role.Hunter,
          Role.Seer,
          Role.Witch,
          Role.Guard,
          Role.Villager,
          Role.Villager,
          Role.Villager,
          Role.Idiot,
        ],
        policy,
      ),
    }),
  ),
];
for (const { name, board } of boards)
  test(`${name}: 50 fixed seeds in each locale terminate with independent count, membership and original-life oracles`, async () => {
    for (const locale of ["zh-CN", "en"] as const)
      for (let seed = 0; seed < 50; seed++) {
        const game = bootstrapGame(board, {
            locale,
            random: createRandom(`cupid-bulk:${name}:${seed}`),
          }),
          base = new BaselineBotActionProvider(game.world);
        const snapshot = await game.phaseManager.runUntilGameOver(base, 16),
          events = game.phaseManager.getEvents(),
          alive = game.world.getAliveEntityIds(),
          record = loversRecord(game.world)!;
        expect(snapshot.gameOver).toBe(true);
        expect(events.filter((event) => event.type === "game_over")).toHaveLength(1);
        expect(events.at(-1)!.type).toBe("game_over");
        expect(events.filter((event) => event.type === "cupid_lovers_chosen")).toHaveLength(1);
        expect(events.filter((event) => event.type === "lover_recognized")).toHaveLength(2);
        expect(record).not.toBeNull();
        expect(alive.includes(record.pairIds[0])).toBe(alive.includes(record.pairIds[1]));
        const result = snapshot.result!;
        if (result.outcome.kind === "victory") {
          if (result.outcome.primary.kind === "relationship") {
            expect(record.mixed).toBe(true);
            expect(record.pairIds.every((id) => alive.includes(id))).toBe(true);
            const members = [
              ...new Set([
                ...record.pairIds,
                ...(record.policy === "netease_2017_cupid_follows_lovers_v1"
                  ? [record.actorId]
                  : []),
              ]),
            ].sort((a, b) => a - b);
            expect(result.outcome.winningPlayerIds).toEqual(members);
            expect(alive.every((id) => members.includes(id))).toBe(true);
          } else {
            expect(result.outcome.primary.kind).toBe("faction");
            const actualRoles = alive.map(
              (id) => [id, game.world.getComponent<RoleComponent>(id, COMPONENT.Role)!] as const,
            );
            const wolves = actualRoles.filter(([, role]) => role.camp === Camp.Wolf).length;
            const good = actualRoles.filter(
              ([id, role]) =>
                role.camp === Camp.Good &&
                !(
                  record.policy === "netease_2017_cupid_follows_lovers_v1" &&
                  id === record.actorId &&
                  (record.mixed || record.pairCamps[0] === Camp.Wolf)
                ),
            ).length;
            expect(result.winner).toBe(wolves === 0 ? Camp.Good : good === 0 ? Camp.Wolf : null);
            expect(result.outcome.winningPlayerIds).toEqual(
              game.playerIds.filter((id) =>
                game.world
                  .getComponent<VictoryComponent>(id, COMPONENT.Victory)!
                  .affiliations.some((a) => a.kind === "faction" && a.faction === result.winner),
              ),
            );
          }
        } else expect(result.reason).toBe("max_days_reached");
      }
  }, 60000);
