/**
 * 失败场景验证流光／蚀日 pending 轨迹使用此前完整 checkpoint 及当前未归档请求。
 * 输入为真实预言家失败录制，以及原增量／已终结记录中的终端请求篡改。
 * 输出与预期为明确的解析接收／拒绝，保留 pending 与 finalized 区别，不将原记录重写为新固定预期。
 */
import { expect, test } from "bun:test";
import { radiantRecording } from "../../../support/features/radiant-eclipse/drivers/recording";
import { parseReproductionRecord } from "../../../../src/recording/reproduction/format";
async function failed(): Promise<any> {
  return await radiantRecording({ failureStage: "seer" });
}
test("legitimate pending Trace uses only previous complete checkpoint and current unarchived requests", async () => {
  const r = await failed();
  r.finalized = false;
  r.termination = null;
  r.operations = [];
  r.checkpoints.pop();
  r.events = r.events.slice(0, r.checkpoints.at(-1).eventCount);
  // 前缀同时保留同一事件游标内的原事实；后续事实不能越过已截短的事件流。
  if (r.facts)
    r.facts = r.facts.filter((fact: { afterSeq: number }) => fact.afterSeq <= r.events.length);
  r.decisions.at(-1).outcome = { kind: "pending" };
  delete r.decisions.at(-1).settleOrder;
  // Tape3 的 false-close 候选属于终态 error；这里构造尚未结算的前缀，须移除这份返回证据。
  delete r.decisions.at(-1).returnedCandidate;
  expect(() => parseReproductionRecord(r)).not.toThrow();
});
test("a finalized failed archive cannot still contain a pending terminal request", async () => {
  const r = await failed();
  r.decisions.at(-1).outcome = { kind: "pending" };
  delete r.decisions.at(-1).settleOrder;
  // 先保持 pending 的合法字段形状，再核 finalized 的原矛盾，不能让残留候选提前在 schema 层拒绝。
  delete r.decisions.at(-1).returnedCandidate;
  let accepted = false;
  try {
    parseReproductionRecord(r);
    accepted = true;
  } catch {}
  expect(accepted).toBe(false);
});
