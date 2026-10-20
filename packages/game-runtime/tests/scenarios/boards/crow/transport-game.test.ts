/**
 * 集成场景测试负责通过真实本地合成LLM/ACP/MCP协议执行完整乌鸦对局及失败前缀。
 * 输入为固定行动脚本、语言及传输组合；字面预期为好人胜、三次私有选择/匿名附加票及明确受众。
 * 真实missing/late失败必须未付款并保严格可复现Tape；测试不访问认证或付费模型。
 */
import { expect, test } from "bun:test";
import { writeFile } from "node:fs/promises";
import { crowScenario } from "../../../support/features/crow/builders/transport-plan";
import { runTransportGame } from "../../../support/drivers/transport/run-game";
for (const transport of ["llm", "acp", "mixed"] as const)
  test(`Crow真实工具传输两语闭环/${transport}`, async () => {
    const scenario = crowScenario();
    for (const locale of ["zh-CN", "en"] as const) {
      const run = await runTransportGame(scenario, transport, locale);
      expect(run.result.snapshot.result?.winner).toBe(scenario.winner);
      expect(run.manifest.players.filter((p) => p.alive).map((p) => p.player_id)).toEqual(
        scenario.alive,
      );
      expect(run.replay.events.filter((e) => e.type === "crow_curse_chosen")).toHaveLength(3);
      expect(run.replay.events.filter((e) => e.type === "crow_curse_applied")).toHaveLength(3);
      for (const view of run.views) {
        const choices = view.timeline.filter(
          (row) => row.kind === "event" && row.event.type === "crow_curse_chosen",
        );
        const bonuses = view.timeline.filter(
          (row) => row.kind === "event" && row.event.type === "crow_curse_applied",
        );
        expect(choices).toHaveLength(view.player_id === scenario.crow ? 3 : 0);
        expect(bonuses.length).toBeGreaterThan(0);
        for (const row of bonuses)
          if (row.kind === "event") expect(Object.hasOwn(row.event.payload, "actorId")).toBe(false);
      }
      expect(run.rejected.size).toBe(0);
      expect(run.acpTraces.every((row) => row.trace.rejected === 0)).toBe(true);
      if (transport === "llm")
        await writeFile(`/tmp/awa-crow-${locale}.replay.json`, JSON.stringify(run.replay));
    }
  }, 120000);

for (const transport of ["llm", "acp"] as const)
  for (const failure of ["missing", "late"] as const)
    test(`Crow真实协议失败前缀与撤权/${transport}/${failure}`, async () => {
      const scenario = crowScenario();
      const turns = scenario.turns.get(scenario.crow)!;
      const first = turns.find((t) => t.stage === "crow_curse")!;
      first.terminalFailure = failure;
      if (failure === "missing") {
        first.action = null;
        if (transport === "llm") {
          const index = turns.indexOf(first);
          turns.splice(index, 1, ...Array.from({ length: 4 }, () => ({ ...first })));
        }
      }
      scenario.expectedFailure = { actorId: scenario.crow, stage: "crow_curse" };
      const run = await runTransportGame(scenario, transport, "en");
      expect(run.record.checkpoints.at(-1)!.complete).toBe(false);
      expect(run.record.events.filter((e) => e.type.startsWith("crow_"))).toEqual([]);
      const state = run.record.checkpoints.at(-1)!.players.find((p) => p.id === scenario.crow)!
        .privateState.crow as { history: unknown[] };
      expect(state.history).toEqual([]);
    }, 120000);
