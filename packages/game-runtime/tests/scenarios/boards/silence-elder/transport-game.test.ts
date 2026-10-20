/**
 * 负责禁言原板在本地真实SDK／ACP／MCP传输的整局场景测试。输入为固定三夜手写计划，
 * 以字面胜方、存活表、公开动作和逐玩家私密事实断言正常局及失败前缀；不调用付费模型。
 * 通路驱动同时核资源关闭和严格Tape；失败时不把缺失解释为弃权，不撤销已公开手势。
 */
import { expect, test } from "bun:test";
import { writeFile } from "node:fs/promises";
import { silenceElderScenario } from "../../../support/features/silence-elder/builders/transport-plan";
import { runTransportGame } from "../../../support/drivers/transport/run-game";

for (const transport of ["llm", "acp", "mixed"] as const)
  test(`Silence完整真实传输两语及受众/${transport}`, async () => {
    for (const locale of ["zh-CN", "en"] as const) {
      const scenario = silenceElderScenario();
      const run = await runTransportGame(scenario, transport, locale);
      expect(run.result.snapshot.result?.winner).toBe(scenario.winner);
      expect(run.manifest.players.filter((p) => p.alive).map((p) => p.player_id)).toEqual(
        scenario.alive,
      );
      const events = run.replay.events;
      expect(events.filter((e) => e.type === "silence_chosen")).toHaveLength(3);
      expect(events.filter((e) => e.type === "silence_announced")).toHaveLength(3);
      expect(events.filter((e) => e.type === "silence_gesture")).toHaveLength(3);
      expect(events.filter((e) => e.type === "silence_translated")).toHaveLength(2);
      expect(events.filter((e) => e.type === "silence_translation_declined")).toHaveLength(1);
      expect(events.filter((e) => e.type === "silence_expired")).toHaveLength(3);
      const declined = events.find((e) => e.type === "silence_translation_declined")!;
      for (const view of run.views) {
        const types = view.timeline
          .filter((row) => row.kind === "event")
          .map((row) => row.event.type);
        expect(types.filter((t) => t === "silence_chosen")).toHaveLength(
          view.player_id === scenario.elder ? 3 : 0,
        );
        expect(types.filter((t) => t === "silence_announced")).toHaveLength(3);
        expect(types.filter((t) => t === "silence_translation_declined")).toHaveLength(
          view.player_id === declined.payload.actorId ? 1 : 0,
        );
        expect(types).not.toContain("silence_expired");
      }
      expect(run.rejected.size).toBe(0);
      expect(run.acpTraces.every((r) => r.trace.rejected === 0)).toBe(true);
      if (transport === "llm")
        await writeFile(`/tmp/awa-silence-elder-${locale}.replay.json`, JSON.stringify(run.replay));
    }
  }, 120000);

for (const stage of ["silence_elder", "silence_gesture", "silence_translation"] as const)
  for (const transport of ["llm", "acp"] as const)
    for (const failure of ["missing", "late"] as const)
      test(`Silence真实${stage}/${transport}/${failure}保准确前缀`, async () => {
        const scenario = silenceElderScenario();
        const entry = [...scenario.turns].find(([, turns]) =>
          turns.some((t) => t.day === 1 && t.stage === stage),
        )!;
        const [actorId, turns] = entry;
        const first = turns.find((t) => t.day === 1 && t.stage === stage)!;
        first.terminalFailure = failure;
        if (failure === "missing") {
          first.action = null;
          if (transport === "llm")
            turns.splice(
              turns.indexOf(first),
              1,
              ...Array.from({ length: 4 }, () => ({ ...first })),
            );
        }
        scenario.expectedFailure = { actorId, stage };
        const run = await runTransportGame(scenario, transport, "en");
        expect(run.record.checkpoints.at(-1)!.complete).toBe(false);
        const types = run.record.events.map((e) => e.type);
        expect(types.filter((t) => t === "silence_chosen")).toHaveLength(
          stage === "silence_elder" ? 0 : 1,
        );
        expect(types.filter((t) => t === "silence_gesture")).toHaveLength(
          stage === "silence_translation" ? 1 : 0,
        );
        expect(types).not.toContain("silence_translated");
        expect(types).not.toContain("silence_translation_declined");
      }, 120000);
