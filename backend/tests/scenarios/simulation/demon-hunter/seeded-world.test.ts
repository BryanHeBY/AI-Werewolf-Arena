/**
 * 模拟场景测试：负责执行六人／十二人猎魔人的两种胜利目标、双语及原一百二十五个种子的实际 World。输入保留原角色、种子和动作矩阵；初始身份／阵营／状态引用、公开死亡及手写阵营公式检查选择、免疫和终局，不替代 golden 或声称新增独立覆盖。
 */
import { expect, test } from "bun:test";
import { writeFile } from "node:fs/promises";
import { bootstrapGame } from "../../../../src/app/bootstrap";
import {
  COMPONENT,
  Camp,
  Role,
  WinCondition,
  createRandom,
  randomDraws,
  type RoleComponent,
} from "../../../../src/core";
import { ObservedBot } from "../../../../src/ai/agents/providers/observed_bot";
import { ObservedPlayersActionProvider } from "../../../../src/app/observed-players-action-provider";
import { demonHunterBoard } from "../../../support/features/demon-hunter/builders/candidate-world";
for (const size of [6, 12] as const)
  for (const goal of [WinCondition.SlaughterCity, WinCondition.SlaughterSide])
    for (const locale of ["zh-CN", "en"] as const)
      test(`${size}/${goal}/${locale}: 125 independent unrecorded Worlds, original identity, public terminal deaths and victory`, async () => {
        const report = {
          games: 0,
          choices: 0,
          backlash: 0,
          hunts: 0,
          abstain: 0,
          immunity: 0,
          deadWinners: 0,
          good: 0,
          wolf: 0,
        };
        for (let n = 0; n < 125; n++) {
          const random = createRandom(`demon-world:${size}:${goal}:${n}`),
            config = demonHunterBoard(size, goal),
            game = bootstrapGame(config, { locale, random });
          const original = new Map(
            game.playerIds.map((id) => {
              const role = game.world.getComponent(id, COMPONENT.Role)!;
              return [
                id,
                { ref: role, role: role.role, camp: role.camp, state: role.privateState },
              ];
            }),
          );
          const styles = ["active", "conservative", "competitive", "random"] as const;
          const strategies = new Map(
            game.playerIds.map((id) => [
              id,
              new ObservedBot(
                randomDraws(random.fork("players").fork(`id:${id}`)),
                styles[id % 4]!,
              ),
            ]),
          );
          const result = await game.phaseManager.runUntilGameOver(
              new ObservedPlayersActionProvider(game.world, strategies),
              30,
            ),
            events = game.phaseManager.getEvents();
          expect(result.gameOver).toBe(true);
          expect(result.result!.reason).not.toBe("max_days_reached");
          for (const [id, expected] of original) {
            const actual = game.world.getComponent(id, COMPONENT.Role)!;
            expect(actual).toBe(expected.ref);
            expect(actual.role).toBe(expected.role);
            expect(actual.camp).toBe(expected.camp);
            expect(actual.privateState).toBe(expected.state);
          }
          const publicDead = new Set<number>();
          for (const e of events) {
            if (e.type === "night_resolved" || e.type === "additional_deaths")
              for (const id of e.payload.deaths as number[]) publicDead.add(id);
            if (e.type === "voted_out") publicDead.add(e.payload.target as number);
            if (e.type === "hunter_shot") publicDead.add(e.payload.targetId as number);
            if (e.type === "wolf_self_destruct") publicDead.add(e.payload.wolfId as number);
            if (e.type === "demon_hunter_poison_immune") report.immunity++;
            if (e.type === "demon_hunter_chosen") {
              report.choices++;
              const target = e.payload.targetId as number | null;
              if (target === null) report.abstain++;
              else if (original.get(target)!.camp === Camp.Wolf) report.hunts++;
              else report.backlash++;
              expect(e.audience).toEqual([e.payload.actorId as number]);
            }
          }
          const alive = game.world.getAliveEntityIds();
          expect(game.playerIds.filter((id) => !publicDead.has(id))).toEqual(alive);
          const wolves = alive.filter((id) => original.get(id)!.camp === Camp.Wolf),
            villagers = alive.filter((id) => original.get(id)!.role === Role.Villager),
            gods = alive.filter(
              (id) =>
                original.get(id)!.camp === Camp.Good && original.get(id)!.role !== Role.Villager,
            );
          const winner =
            wolves.length === 0
              ? Camp.Good
              : goal === WinCondition.SlaughterCity
                ? Camp.Wolf
                : villagers.length === 0 || gods.length === 0
                  ? Camp.Wolf
                  : null;
          expect(winner).not.toBeNull();
          if (winner === null) throw new Error("demon_world_premature_win");
          if (goal === WinCondition.SlaughterCity && wolves.length)
            expect(villagers.length + gods.length).toBe(0);
          expect(result.result!.winner).toBe(winner);
          const winners = game.playerIds.filter((id) => original.get(id)!.camp === winner);
          expect(result.result!.outcome).toEqual({
            kind: "victory",
            primary: { kind: "faction", faction: winner, winningPlayerIds: winners },
            additional: [],
            winningPlayerIds: winners,
          });
          report.deadWinners += winners.filter((id) => !alive.includes(id)).length;
          report[winner === Camp.Good ? "good" : "wolf"]++;
          report.games++;
        }
        expect(report.choices).toBeGreaterThan(0);
        expect(report.hunts + report.backlash).toBeGreaterThan(0);
        await writeFile(
          `/tmp/awa-p9-demon-world-${size}-${goal}-${locale}.json`,
          JSON.stringify(report),
        );
      }, 180000);
