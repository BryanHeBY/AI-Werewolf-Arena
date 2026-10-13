/**
 * Scenario tests for complete order-prince games over real local transports.
 * Input: original fixed scenario actions, transport and language matrices;
 * output: unchanged terminal, player-view and strict reproduction assertions.
 * Literal winners, alive seats and causal facts are the independent oracle.
 * Synthetic local model/ACP processes exercise the wire; no billed model runs.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { expect, test } from "bun:test";
import { orderPrinceScenario } from "../../../support/features/order-prince/builders/transport-plan";
import { runTransportGame } from "../../../support/drivers/transport/run-game";
for (const variant of ["pk"] as const)
  for (const transport of ["llm", "acp"] as const)
    test(
      "Order Prince bilingual real transport/" + variant + "/" + transport,
      async () => {
        const scenario = orderPrinceScenario(variant),
          runs: Awaited<ReturnType<typeof runTransportGame>>[] = [];
        for (const locale of ["zh-CN", "en"] as const) {
          const run = await runTransportGame(scenario, transport, locale);
          runs.push(run);
          expect(run.result.snapshot.result?.winner).toBe(scenario.winner);
          expect(run.manifest.players.filter((p) => p.alive).map((p) => p.player_id)).toEqual(
            scenario.alive,
          );
          expect(
            run.replay.events.filter((e) => e.type === "order_prince_revote_started"),
          ).toHaveLength(1);
          expect(
            run.replay.events.filter((e) => e.type === "order_prince_choice_committed"),
          ).toHaveLength(1);
          for (const view of run.views) {
            const own = view.timeline.filter(
              (row) => row.kind === "event" && row.event.type === "order_prince_choice_committed",
            );
            expect(own).toHaveLength(view.player_id === scenario.prince ? 1 : 0);
          }
          expect(run.rejected.size).toBe(0);
          expect(run.acpTraces.every((row) => row.trace.rejected === 0)).toBe(true);
          if (transport === "llm" && process.env.AWA_ORDER_PRINCE_FIXTURES) {
            const directory = process.env.AWA_ORDER_PRINCE_FIXTURES;
            await mkdir(directory, { recursive: true });
            const base = join(directory, "order-prince-" + variant + "-" + locale);
            await writeFile(base + ".replay.json", JSON.stringify(run.replay, null, 2) + "\n");
            await writeFile(
              base + ".checkpoint.txt",
              JSON.stringify(run.record.checkpoints.at(-1), null, 2) + "\n",
            );
          }
        }
        expect(runs[0]!.result).toEqual(runs[1]!.result);
        expect(runs[0]!.record.checkpoints).toEqual(runs[1]!.record.checkpoints);
      },
      120000,
    );
