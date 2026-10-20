/**
 * 复现场景验证流光／蚀日 pending 或刚结算前缀仍可结合此前完整 checkpoint 序列化。
 * 输入为原顶层 await 创建的完整录制，以及精确日次／阶段／pending 前缀矩阵。
 * 输出与预期为明确完整／前缀解析接收，保留来源截断位置和 setup 求值时点；不重新生成冻结归档或预期行动。
 */
import { expect, test } from "bun:test";
import { radiantRecording } from "../../../support/features/radiant-eclipse/drivers/recording";
import {
  parseReproductionRecord,
  type ReproductionRecord,
} from "../../../../src/recording/reproduction/format";
const full: ReproductionRecord = await radiantRecording();
function prefix(day: number, stage: string, pending: boolean) {
  const r = structuredClone(full),
    cut = r.decisions.findIndex((d) => d.day === day && d.stage === stage);
  expect(cut).toBeGreaterThanOrEqual(0);
  r.decisions = r.decisions.slice(0, cut + 1);
  if (pending) {
    r.decisions.at(-1)!.outcome = { kind: "pending" };
    delete r.decisions.at(-1)!.settleOrder;
  }
  r.finalized = false;
  r.termination = null;
  r.checkpoints = r.checkpoints.filter((c) => c.cycle < day);
  r.events = r.events.slice(0, r.checkpoints.at(-1)!.eventCount);
  // 事件前缀只能携带游标以内的事实，原 seq 与完整死亡覆盖声明继续保留。
  if (r.facts) r.facts = r.facts.filter((fact) => fact.afterSeq <= r.events.length);
  r.operations = [];
  return r;
}
for (const [day, stage, pending] of [
  [1, "dreamer", true],
  [1, "dreamer", false],
  [1, "wolf_discussion", true],
  [1, "witch", true],
  [2, "dreamer", false],
  [2, "wolf_discussion", true],
] as const)
  test(`real N${day} ${stage} ${pending ? "pending" : "just settled"} prefix with prior checkpoint remains serializable`, () => {
    expect(() => {
      parseReproductionRecord(full);
    }).not.toThrow();
    const p = prefix(day, stage, pending);
    expect(() => {
      parseReproductionRecord(p);
    }).not.toThrow();
  });
