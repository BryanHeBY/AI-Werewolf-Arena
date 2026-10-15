/**
 * 场景测试通过真实本地传输执行完整赤月对局。
 * 输入为原受控行动计划及传输／语言矩阵；输出保留终局、玩家视图及严格复现对照。
 * 胜方／存活预期来自驱动对生产逻辑的预演，属于一致性检查，不是独立规则预期。
 * 字面事件次数和拒绝断言仍为另行手写检查；合成本地模型／ACP 进程实际走协议，不调用付费模型。
 */
import { expect, test } from "bun:test";
import { redMoonScenario } from "../../../support/features/red-moon-apostle/drivers/transport-plan";
import { runTransportGame } from "../../../support/drivers/transport/run-game";
for (const mode of ["expire", "knife", "blast"] as const)
  for (const transport of ["llm", "acp", "mixed"] as const)
    test(
      "Red Moon true transport " + mode + "/" + transport,
      async () => {
        const scenario = await redMoonScenario(mode);
        for (const locale of ["zh-CN", "en"] as const) {
          const run = await runTransportGame(scenario, transport, locale);
          if (transport === "llm" && process.env.AWA_RED_MOON_FIXTURE_DIR) {
            const base = process.env.AWA_RED_MOON_FIXTURE_DIR + "/red-moon-" + mode + "-" + locale;
            await Bun.write(base + ".replay.json", JSON.stringify(run.replay, null, 2) + "\n");
            await Bun.write(
              base + ".checkpoint.txt",
              JSON.stringify(run.record.checkpoints.at(-1), null, 2) + "\n",
            );
          }

          expect(run.result.snapshot.result?.winner).toBe(scenario.winner);
          expect(run.manifest.players.filter((p) => p.alive).map((p) => p.player_id)).toEqual(
            scenario.alive,
          );
          expect(run.replay.events.filter((e) => e.type === "red_moon_night_sealed")).toHaveLength(
            mode === "blast" ? 1 : 0,
          );
          expect(run.replay.events.filter((e) => e.type === "red_moon_exile_delayed")).toHaveLength(
            mode === "blast" ? 0 : 1,
          );
          expect(run.replay.events.filter((e) => e.type === "red_moon_delay_expired")).toHaveLength(
            mode === "expire" ? 1 : 0,
          );
          expect(run.rejected.size).toBe(0);
          expect(run.acpTraces.every((row) => row.trace.rejected === 0)).toBe(true);
        }
      },
      180000,
    );
