/**
 * 失败场景验证流光／蚀日增量 checkpoint 在真实周期失败后仍保留已完成清理。
 * 输入为录制的预言家失败周期及原 checkpoint／lease 副本篡改。
 * 输出与预期通过明确解析接收／拒绝区分已完成清理和伪造活跃 lease；生成的记录是输入，不是独立预期状态。
 */
import { expect, test } from "bun:test";
import { radiantRecording } from "../../../support/features/radiant-eclipse/drivers/recording";
import { parseReproductionRecord } from "../../../../src/recording/reproduction/format";
async function checkpointedFailure(): Promise<any> {
  const r = await radiantRecording({ failureStage: "seer" });
  r.finalized = false;
  r.termination = null;
  r.operations = [];
  return r;
}
test("actual failed cycle checkpoint before finalization retains its completed cleanup", async () => {
  const r = await checkpointedFailure();
  expect(() => parseReproductionRecord(r)).not.toThrow();
});
test("already failed cycle checkpoint cannot retain active lease merely because file is incremental", async () => {
  const r = await checkpointedFailure();
  const i = r.events.findIndex(
    (e: any) => e.type === "eclipse_lease_closed" && e.payload.day === 2,
  );
  r.events.splice(i, 1);
  for (const cp of r.checkpoints) if (cp.eventCount > i) cp.eventCount--;
  const ps = r.checkpoints.at(-1).players;
  ps.find((p: any) => p.id === 1).privateState.abilities["copy:eclipse:night:2"].disabled = false;
  ps.find((p: any) => p.id === 4).privateState.abilities["native:potion"].nightSuppression = {
    policy: "awa_radiant_eclipse_v1",
    day: 2,
  };
  let accepted = false;
  try {
    parseReproductionRecord(r);
    accepted = true;
  } catch {}
  expect(accepted).toBe(false);
});
