/**
 * 单元测试负责狼爪纯合同的独立字面反例。输入为手写库存／事实，预期为脱离副本及严格拒绝。
 * 不导入后端初始化／资格程序，纯数据不能创造运行授权；额外私有字段、重复单位及错误来历必须失败。
 */
import { expect, test } from "bun:test";
import { readAwakenedClawStateData, readAwakenedClawFact } from "../src/facts/awakened-claws";
const native = () => ({
  policy: "awa_awakened_wolf_king_v1",
  units: [
    { id: "awakened_claw:native:1", source: { kind: "native", index: 1 }, status: "ready" },
    { id: "awakened_claw:native:2", source: { kind: "native", index: 2 }, status: "ready" },
  ],
  bequests: [] as unknown[],
});
test("native units remain separate, transferred unit has one matching committed receipt and output is detached", () => {
  const state = native();
  const copied = readAwakenedClawStateData(state)!;
  expect(copied).toEqual(state);
  expect(copied).not.toBe(state);
  expect(copied.units[0]).not.toBe(state.units[0]);
  state.units[0]!.status = "transferred";
  expect(readAwakenedClawStateData(state)).toBeNull();
  state.bequests.push({ day: 2, targetId: 4, unitId: "awakened_claw:native:1" });
  expect(readAwakenedClawStateData(state)).toEqual(state);
  state.bequests.push({ day: 3, targetId: 5, unitId: "awakened_claw:native:1" });
  expect(readAwakenedClawStateData(state)).toBeNull();
});
test("received unit binds giver/day/native source and rejects an extra native unit or transferred received stock", () => {
  const received = {
    policy: "awa_awakened_wolf_king_v1",
    units: [
      {
        id: "awakened_claw:bequest:2:1:1",
        source: { kind: "bequest", giverId: 2, giverUnitId: "awakened_claw:native:1", day: 1 },
        status: "ready",
      },
    ],
    bequests: [],
  };
  expect(readAwakenedClawStateData(received)).toEqual(received);
  received.units[0]!.status = "transferred";
  expect(readAwakenedClawStateData(received)).toBeNull();
  received.units[0]!.status = "ready";
  received.units[0]!.source.day = 3;
  expect(readAwakenedClawStateData(received)).toBeNull();
  expect(
    readAwakenedClawStateData({ ...native(), units: [native().units[0], received.units[0]] }),
  ).toBeNull();
});
test("facts require precise payload shape and reject identity/source leakage fields", () => {
  const payload = {
    policy: "awa_awakened_wolf_king_v1",
    day: 1,
    actorId: 2,
    unitId: "awakened_claw:native:1",
    targetId: 4,
  };
  expect(readAwakenedClawFact("awakened_claw_spent", payload)).toEqual({
    type: "awakened_claw_spent",
    payload,
  });
  expect(readAwakenedClawFact("awakened_claw_spent", { ...payload, remaining: 1 })).toBeNull();
  expect(readAwakenedClawFact("awakened_claw_spent", { ...payload, targetId: 2 })).toBeNull();
  expect(
    readAwakenedClawFact("awakened_claw_spent", { ...payload, targetId: null }),
  ).not.toBeNull();
  expect(
    readAwakenedClawFact("unknown", {
      get policy() {
        throw new Error("must_not_read");
      },
    }),
  ).toBeNull();
  expect(
    readAwakenedClawFact("awakened_claws_expired", {
      policy: payload.policy,
      day: 1,
      actorId: 2,
      unitIds: [payload.unitId, payload.unitId],
    }),
  ).toBeNull();
});
