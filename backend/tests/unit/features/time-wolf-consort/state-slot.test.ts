/**
 * 单元测试验证蚀时狼妃状态槽的原初始化、历史写入失败前缀和身份编码晚读取。
 * 输入为测试自有容器、getter／setter 与临时内建函数读取钩子；字面轨迹、原错误、
 * 数据引用和知识延迟是预期，不从生产算法生成 golden，不执行完整夜、模型或档案。
 * 槽写者只核原数据操作，回执 used／生命／原体和效果许可仍由 frame 在原时点复验。
 */
import { expect, test } from "bun:test";
import type { TimeConsortReadState, TimeConsortState } from "@ai-werewolf-arena/game-contract";
import { Camp, type RoleComponent } from "../../../../src/domain";
import { TIME_CONSORT_STATE_SLOT as SLOT } from "../../../../src/features/time-wolf-consort/state-slot";

// worldless 数据样本只持显式 Camp 句柄，不建立 Role→World／Camp 回退。
const fixtureCamp = { camp: Camp.Wolf };
const currentCamp = () => fixtureCamp;

test("slot initialization preserves container, scope, creation and throwing setter order", () => {
  const trace: string[] = [], fault = new Error("time_slot_setter_failure");
  let observed: unknown;
  const container = Object.defineProperty({}, "timeConsort", {
    set(value: unknown) { trace.push("setter"); observed = value; throw fault; },
  });
  expect(() => SLOT.install(() => (trace.push("container"), container), {
    get reflectionScope(): "first_effect" { trace.push("scope"); return "first_effect"; },
  })).toThrow(fault);
  expect(trace).toEqual(["container", "scope", "setter"]);
  expect(observed).toEqual({ policy: "awa_time_consort_reflection_v1", reflectionScope: "first_effect", history: [], triggeredDay: null });
  trace.length = 0;
  expect(() => SLOT.install(() => (trace.push("container"), container), {
    get reflectionScope(): "whole_night" { trace.push("scope"); throw fault; },
  })).toThrow(fault);
  expect(trace).toEqual(["container", "scope"]);
});

test("history writer looks up defineProperty before both state/history reads and preserves its descriptor", () => {
  const trace: string[] = [], state = SLOT.create(), history = state.history;
  Object.defineProperty(state, "history", { get: () => (trace.push("history"), history) });
  const original = Object.getOwnPropertyDescriptor(Object, "defineProperty")!;
  try {
    Reflect.defineProperty(Object, "defineProperty", {
      configurable: true,
      get() {
        trace.push("callee");
        return (target: object, key: PropertyKey, descriptor: PropertyDescriptor) => {
          trace.push("define");
          return original.value(target, key, descriptor);
        };
      },
    });
    // 此 getter 样本仅检验已准入写入程序的读序，不冒 live schema 已接受此样本。
    SLOT.allowedWrites.appendHistory(() => (trace.push("state"), state), 1, 3);
  } finally { Reflect.defineProperty(Object, "defineProperty", original); }
  expect(trace).toEqual(["callee", "state", "history", "state", "history", "define"]);
  expect(Object.getOwnPropertyDescriptor(history, "0")).toEqual({ value: { day: 1, targetId: 3 }, writable: true, enumerable: true, configurable: true });
  const frozen = SLOT.create(), fault = new Error("time_slot_state_lookup_failure");
  expect(() => SLOT.allowedWrites.appendHistory(() => { throw fault; }, 2, null)).toThrow(fault);
  expect(frozen.history).toEqual([]);
});

test("trigger write failures keep their prefix and identity reads the trigger after stringify lookup", () => {
  const state = SLOT.create(), trace: string[] = [], fault = new Error("time_slot_trigger_failure");
  let written: unknown = null;
  Object.defineProperty(state, "triggeredDay", {
    get: () => written,
    set(value: unknown) { written = value; trace.push("setter"); throw fault; },
  });
  expect(() => SLOT.allowedWrites.trigger(() => (trace.push("state"), state as TimeConsortReadState), 1)).toThrow(fault);
  expect(trace).toEqual(["state", "setter"]);
  expect(written).toBe(1);
  const valid: TimeConsortState = SLOT.create();
  valid.history.push({ day: 1, targetId: 3 });
  valid.triggeredDay = 1;
  const role = { role: "time_wolf_consort", privateState: { timeConsort: valid } } as unknown as RoleComponent;
  const original = Object.getOwnPropertyDescriptor(JSON, "stringify")!;
  let encoded: string, receiver: unknown;
  try {
    Reflect.defineProperty(JSON, "stringify", {
      configurable: true,
      get() {
        valid.triggeredDay = null;
        return function(this: unknown, value: unknown) { receiver = this; return original.value(value); };
      },
    });
    encoded = SLOT.checkpoint.identity(role, currentCamp);
  } finally { Reflect.defineProperty(JSON, "stringify", original); }
  expect(receiver).toBe(JSON);
  expect(JSON.parse(encoded)).toEqual({ policy: "awa_time_consort_reflection_v1", reflectionScope: "whole_night", history: [{ day: 1, targetId: 3 }], exhausted: true, triggeredDay: null });
  expect(valid.history[0]).toEqual({ day: 1, targetId: 3 });
});
