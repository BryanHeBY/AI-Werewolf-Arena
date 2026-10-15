/**
 * 真实传输纠正场景验证无效寻香配对提交仍可纠正。
 * 输入为字面无效配对参数及合成 SDK／ACP 上后续允许的纠正。
 * 输出与独立预期为精确拒绝次数、被接收的已绑定选择，以及独立的序列化协议前缀断言。
 * 测试不调用付费模型，也不重写预期 fixture／Tape 字节。
 */
import { expect, test } from "bun:test";
import { fragrantTransportScenario } from "../../../support/features/fragrant-pair-seer/builders/transport-plan";
import { assertFragrantTransportWire } from "../../../support/features/fragrant-pair-seer/oracles/wire";
import { runTransportGame } from "../../../support/drivers/transport/run-game";
import type { ToolCall } from "../../../../src/domain";
for (const invalid of ["schema", "domain"] as const)
  for (const kind of ["llm", "acp"] as const)
    test(`Fragrant actual invalid pair then correction ${invalid}/${kind}`, async () => {
      for (const locale of ["zh-CN", "en"] as const) {
        const s = fragrantTransportScenario("expiry"),
          phantom = s.mapping.get(1)!,
          seer = s.mapping.get(9)!,
          turns = new Map(
            [...s.turns].map(([id, ts]) => [
              id,
              ts.map((t) =>
                t.day === 1 && (t.stage === "fragrant_bind" || t.stage === "pair_inspection")
                  ? {
                      ...t,
                      invalidActions: [
                        {
                          name: t.stage === "fragrant_bind" ? "bind_fragrant_pair" : "check_pair",
                          args: {
                            target_ids:
                              invalid === "domain"
                                ? [id, 13]
                                : t.stage === "fragrant_bind"
                                  ? [id, id]
                                  : null,
                          },
                        } as ToolCall,
                      ],
                      expectedInvalidError:
                        invalid === "domain"
                          ? "fragrant_pair_unavailable"
                          : "invalid_tool_arguments",
                    }
                  : t,
              ),
            ]),
          );
        const r = await runTransportGame({ ...s, turns }, kind, locale);
        assertFragrantTransportWire(r);
        expect(
          kind === "llm"
            ? r.rejected.get(phantom)
            : r.acpTraces.find((t) => t.actor === phantom)!.trace.rejected,
        ).toBe(1);
        expect(
          kind === "llm"
            ? r.rejected.get(seer)
            : r.acpTraces.find((t) => t.actor === seer)!.trace.rejected,
        ).toBe(1);
        expect(r.result.snapshot.result?.winner).toBe(s.winner);
        for (const type of ["fragrant_pair_chosen", "fragrant_pair_inspected"])
          expect(
            r.record.events.filter((e) => e.type === type && e.payload.day === 1),
          ).toHaveLength(1);
        expect(r.record.checkpoints[1]!.fragrantPair!.pairSeer.history).toHaveLength(1);
      }
    }, 120000);
