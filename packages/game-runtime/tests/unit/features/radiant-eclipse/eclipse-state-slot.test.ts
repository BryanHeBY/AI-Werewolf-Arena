/**
 * 单元测试验证蚀日侍女原状态与归一化身份、实际写入的失败前缀及候选晚读。
 * 输入为字面历史、真实严格 reader 和有限 descriptor／JSON 故障；预期为手写引用、轨迹和首拒绝。
 * 数据绑定不是借用／付款权威；不模拟完整 frame 或从第二份生产结果推导 oracle，不运行对局或模型。
 */
import { expect, test } from "bun:test";
import {
  EclipseStateBinding,
  createEclipseState,
  readEclipseState,
} from "../../../../src/features/radiant-eclipse/eclipse-state-slot";

test("同raw身份与归一化编码分别检查，不把复制历史或descriptor变化当第二库存", () => {
  const raw = createEclipseState();
  Object.defineProperty(raw, "history", { enumerable: false });
  const parsed = readEclipseState(raw)!,
    binding = new EclipseStateBinding(raw, parsed);
  expect(parsed).not.toBe(raw);
  expect(parsed.history).not.toBe(raw.history);
  expect(JSON.stringify(raw)).toBe('{"policy":"awa_radiant_eclipse_v1"}');
  expect(() => binding.assertCurrent(() => raw)).not.toThrow();
  // 原规则只核槽对象与归一化内容；同raw的等值空历史替换仍有效，不新增数组身份拒绝。
  raw.history = [];
  expect(() => binding.assertCurrent(() => raw)).not.toThrow();
  expect(binding.lastChoice()).toBeUndefined();
  expect(() =>
    binding.assertCurrent(() => ({ policy: "awa_radiant_eclipse_v1", history: [] })),
  ).toThrow("eclipse_state_revoked");
  raw.history.push({ day: 2, targetId: null, roleId: null, abilityId: null });
  expect(() => binding.assertCurrent(() => raw)).toThrow("eclipse_state_revoked");
});

test("assign首字段后失败不编码，完整写后JSON故障保新历史和旧身份编码", () => {
  const raw = createEclipseState(),
    oldHistory = raw.history,
    binding = new EclipseStateBinding(raw, readEclipseState(raw)!),
    trace: string[] = [];
  Object.defineProperty(raw, "history", { writable: false });
  const next = {
    get policy(): "awa_radiant_eclipse_v1" {
      trace.push("policy");
      return "awa_radiant_eclipse_v1";
    },
    get history() {
      trace.push("history");
      return [{ day: 2, targetId: null, roleId: null, abilityId: null }];
    },
  };
  const descriptor = Object.getOwnPropertyDescriptor(JSON, "stringify")!;
  Object.defineProperty(JSON, "stringify", {
    configurable: true,
    get(): never {
      trace.push("json");
      throw new Error("literal_json_must_not_read_after_assign_failure");
    },
  });
  try {
    expect(() => binding.install(next)).toThrow(TypeError);
    expect(trace).toEqual(["policy", "history"]);
    expect(raw.history).toBe(oldHistory);
  } finally {
    Object.defineProperty(JSON, "stringify", descriptor);
  }
  expect(() => binding.assertCurrent(() => raw)).not.toThrow();
  Object.defineProperty(raw, "history", { writable: true });
  const written = {
      policy: "awa_radiant_eclipse_v1" as const,
      history: [{ day: 2, targetId: null, roleId: null, abilityId: null }],
    },
    failure = new Error("literal_json_after_write_failure");
  Object.defineProperty(JSON, "stringify", {
    configurable: true,
    get(): never {
      throw failure;
    },
  });
  try {
    expect(() => binding.install(written)).toThrow(failure);
    expect(raw.history).toBe(written.history);
  } finally {
    Object.defineProperty(JSON, "stringify", descriptor);
  }
  expect(() => binding.assertCurrent(() => raw)).toThrow("eclipse_state_revoked");
});

test("候选查询先于select内部严格读取，准备不写raw，install随后写同一历史引用", () => {
  const raw = createEclipseState(),
    binding = new EclipseStateBinding(raw, readEclipseState(raw)!),
    trace: string[] = [],
    descriptors = Object.getOwnPropertyDescriptors;
  Object.getOwnPropertyDescriptors = function (value) {
    if (value === raw) trace.push("reader");
    return descriptors(value);
  };
  let next;
  try {
    next = binding.next(
      2,
      4,
      () => {
        trace.push("goodIds");
        return [4];
      },
      "villager",
    );
  } finally {
    Object.getOwnPropertyDescriptors = descriptors;
  }
  expect(trace).toEqual(["goodIds", "reader"]);
  expect(raw.history).toEqual([]);
  expect(next).toEqual({
    policy: "awa_radiant_eclipse_v1",
    history: [{ day: 2, targetId: 4, roleId: "villager", abilityId: null }],
  });
  binding.install(next!);
  expect(raw.history).toBe(next!.history);
  expect(() => binding.assertCurrent(() => raw)).not.toThrow();
  expect(binding.lastChoice()).toEqual({
    day: 2,
    targetId: 4,
    roleId: "villager",
    abilityId: null,
  });
  expect(binding.lastChoice()).not.toBe(raw.history[0]);
});
