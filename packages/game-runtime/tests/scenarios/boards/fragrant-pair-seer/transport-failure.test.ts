/**
 * 真实传输失败场景验证寻香必需绑定／查验的交付失败。
 * 输入为合成 SDK／ACP 传输及明确的必需阶段失败计划。
 * 原未消耗／已付前缀与协议字面约束构成独立预期，不补造领域事实；严格重放另核对本局录制一致性。
 * 测试不调用付费模型，也不重写预期 fixture／Tape 字节。
 */
import { assertFragrantTransportWire } from "../../../support/features/fragrant-pair-seer/oracles/wire";
import { expect, test } from "bun:test";
import { fragrantTransportScenario } from "../../../support/features/fragrant-pair-seer/builders/transport-plan";
import { runTransportGame } from "../../../support/drivers/transport/run-game";
const rank: Record<string, number> = {
  fragrant_bind: 150,
  wolf_discussion: 200,
  guard: 300,
  wolf_vote: 400,
  witch: 500,
  pair_inspection: 600,
};
for (const [stage, old] of [
  ["fragrant_bind", 1],
  ["pair_inspection", 9],
  ["wolf_discussion", 2],
  ["wolf_vote", 2],
] as const)
  for (const mode of ["missing", "late"] as const)
    for (const kind of ["llm", "acp"] as const)
      test(`Fragrant required ${stage}/${mode}/${kind}`, async () => {
        for (const locale of ["zh-CN", "en"] as const) {
          const s = fragrantTransportScenario("first_link"),
            actorId = s.mapping.get(old)!,
            turns = new Map(
              [...s.turns].map(([id, ts]) => [
                id,
                ts
                  .filter((t) => t.day === 1 && (rank[t.stage] ?? 1000) <= rank[stage]!)
                  .map((t) =>
                    id === actorId && t.stage === stage
                      ? { ...t, terminalFailure: mode, action: mode === "late" ? t.action : null }
                      : t,
                  ),
              ]),
            );
          const r = await runTransportGame(
              { ...s, turns, expectedFailure: { actorId, stage } },
              kind,
              locale,
            ),
            cp = r.record.checkpoints.at(-1)!;
          assertFragrantTransportWire(r);
          expect(cp.complete).toBe(false);
          expect(cp.fragrantPair!.nights[0]!.status).toBe("aborted");
          expect(cp.fragrantPair!.fragrant.trigger).toBeNull();
          expect(r.record.events.some((e) => e.type === "night_resolved")).toBe(false);
          expect(cp.players.every((p) => p.alive)).toBe(true);
          expect(r.diagnostics.pendingDelays).toBe(0);
        }
      }, 120000);
