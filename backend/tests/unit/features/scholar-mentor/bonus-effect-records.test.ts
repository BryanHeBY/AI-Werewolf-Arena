/**
 * 单元测试验证本族加成记录的唯一数组、状态身份隔离及原效果重验顺序。
 * 输入为真实内存组件、手写回执／访问轨迹及明确旧属性注入；引用、字面拒绝和读序为独立预期。
 * 回执 commit 设置为失败哨兵，不运行整局或模型；数组／运行记录不授予付款、请求或生命写权。
 */
import { expect, test } from "bun:test";
import { World } from "../../../../src/domain/world";
import { COMPONENT } from "../../../../src/domain/components/names";
import { createAliveComponent, aliveLifeVersion } from "../../../../src/domain/components/alive";
import { StatusMarksComponent } from "../../../../src/domain/components/status-marks";
import type { NightStageState, NightStageContext } from "../../../../src/engine/night/contracts";
import type {
  ModifierBonusKind,
  ModifierBonusReceipt,
} from "../../../../src/features/scholar-mentor/night-frame";
import { assertScholarMentorBonusEffects } from "../../../../src/features/scholar-mentor/ports";
import {
  readScholarMentorBonusEffectRecords,
  scholarMentorBonusEffectRecordsForAppend,
  type ScholarMentorBonusEffectRecord,
} from "../../../../src/features/scholar-mentor/bonus-effect-records";

function state(): NightStageState {
  return {
    wolfChatOrder: [],
    endedWolves: new Set(),
    wolfVotes: {},
    wolfTarget: null,
    seerChecks: [],
  };
}
function fixture() {
  const world = new World(),
    id = world.createEntity(),
    life = createAliveComponent(),
    marks = new StatusMarksComponent();
  world.addComponent(id, COMPONENT.Alive, life);
  world.addComponent(id, COMPONENT.StatusMarks, marks);
  const target = { id, life, version: aliveLifeVersion(life)! };
  const receipt: ModifierBonusReceipt = {
    source: target,
    target,
    isCurrent: () => false,
    effectCurrent: () => true,
    commit() {
      throw new Error("commit_must_not_run");
    },
  };
  return { world, marks, receipt, target };
}

test("one lazy array retains original records and mutable fields without attaching a generic slot", () => {
  const s = state(),
    other = state(),
    f = fixture();
  const record: ScholarMentorBonusEffectRecord = {
    kind: "guard",
    receipt: f.receipt,
    marks: f.marks,
  };
  const firstEmpty = readScholarMentorBonusEffectRecords(s);
  expect(firstEmpty).toEqual([]);
  expect(readScholarMentorBonusEffectRecords(s)).not.toBe(firstEmpty);
  const rows = scholarMentorBonusEffectRecordsForAppend(s);
  rows.push(record);
  expect(readScholarMentorBonusEffectRecords(s)).toBe(rows);
  expect(scholarMentorBonusEffectRecordsForAppend(s)).toBe(rows);
  expect(rows[0]).toBe(record);
  expect(rows[0]!.receipt).toBe(f.receipt);
  expect(rows[0]!.marks).toBe(f.marks);
  expect(readScholarMentorBonusEffectRecords(other)).toEqual([]);
  expect(readScholarMentorBonusEffectRecords({ ...s })).toEqual([]);
  expect(Object.hasOwn(s, "modifierBonusEffects")).toBe(false);
  expect(Object.isFrozen(rows)).toBe(false);
  expect(Object.isFrozen(record)).toBe(false);
  // 原三字段类型及嵌套各自读写约束双向相容，数组只读视图不等于深冻结。
  type OldRecord = {
    kind: ModifierBonusKind;
    receipt: ModifierBonusReceipt;
    marks?: ReturnType<NightStageContext["ensureMarks"]>;
  };
  const oldShape: OldRecord = record,
    sameShape: ScholarMentorBonusEffectRecord = oldShape;
  sameShape.kind = "check";
  expect(rows[0]!.kind).toBe("check");
  // 此实际编译负例必须由新的key契约拒绝，删除字段后不能留下旧出口。
  // @ts-expect-error modifierBonusEffects 已退出通用 NightStageState。
  const retiredKey: keyof NightStageState = "modifierBonusEffects";
  expect(retiredKey as string).toBe("modifierBonusEffects");
});

test("effect recheck keeps target then callback then life and marks reads and never commits a receipt", () => {
  const f = fixture(),
    s = state(),
    trace: string[] = [];
  let current = true;
  const receipt: ModifierBonusReceipt = {
    ...f.receipt,
    get target() {
      trace.push("target");
      return f.target;
    },
    effectCurrent() {
      trace.push("current");
      return current;
    },
  };
  const record: ScholarMentorBonusEffectRecord = {
    kind: "guard",
    receipt,
    get marks() {
      trace.push("marks");
      return f.marks;
    },
  };
  const rows = scholarMentorBonusEffectRecordsForAppend(s);
  rows.push(record);
  let activeState = s;
  const ctx = {
    get world() {
      trace.push("world");
      return f.world;
    },
    get state() {
      trace.push("state");
      return activeState;
    },
  } as unknown as NightStageContext;
  assertScholarMentorBonusEffects(ctx);
  expect(trace).toEqual([
    "world",
    "state",
    "target",
    "current",
    "world",
    "marks",
    "world",
    "marks",
  ]);
  current = false;
  trace.length = 0;
  expect(() => assertScholarMentorBonusEffects(ctx)).toThrow("scholar_mentor_bonus_effect_stale");
  expect(trace).toEqual(["world", "state", "target", "current"]);
  current = true;
  trace.length = 0;
  f.world.addComponent(f.target.id, COMPONENT.StatusMarks, new StatusMarksComponent());
  expect(() => assertScholarMentorBonusEffects(ctx)).toThrow("scholar_mentor_bonus_effect_stale");
  expect(rows).toEqual([record]);
  // 换同形状态不继承原记录；原数组和已经发生的写入不被清理或退款。
  activeState = { ...s };
  trace.length = 0;
  expect(() => assertScholarMentorBonusEffects(ctx)).not.toThrow();
  expect(trace).toEqual(["world", "state"]);
  expect(readScholarMentorBonusEffectRecords(s)).toBe(rows);
});

test("retired generic property injection is not consulted or treated as an owned receipt", () => {
  const s = state(),
    world = new World(),
    trace: string[] = [];
  Object.defineProperty(s, "modifierBonusEffects", {
    get() {
      trace.push("retiredSlot");
      throw new Error("retired_getter_must_not_run");
    },
  });
  const ctx = {
    world,
    get state() {
      trace.push("state");
      return s;
    },
  } as unknown as NightStageContext;
  expect(() => assertScholarMentorBonusEffects(ctx)).not.toThrow();
  expect(trace).toEqual(["state"]);
  expect(readScholarMentorBonusEffectRecords(s)).toEqual([]);
});
