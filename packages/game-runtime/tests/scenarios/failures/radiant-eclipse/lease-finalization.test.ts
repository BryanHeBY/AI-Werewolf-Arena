/**
 * 失败场景验证流光／蚀日终结后的 lease 与借用库存事实在受控归档篡改后仍一致。
 * 输入为现有真实预言家失败录制，以及原事件、决定、中止和库存副本改动。
 * 输出与预期为保留生命周期不变量的字面接收／拒绝断言；生产生成归档仅提供测试输入，不是独立计算的预期状态。
 */
import { expect, test } from "bun:test";
import { radiantRecording } from "../../../support/features/radiant-eclipse/drivers/recording";
import { parseReproductionRecord } from "../../../../src/recording/reproduction/format";
async function failed(): Promise<any> {
  return await radiantRecording({ failureStage: "seer" });
}
function removeEvent(r: any, i: number) {
  r.events.splice(i, 1);
  for (const cp of r.checkpoints) if (cp.eventCount > i) cp.eventCount--;
}
function removeDecision(r: any, i: number) {
  const d = r.decisions.splice(i, 1)[0],
    s = d.settleOrder;
  for (const x of r.decisions) {
    if (x.settleOrder > s) x.settleOrder--;
    if (x.openedAfterSettlement >= s) x.openedAfterSettlement--;
  }
}
test("original finalized actual Seer failure remains accepted", async () => {
  const r = await failed();
  expect(() => parseReproductionRecord(r)).not.toThrow();
});
test("finalized failed checkpoint cannot retain active copy and original suppression by deleting abort closure", async () => {
  const r = await failed();
  removeEvent(
    r,
    r.events.findIndex((e: any) => e.type === "eclipse_lease_closed" && e.payload.day === 2),
  );
  const ps = r.checkpoints.at(-1).players;
  ps.find((p: any) => p.id === 1).privateState.abilities["copy:eclipse:night:2"].disabled = false;
  ps.find((p: any) => p.id === 4).privateState.abilities["native:potion"].nightSuppression = {
    policy: "awa_radiant_eclipse_v1",
    day: 2,
  };
  expect(() => parseReproductionRecord(r)).toThrow();
});
test("later Seer failure proves earlier required borrowed potion; cannot double-delete payment and restore stock", async () => {
  const r = await failed();
  removeEvent(
    r,
    r.events.findIndex((e: any) => e.type === "witch_potion_used" && e.payload.actorId === 1),
  );
  removeDecision(
    r,
    r.decisions.findIndex((d: any) => d.day === 2 && d.stage === "witch"),
  );
  const ps = r.checkpoints.at(-1).players,
    b = ps.find((p: any) => p.id === 1).privateState.abilities["copy:eclipse:night:2"];
  b.state.poison = 1;
  b.state.poisonUsedThisNight = false;
  b.uses = 0;
  b.lastUsedDay = null;
  ps.find((p: any) => p.id === 6).marks = ps
    .find((p: any) => p.id === 6)
    .marks.filter((m: string) => m !== "PoisonMark");
  expect(() => parseReproductionRecord(r)).toThrow();
});
test("an unrelated future aborted lease cannot be appended to a finalized failed night", async () => {
  const r = await failed();
  r.events.push({
    timestamp: r.events.at(-1).timestamp + 1,
    type: "eclipse_lease_closed",
    payload: { actorId: 1, day: 99, targetId: null, abilityId: null, status: "aborted" },
    audience: [],
  });
  expect(() => parseReproductionRecord(r)).toThrow();
});
