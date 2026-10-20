/**
 * 单元测试负责白昼学者／寂夜导师新槽边界的原左值读取、原引用撤销及写入失败前缀。
 * 输入是测试自有原状态、明确 setter／JSON 失败；输出按手写字面顺序、对象身份与库存／历史预期断言。
 * 测试直接调用内部槽写方法以定位 prefix，不将其视为 board、角色、生命或夜许可，也不运行模型／完整对局。
 */
import { expect, test } from "bun:test";
import {
  createModifierState,
  selectModifier,
  readModifierState,
  initializeScholarMentorState,
  ScholarMentorStateSlot,
} from "../../../../src/features/scholar-mentor/state-slot";
import type { RoleComponent } from "../../../../src/domain/components/role";

test("学者槽初始化先取原左值，再读 caster 和写入；失败不重试", () => {
  const trace: string[] = [],
    failure = new Error("test_initial_setter");
  const data = Object.defineProperty({}, "scholarMentor", {
    set(value) {
      trace.push("set:" + value.caster);
      throw failure;
    },
  }) as RoleComponent["privateState"];
  let caught: unknown;
  try {
    initializeScholarMentorState(
      () => {
        trace.push("left");
        return data;
      },
      () => {
        trace.push("caster");
        return "night_mentor";
      },
    );
  } catch (error) {
    caught = error;
  }
  expect(caught).toBe(failure);
  expect(trace).toEqual(["left", "caster", "set:night_mentor"]);

  trace.length = 0;
  try {
    initializeScholarMentorState(
      () => {
        trace.push("left");
        throw failure;
      },
      () => {
        trace.push("caster");
        return "day_scholar";
      },
    );
  } catch (error) {
    caught = error;
  }
  expect(caught).toBe(failure);
  expect(trace).toEqual(["left"]);
});

test("学者槽脱离副本不续原引用；同 JSON 替换资源或历史仍撤销", () => {
  const raw = createModifierState("day_scholar"),
    slot = new ScholarMentorStateSlot(raw);
  expect(slot.matches(raw)).toBe(true);
  const copy = readModifierState(raw)!;
  expect(copy).not.toBe(raw);
  expect(slot.matches(copy)).toBe(false);
  raw.remaining = { enhance: 1, weaken: 1 };
  expect(slot.matches(raw)).toBe(false);
  raw.remaining = slot.remaining as typeof raw.remaining;
  raw.history = [];
  expect(slot.matches(raw)).toBe(false);
  raw.history = slot.history as typeof raw.history;
  expect(slot.matches(raw)).toBe(true);
});

test("学者槽第二库存赋值失败保第一次付款，不写历史或 expected", () => {
  const raw = createModifierState("day_scholar"),
    slot = new ScholarMentorStateSlot(raw);
  const next = selectModifier(raw, 2, "enhance", 3, [1, 2, 3]);
  const oldExpected = slot.expected,
    failure = new Error("test_weaken_setter"),
    trace: string[] = [];
  Object.defineProperty(raw.remaining, "weaken", {
    get: () => 1,
    set(value) {
      trace.push("weaken:" + value);
      throw failure;
    },
  });
  let caught: unknown;
  try {
    slot.commit(next);
  } catch (error) {
    caught = error;
  }
  expect(caught).toBe(failure);
  expect(raw.remaining.enhance).toBe(0);
  expect(trace).toEqual(["weaken:1"]);
  expect(raw.history).toEqual([]);
  expect(slot.expected).toBe(oldExpected);
});

test("学者槽 JSON 快照失败保历史提交，expected 不更新", () => {
  const raw = createModifierState("night_mentor"),
    slot = new ScholarMentorStateSlot(raw);
  const next = selectModifier(raw, 2, "enhance", 3, [1, 2, 3]);
  const oldExpected = slot.expected,
    failure = new Error("test_json_snapshot");
  const descriptor = Object.getOwnPropertyDescriptor(JSON, "stringify")!;
  let caught: unknown,
    calls = 0;
  // 原 JSON callee 在历史 define 完成后才读取；测试恢复全局 descriptor，异常对象不被替换。
  Object.defineProperty(JSON, "stringify", {
    configurable: true,
    get() {
      calls++;
      throw failure;
    },
  });
  try {
    slot.commit(next);
  } catch (error) {
    caught = error;
  } finally {
    Object.defineProperty(JSON, "stringify", descriptor);
  }
  expect(caught).toBe(failure);
  expect(calls).toBe(1);
  expect(raw.remaining).toEqual({ enhance: 0, weaken: 1 });
  expect(raw.history).toEqual([{ day: 2, mode: "enhance", targetId: 3 }]);
  expect(raw.history[0]).toBe(next.history[0]);
  expect(slot.expected).toBe(oldExpected);
});
