/** 负责典狱长三夜真实SDK／ACP／MCP场景测试与逐玩家秘密验收；本地合成传输不调用付费模型，独立字面计划及真实归档篡改反例由严格Tape与关闭断言核验。 */
import { parseReproductionRecord } from "../../../../src/recording/reproduction/format";
import { validateWardenRecord } from "../../../../src/recording/verification/warden/validate";
import { expect, test } from "bun:test";
import { writeFile } from "node:fs/promises";
import { wardenScenario } from "../../../support/features/warden/builders/transport-plan";
import { runTransportGame } from "../../../support/drivers/transport/run-game";
for (const transport of ["llm", "acp", "mixed"] as const)
  test(`Warden真实完整传输两语/${transport}`, async () => {
    for (const locale of ["zh-CN", "en"] as const) {
      const s = wardenScenario(),
        run = await runTransportGame(s, transport, locale);
      expect(run.result.snapshot.result?.winner).toBe(s.winner);
      expect(run.manifest.players.filter((p) => p.alive).map((p) => p.player_id)).toEqual(s.alive);
      expect(run.record.events.filter((e) => e.type === "warden_pair_chosen")).toHaveLength(2);
      expect(run.record.events.filter((e) => e.type === "warden_decision")).toHaveLength(4);
      expect(
        run.record.events.filter((e) => e.type === "warden_resolved").map((e) => e.payload.outcome),
      ).toEqual(["force", "deal"]);
      for (const view of run.views) {
        const ev = view.timeline.filter((r) => r.kind === "event").map((r) => r.event);
        expect(ev.some((e) => e.type === "warden_resolved")).toBe(false);
        expect(ev.filter((e) => e.type === "warden_pair_chosen")).toHaveLength(
          view.player_id === s.warden ? 2 : 0,
        );
        for (const e of ev.filter((e) => e.type === "warden_decision"))
          expect(e.payload.actorId).toBe(view.player_id);
      }
      // 真实God/Tape来源反例：保公开死亡不变，单改实际Deal来源也必须被本族账本拒绝。
      const changed = structuredClone(run.record);
      const dealOp = changed.operations.find(
        (op) =>
          op.op === "night_damage_resolved" &&
          Object.values(op.output?.death_sources ?? {}).some(
            (v) => Array.isArray(v) && v.includes("deal"),
          ),
      )!;
      const source = dealOp.output!.death_sources as Record<string, string[]>;
      for (const id of Object.keys(source))
        source[id] = source[id]!.map((c) => (c === "deal" ? "wolf_kill" : c));
      expect(() => validateWardenRecord(changed)).toThrow("reproduction_warden_invalid");
      expect(() => parseReproductionRecord(changed)).toThrow();
      const forged = structuredClone(run.record),
        firstOp = forged.operations.find((op) => op.op === "night_damage_resolved")!;
      Object.values(firstOp.output!.death_sources as Record<string, string[]>)[0]!.push("deal");
      expect(() => validateWardenRecord(forged)).toThrow("reproduction_warden_invalid");
      expect(() => parseReproductionRecord(forged)).toThrow();
      // 保留真实双背叛结算，不能把未来许可塞进本夜更早或其他夜的原生请求。
      for (const wrongDay of [false, true]) {
        const past = structuredClone(run.record),
          forced = past.decisions.find(
            (d) => d.stage === "witch" && d.request.context.warden_forced_target !== undefined,
          )!,
          nightStart = past.events.findIndex(
            (e) =>
              e.type === "phase_changed" &&
              e.payload.day === forced.day &&
              e.payload.phase === "night",
          );
        forced.openedAtEventCount = wrongDay ? 0 : nightStart + 1;
        forced.request.context.visible_events = forced.request.context.visible_events.filter(
          (e) => !e.type.startsWith("warden_"),
        );
        expect(() => validateWardenRecord(past)).toThrow("reproduction_warden_invalid");
        expect(() => parseReproductionRecord(past)).toThrow();
      }
      expect(run.rejected.size).toBe(0);
      if (transport === "llm")
        await writeFile(`/tmp/awa-warden-${locale}.replay.json`, JSON.stringify(run.replay));
    }
  }, 120000);
for (const stage of ["warden_pair", "warden_decide"] as const)
  for (const transport of ["llm", "acp"] as const)
    for (const failure of ["missing", "late"] as const)
      test(`Warden真实${stage}/${transport}/${failure}`, async () => {
        const s = wardenScenario(),
          [actor, turns] = [...s.turns].find(([, ts]) =>
            ts.some((t) => t.day === 2 && t.stage === stage),
          )!,
          first = turns.find((t) => t.day === 2 && t.stage === stage)!;
        first.terminalFailure = failure;
        if (stage === "warden_decide" && failure === "missing") first.responseDelayMs = 80;
        if (failure === "missing") {
          first.action = null;
          if (transport === "llm")
            turns.splice(
              turns.indexOf(first),
              1,
              ...Array.from({ length: 4 }, () => ({ ...first })),
            );
        }
        s.expectedFailure = { actorId: actor, stage };
        const run = await runTransportGame(s, transport, "en");
        expect(run.record.checkpoints.at(-1)!.complete).toBe(false);
        const state = run.record.checkpoints.at(-1)!.players.find((p) => p.id === s.warden)!
          .privateState.warden as {
          history: Array<{ pair: unknown; decisions: unknown[]; resolved: boolean }>;
        };
        expect(state.history).toHaveLength(stage === "warden_pair" ? 0 : 1);
        if (stage === "warden_decide") {
          expect(state.history[0]!.resolved).toBe(false);
          expect(state.history[0]!.decisions).toHaveLength(1);
        }
        expect(run.record.events.some((e) => e.type === "warden_resolved")).toBe(false);
      }, 120000);
