/**
 * 场景测试通过真实本地传输执行完整诡术师对局。
 * 输入为原固定场景行动、传输和语言矩阵；输出保留原终局、玩家视图及严格复现断言。
 * 字面胜方、存活席位和因果事实构成独立预期。
 * 合成本地模型／ACP 进程实际走协议传输，不运行付费模型。
 */
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { expect, test } from "bun:test";
import { tricksterScenario } from "../../../support/features/trickster/builders/transport-plan";
import { runTransportGame } from "../../../support/drivers/transport/run-game";
for (const variant of ["mapped", "cancel", "pk"] as const)
  for (const transport of ["llm", "acp", "mixed"] as const)
    test(
      "Trickster bilingual real transport/" + variant + "/" + transport,
      async () => {
        const scenario = tricksterScenario(variant),
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
          const mappings = run.replay.events.filter((e) => e.type === "exile_target_mapped");
          expect(mappings).toHaveLength(4);
          expect(mappings[1]!.payload.missed).toBe(true);
          const first = mappings[0]!;
          expect(first.payload.requestedId === first.payload.effectiveId).toBe(
            variant === "cancel",
          );
          expect(
            run.replay.events.findIndex((e) => e.type === "order_prince_revote_started"),
          ).toBeLessThan(run.replay.events.indexOf(first));
          for (const view of run.views) {
            const choices = view.timeline.filter(
              (row) => row.kind === "event" && row.event.type === "trickster_exchange_committed",
            );
            expect(choices).toHaveLength(view.player_id === scenario.trickster ? 3 : 0);
          }
          expect(run.rejected.size).toBe(0);
          expect(run.acpTraces.every((row) => row.trace.rejected === 0)).toBe(true);
          if (transport === "llm" && process.env.AWA_TRICKSTER_FIXTURES) {
            const directory = process.env.AWA_TRICKSTER_FIXTURES;
            await mkdir(directory, { recursive: true });
            const base = join(directory, "trickster-" + variant + "-" + locale);
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
