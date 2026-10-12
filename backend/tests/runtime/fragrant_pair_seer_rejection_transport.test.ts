import { expect, test } from "bun:test";
import { fragrantTransportScenario } from "../support/fragrant_pair_seer_transport_scenarios";
import { assertFragrantTransportWire } from "../support/fragrant_pair_seer_wire_oracle";
import { runTransportGame } from "../support/run_transport_game";
import type { ToolCall } from "../../src/core";
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
