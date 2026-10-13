/**
 * Fragrant configuration scenarios verify living and dead Witch night-two stock flags through actual cycles and strict Tape validation.
 * Input: Original literal death/knife/exile plans, controlled role actions and owned recorded metadata from the existing driver.
 * Output and oracle: Handwritten life/stock/reset booleans and forged checkpoint refusal retain original assertions; no expected data is regenerated and source/fixture ownership stays external.
 */
import { recordFragrantLiteral } from "../../support/features/fragrant-pair-seer/drivers/recording";
import { test, expect } from "bun:test";
import { fragrantRuntimeGame as game } from "../../support/features/fragrant-pair-seer/builders/runtime-game";
import { fragrantRuntimeAction as act } from "../../support/features/fragrant-pair-seer/drivers/actions";
import { ReproductionTrace, parseReproductionRecord } from "../../../src/recording/reproduction";
import { captureCheckpoint } from "../../../src/runtime/simulation/reproduction_context";

for (const dead of [false, true])
  test(`${dead ? "dead" : "alive"} witch N2 flags follow original living-only reset`, async () => {
    const metadata = (await recordFragrantLiteral()).record.metadata;
    const g = game(),
      trace = new ReproductionTrace(
        metadata,
        () => {},
        () => g.phaseManager.getEvents(),
      );
    trace.checkpoint(
      captureCheckpoint(
        g.world,
        g.phaseManager.getSnapshot(),
        0,
        true,
        g.phaseManager.getEvents().length,
      ),
      g.phaseManager.getEvents(),
    );
    for (let day = 1; day <= 2; day++) {
      const plan =
        day === 1 ? { poison: 3, knife: dead ? 10 : 5, exile: 4 } : { knife: 6, exile: 2 };
      await g.phaseManager.runSingleCycle(
        {
          getAction: (r) =>
            trace.decide(r, {
              async getAction(q) {
                if (q.allowedTools.includes("check_pair"))
                  return {
                    name: "check_pair",
                    args: {
                      target_ids: [
                        q.context.pair_check_candidates![0]!,
                        q.context.pair_check_candidates![1]!,
                      ] as const,
                    },
                  };
                return act(q, plan);
              },
            }),
        },
        8,
      );
      trace.checkpoint(
        captureCheckpoint(
          g.world,
          g.phaseManager.getSnapshot(),
          day,
          true,
          g.phaseManager.getEvents().length,
        ),
        g.phaseManager.getEvents(),
      );
      const t = trace as any,
        record = {
          schemaVersion: 2,
          finalized: false,
          metadata: t.metadata,
          decisions: t.decisions,
          checkpoints: t.checkpoints,
          events: g.phaseManager.getEvents(),
          operations: [],
          termination: null,
        };
      expect(() => {
        parseReproductionRecord(record);
      }).not.toThrow();
      const w = t.checkpoints.at(-1).players.find((x: any) => x.id === 10),
        p = w.privateState.abilities["native:potion"];
      expect(w.alive).toBe(!dead);
      expect(p.state.poison).toBe(0);
      expect(p.state.poisonUsedThisNight).toBe(day === 1 || dead);
      if (day === 2) {
        const forged = structuredClone(record);
        forged.checkpoints.at(-1).players.find((x: any) => x.id === 10).privateState.abilities[
          "native:potion"
        ].state.poisonUsedThisNight = !dead;
        expect(() => {
          parseReproductionRecord(forged);
        }).toThrow();
      }
    }
  });
