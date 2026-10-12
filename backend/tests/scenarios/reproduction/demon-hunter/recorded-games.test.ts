/**
 * Reproduction scenarios verify Demon Hunter recorded games preserve native toxin immunity, hunt and gun results plus strict hunt-failure prefixes.
 * Input: Original board-size, victory-policy, transport, locale and missing/late response matrices with declared scenario facts.
 * Output and oracle: Explicit private history, allowed audience, survivor/winner and unpaid failed-hunt assertions stay attached to full or interrupted games; no isolated reader case is folded into this suite.
 */
import { expect, test } from "bun:test";
import { promises as fs } from "node:fs";
import { WinCondition } from "../../../../src/core";
import {
  demonHunterTransportScenario,
  demonHunterFailureScenario,
} from "../../../support/demon_hunter_transport_scenarios";
import { runTransportGame } from "../../../support/run_transport_game";
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
