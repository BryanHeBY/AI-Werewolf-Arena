/**
 * 复现场景验证流光／蚀日完整及 pending 请求前缀保留私有知识和此前结算许可。
 * 输入为原顶层 await 创建的完整录制、pending 前缀副本及具名原始／行动／来源历史伪造。
 * 输出与预期为明确基线接收和精确拒绝码，保留共享对局设置及原请求顺序；生成记录仍是输入，不是新的规则固定预期。
 */
import { expect, test } from "bun:test";
import { radiantRecording } from "../../../support/features/radiant-eclipse/drivers/recording";
import {
  parseReproductionRecord,
  type ReproductionRecord,
} from "../../../../src/recording/reproduction/format";
const full: ReproductionRecord = await radiantRecording();
function clone() {
  return structuredClone(full);
}
function pending() {
  const r = clone(),
    cut = r.decisions.findIndex((d) => d.day === 2 && d.stage === "witch");
  r.decisions = r.decisions.slice(0, cut + 1);
  r.decisions.at(-1)!.outcome = { kind: "pending" };
  delete r.decisions.at(-1)!.settleOrder;
  r.finalized = false;
  r.termination = null;
  r.checkpoints = r.checkpoints.filter((c) => c.cycle <= 1);
  r.events = r.events.slice(0, r.checkpoints.at(-1)!.eventCount);
  // 只截断事件会残留后续事实，掩盖本用例真正要审核的请求许可与私有知识边界。
  if (r.facts) r.facts = r.facts.filter((fact) => fact.afterSeq <= r.events.length);
  r.operations = [];
  return r;
}
function rejection(
  name: string,
  seed: () => ReproductionRecord,
  mutate: (r: ReproductionRecord) => void,
) {
  test(name, () => {
    const r = seed();
    expect(() => parseReproductionRecord(r)).not.toThrow();
    mutate(r);
    expect(() => parseReproductionRecord(r)).toThrow("reproduction_radiant_eclipse_invalid");
  });
}
test("actual finalized four-night and legitimate copied-Witch pending baselines pass", () => {
  expect(() => parseReproductionRecord(full)).not.toThrow();
  expect(() => parseReproductionRecord(pending())).not.toThrow();
});
rejection("full: unrelated Seer request may not carry private wolf_target", clone, (r) => {
  r.decisions.find((d) => d.day === 2 && d.stage === "seer")!.request.context.wolf_target = 8;
});
rejection("full: exact swallow raw JSON forbids unrecognized properties", clone, (r) => {
  const d = r.decisions.find((d) => d.day === 2 && d.stage === "eclipse_swallow")!;
  if (d.outcome.kind === "action" && d.outcome.action)
    (d.outcome.action.args as any).secret = "CANARY_RAW_EXTRA_14967";
});
rejection("full: downstream shelter may not open before swallow settles", clone, (r) => {
  r.decisions.find((d) => d.day === 2 && d.stage === "radiant_shelter")!.openedAfterSettlement = 0;
});
rejection(
  "pending: a settled predecessor with an illegal dream target cannot authorize a later Witch",
  pending,
  (r) => {
    const d = r.decisions.find((d) => d.day === 2 && d.stage === "dreamer")!;
    if (d.outcome.kind === "action" && d.outcome.action)
      (d.outcome.action.args as any).target_id = d.actorId;
  },
);
rejection("pending: a pending shelter predecessor cannot authorize a later Witch", pending, (r) => {
  const d = r.decisions.find((d) => d.day === 2 && d.stage === "radiant_shelter")!;
  d.outcome = { kind: "pending" };
  delete d.settleOrder;
});
rejection("pending: a failed shelter predecessor cannot authorize a later Witch", pending, (r) => {
  r.decisions.find((d) => d.day === 2 && d.stage === "radiant_shelter")!.outcome = {
    kind: "error",
    code: "decision_failed",
    name: "Error",
  };
});
rejection(
  "pending: removing the mandatory shelter opportunity cannot leave successors",
  pending,
  (r) => {
    r.decisions = r.decisions.filter((d) => !(d.day === 2 && d.stage === "radiant_shelter"));
  },
);
rejection(
  "pending: existing borrowed grant DTO forbids source-history canary fields",
  pending,
  (r) => {
    const e = r.decisions
      .at(-1)!
      .request.context.visible_events.find((e) => e.type === "ability_changed")!;
    (e.payload as any).originalHistory = "CANARY_ORIGINAL_HISTORY_81234";
  },
);
rejection("pending: a potion borrower cannot see an invented own Seer result", pending, (r) => {
  const v = r.decisions.at(-1)!.request.context.visible_events;
  v.push({
    seq: v.length + 1,
    type: "seer_checked",
    payload: {
      actorId: 1,
      targetId: 12,
      isWerewolf: true,
      result: { kind: "camp", camp: "wolf" },
      canary: "CANARY_UNEARNED_RESULT_84931",
    },
  } as any);
});
rejection(
  "pending: future game_over fact cannot be appended to an unfinished Witch view",
  pending,
  (r) => {
    const v = r.decisions.at(-1)!.request.context.visible_events;
    v.push({
      seq: v.length + 1,
      type: "game_over",
      payload: { winner: "good", reason: "CANARY_FUTURE_WINNER_66183" },
    } as any);
  },
);
rejection("full: wrong borrowed ability ID remains rejected", clone, (r) => {
  r.decisions.find((d) => d.day === 2 && d.stage === "witch")!.request.context.ability_id =
    "native:potion";
});
