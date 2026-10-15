/**
 * 场景测试通过真实本地传输执行完整狼术师对局。
 * 输入为原固定场景行动、传输和语言矩阵；输出保留原终局、玩家视图及严格复现断言。
 * 字面胜方、存活席位和因果事实构成独立预期。
 * 合成本地模型／ACP 进程实际走协议传输，不运行付费模型。
 */
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { expect, test } from "bun:test";
import { wolfSorcererScenario } from "../../../support/features/wolf-sorcerer/builders/transport-plan";
import { runTransportGame } from "../../../support/drivers/transport/run-game";
for (const variant of ["overlap", "cancel", "disjoint"] as const)
  for (const transport of ["llm", "acp", "mixed"] as const)
    test(
      "Wolf Sorcerer bilingual real transport/" + variant + "/" + transport,
      async () => {
        const scenario = wolfSorcererScenario(variant),
          runs: Awaited<ReturnType<typeof runTransportGame>>[] = [];
        for (const locale of ["zh-CN", "en"] as const) {
          const run = await runTransportGame(scenario, transport, locale);
          runs.push(run);
          expect(run.result.snapshot.result?.winner).toBe(scenario.winner);
          expect(run.manifest.players.filter((p) => p.alive).map((p) => p.player_id)).toEqual(
            scenario.alive,
          );
          const choices = run.replay.events.filter(
            (e) => e.type === "wolf_sorcerer_exchange_committed",
          );
          expect(choices).toHaveLength(1);
          expect(choices[0]!.payload.day).toBe(2);
          const inspection = run.replay.events.find(
            (e) => e.type === "role_inspected" && e.payload.day === 2,
          );
          expect(inspection?.payload.targetId).toBe(scenario.hunter);
          expect(inspection?.payload.result).toEqual({
            kind: "role",
            role: scenario.inspectionRole,
          });
          const gun = run.replay.events.filter((e) => e.type === "hunter_shot");
          expect(gun).toHaveLength(1);
          expect(gun[0]!.payload.targetId).toBe(scenario.wolfTarget);
          for (const view of run.views) {
            const privateChoices = view.timeline.filter(
              (row) =>
                row.kind === "event" && row.event.type === "wolf_sorcerer_exchange_committed",
            );
            expect(privateChoices).toHaveLength(view.player_id === scenario.sorcerer ? 1 : 0);
            const skips = view.timeline.filter(
              (row) => row.kind === "event" && row.event.type === "wolf_sorcerer_exchange_skipped",
            );
            expect(skips).toHaveLength(view.player_id === scenario.sorcerer ? 1 : 0);
          }
          expect(run.rejected.size).toBe(0);
          expect(run.acpTraces.every((row) => row.trace.rejected === 0)).toBe(true);
          if (transport === "llm" && process.env.AWA_WOLF_SORCERER_FIXTURES) {
            const directory = process.env.AWA_WOLF_SORCERER_FIXTURES;
            await mkdir(directory, { recursive: true });
            const base = join(directory, "wolf-sorcerer-" + variant + "-" + locale);
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
