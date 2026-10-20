/**
 * 复现场景验证猎魔人录制对局保留原生毒免、猎杀及枪击结果，以及严格猎杀失败前缀。
 * 输入为原人数、胜利策略、传输、语言和缺失／迟到回复矩阵，并带声明场景事实。
 * 输出与预期为明确私有历史、允许受众、存活者／胜方及未付失败猎杀断言，绑定完整或中断对局；不混入孤立 reader 用例。
 */
import { expect, test } from "bun:test";
import { promises as fs } from "node:fs";
import { WinCondition } from "../../../../src/domain";
import {
  demonHunterTransportScenario,
  demonHunterFailureScenario,
} from "../../../support/features/demon-hunter/builders/transport-plan";
import { runTransportGame } from "../../../support/drivers/transport/run-game";
for (const size of [6, 12] as const)
  for (const goal of [WinCondition.SlaughterCity, WinCondition.SlaughterSide])
    for (const transport of ["llm", "acp", "mixed"] as const)
      test(`${size}/${goal}/${transport}: actual bilingual native toxin immunity, hunt, gun and full strict Tape`, async () => {
        for (const locale of ["zh-CN", "en"] as const) {
          const scenario = demonHunterTransportScenario(size, goal),
            run = await runTransportGame(scenario, transport, locale),
            record = run.record;
          expect(record.checkpoints.at(-1)!.snapshot.result!.winner).toBe(scenario.winner);
          expect(
            record.checkpoints
              .at(-1)!
              .players.filter((p) => p.alive)
              .map((p) => p.id),
          ).toEqual(scenario.alive);
          expect(record.events.filter((e) => e.type === "demon_hunter_chosen")).toHaveLength(1);
          expect(record.events.filter((e) => e.type === "demon_hunter_poison_immune")).toHaveLength(
            1,
          );
          for (const view of run.views) {
            const own = view.timeline.filter(
              (entry) => entry.kind === "event" && entry.event.type.startsWith("demon_hunter_"),
            );
            if (view.player_id !== scenario.demonId) expect(own).toEqual([]);
            else
              expect(
                own.every(
                  (entry) =>
                    entry.kind === "event" &&
                    entry.event.type === "demon_hunter_chosen" &&
                    !Object.hasOwn(entry.event.payload, "actorId"),
                ),
              ).toBe(true);
          }
          if (transport === "llm") {
            const key = `/tmp/awa-p9-demon-${size}-${goal}-${locale}`;
            await fs.writeFile(`${key}.record.json`, JSON.stringify(record));
            await fs.writeFile(`${key}.replay.json`, JSON.stringify(run.replay));
            await fs.writeFile(
              `${key}.player.json`,
              JSON.stringify(run.views.find((v) => v.player_id === scenario.demonId)),
            );
          }
        }
      }, 120000);

for (const size of [6, 12] as const)
  for (const transport of ["llm", "acp"] as const)
    for (const failure of ["missing", "late"] as const)
      test(`${size}/${transport}/${failure}: real bilingual transport failure keeps original CP and no hunt commit`, async () => {
        for (const locale of ["zh-CN", "en"] as const) {
          const scenario = demonHunterFailureScenario(size, WinCondition.SlaughterCity, failure),
            run = await runTransportGame(scenario, transport, locale);
          expect(run.record.events.some((e) => e.type === "demon_hunter_chosen")).toBe(false);
          expect(
            run.record.checkpoints.at(-1)!.players.find((p) => p.id === scenario.demonId)!
              .privateState.demonHunter,
          ).toEqual({ policy: "awa_netease_demon_hunter_v1", history: [] });
        }
      }, 120000);
