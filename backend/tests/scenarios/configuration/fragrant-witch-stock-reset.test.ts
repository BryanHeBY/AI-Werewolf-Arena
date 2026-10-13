/**
 * 负责场景测试：馥郁板子中存活／死亡女巫第二夜库存标记的真实周期与严格 Tape 校验。
 * 输入为原死亡／狼刀／放逐计划、受控角色行动及驱动持有的录制元数据；输出由手写生命、库存、重置布尔值与伪造拒绝核对。
 * 保留原断言，不重新生成预期；来源和 fixture 仍由外部原驱动拥有。
 */
import { recordFragrantLiteral } from "../../support/features/fragrant-pair-seer/drivers/recording";
import { test, expect } from "bun:test";
import { fragrantRuntimeGame as game } from "../../support/features/fragrant-pair-seer/builders/runtime-game";
import { fragrantRuntimeAction as act } from "../../support/features/fragrant-pair-seer/drivers/actions";
import { parseReproductionRecord } from "../../../src/recording/reproduction";
import { ReproductionTrace } from "../../../src/recording/reproduction-trace";
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
