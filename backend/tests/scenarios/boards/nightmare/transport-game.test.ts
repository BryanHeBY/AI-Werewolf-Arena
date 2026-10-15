/**
 * 场景测试通过真实本地传输执行完整噩梦之影对局。
 * 输入为原固定场景行动、传输和语言矩阵；输出保留原终局、玩家视图及严格复现断言。
 * 字面胜方、存活席位和因果事实构成独立预期。
 * 合成本地模型／ACP 进程实际走协议传输，不运行付费模型。
 */
import { writeFile } from "node:fs/promises";
import { expect, test } from "bun:test";
import { nightmareScenario } from "../../../support/features/nightmare-shadow/builders/transport-plan";
import { runTransportGame } from "../../../support/drivers/transport/run-game";
for (const transport of ["llm", "acp", "mixed"] as const)
  test(`nightmare bilingual real transport and private fear exports/${transport}`, async () => {
    const scenario = nightmareScenario(),
      runs: Awaited<ReturnType<typeof runTransportGame>>[] = [];
    for (const locale of ["zh-CN", "en"] as const) {
      const run = await runTransportGame(scenario, transport, locale);
      runs.push(run);
      if (transport === "llm")
        await writeFile(
          "/tmp/awa-nightmare-" + locale + ".replay.json",
          JSON.stringify(run.replay),
        );
      expect(run.result.snapshot.result?.winner).toBe(scenario.winner);
      expect(run.manifest.players.filter((p) => p.alive).map((p) => p.player_id)).toEqual(
        scenario.alive,
      );
      expect(run.replay.events.filter((e) => e.type === "nightmare_fear_committed")).toHaveLength(
        2,
      );
      expect(run.replay.events.filter((e) => e.type === "seer_checked")).toHaveLength(1);
      for (const view of run.views) {
        const fears = view.timeline.filter(
          (row) => row.kind === "event" && row.event.type === "nightmare_fear_committed",
        );
        expect(fears).toHaveLength(view.player_id === scenario.nightmare ? 2 : 0);
        for (const row of fears)
          if (row.kind === "event") {
            expect(Object.keys(row.event.payload).sort()).toEqual(["day", "targetId"]);
          }
      }
      expect(run.rejected.size).toBe(0);
      expect(run.acpTraces.every((row) => row.trace.rejected === 0)).toBe(true);
      expect(run.replay.events.filter((e) => e.type === "game_over")).toHaveLength(1);
    }
    expect(runs[0].result).toEqual(runs[1].result);
    expect(runs[0].record.checkpoints).toEqual(runs[1].record.checkpoints);
  }, 120000);
