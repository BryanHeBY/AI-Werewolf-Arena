/**
 * 单元测试：验证普通私有槽的同引用读取与具体写入前缀。输入为字面安装数据、带 accessor 的技能及交易库存；复制／引用和 getter／setter 轨迹验证已付费的部分写。编译期拒绝读视图修改，不运行完整对局、传输或模型。
 */
import "../../../src/app/bootstrap";
import { expect, test } from "bun:test";
import { Camp, Role } from "@ai-werewolf-arena/game-contract";
import type {
  HunterReadState,
  MechanicalReadState,
  MechanicalReadSkill,
  MerchantReadState,
  GravekeeperReadState,
  BearReadState,
  HiddenWolfReadState,
} from "@ai-werewolf-arena/game-contract";
import { createRoleComponent } from "../../../src/agents/observation/role-presentation";
import { getHunterState, setHunterState } from "../../../src/features/hunter/ports";
import {
  freshMechanicalState,
  getMechanicalState,
  setMechanicalState,
  recordMechanicalInspection,
} from "../../../src/features/mechanical-wolf/state";
import { recordMerchantTrade } from "../../../src/features/miracle-merchant/state";

function ordinaryReadersCannotWrite(
  hunter: HunterReadState,
  mechanical: MechanicalReadState,
  merchant: MerchantReadState,
  grave: GravekeeperReadState,
  bear: BearReadState,
  hidden: HiddenWolfReadState,
) {
  // @ts-expect-error 枪库存由原生死亡枪的资源所有者消费。
  hunter.canShoot = false;
  // @ts-expect-error 已安装读视图中的复制政策字段仍只读。
  hidden.campInspection = "awa_inheritance_v1";
  // @ts-expect-error 交易库存的写权不授予普通读取方。
  merchant.remaining = 0;
  // @ts-expect-error 可空交易选择记录的内层字段也只读。
  merchant.choice!.targetId = 3;
  // @ts-expect-error 不能经读取视图追加咆哮历史。
  bear.history.push({ day: 1, roared: true });
  // @ts-expect-error 历史条目内的反馈结果也保持只读。
  grave.history[0]!.result.camp = "wolf";
  // @ts-expect-error 普通读取方没有学习角色元数据的写权。
  mechanical.learned!.readyOnNight = 3;
  // @ts-expect-error 可空模式记录的内层元数据也只读。
  mechanical.mode!.day = 3;
  const skill = mechanical.learned?.skill;
  if (skill?.kind === "poison") {
    // @ts-expect-error 学习元数据中的所选技能库存也只读。
    skill.remaining = 0;
  }
  if (skill?.kind === "inspection") {
    // @ts-expect-error 学习查验的条目和结果不暴露普通写权。
    skill.history[0]!.result.role = Role.Wolf;
  }
}
void ordinaryReadersCannotWrite;

test("plain installation keeps its original input reference while Mechanical keeps its original copy", () => {
  const hunterRole = createRoleComponent(Role.Hunter),
    input = { canShoot: true },
    installed = setHunterState(hunterRole, input);
  expect(installed).toBe(input);
  expect(getHunterState(hunterRole)).toBe(input);
  const mechanicalRole = createRoleComponent(Role.MechanicalWolf),
    data = freshMechanicalState(),
    copied = setMechanicalState(mechanicalRole, data);
  expect(copied).not.toBe(data);
  expect(getMechanicalState(mechanicalRole)).toBe(copied);
  expect(getMechanicalState(mechanicalRole)).toBe(copied);
  expect(Object.isFrozen(input)).toBe(false);
  expect(Object.isFrozen(copied)).toBe(false);
});

function observedInspection(trace: string[], failTarget = false) {
  const history: Array<{ day: number; targetId: number; result: { kind: "role"; role: Role } }> =
    [];
  Object.defineProperty(history, "push", {
    get() {
      trace.push("push");
      return Array.prototype.push;
    },
  });
  const skill: Extract<MechanicalReadSkill, { kind: "inspection" }> = {
    kind: "inspection",
    get history() {
      trace.push("history");
      return history;
    },
  };
  const target = {
    get id() {
      trace.push("target");
      if (failTarget) throw Error("original_target_read_failure");
      return 4;
    },
  };
  const result = {
    kind: "role" as const,
    get role() {
      trace.push("result");
      return Role.Wolf;
    },
  };
  return { skill, target, result, history };
}

test("Mechanical history and push lookup still precede target and result getters", () => {
  const trace: string[] = [],
    f = observedInspection(trace);
  recordMechanicalInspection(f.skill, 2, f.target, f.result);
  expect(trace).toEqual(["history", "push", "target", "result"]);
  expect(f.history).toEqual([{ day: 2, targetId: 4, result: { kind: "role", role: Role.Wolf } }]);
});

test("a target getter failure retains lookup prefix without appending a row", () => {
  const trace: string[] = [],
    f = observedInspection(trace, true);
  expect(() => recordMechanicalInspection(f.skill, 2, f.target, f.result)).toThrow(
    "original_target_read_failure",
  );
  expect(trace).toEqual(["history", "push", "target"]);
  expect(f.history).toEqual([]);
});

test("trade day-write failure preserves paid stock and never evaluates the choice write", () => {
  const trace: string[] = [],
    stored: { remaining: 0 | 1 } = { remaining: 1 };
  const state: MerchantReadState = {
    get remaining() {
      return stored.remaining;
    },
    set remaining(value: 0 | 1) {
      trace.push("remaining");
      stored.remaining = value;
    },
    get closedDay() {
      return null;
    },
    set closedDay(_value: number | null) {
      trace.push("day");
      throw Error("original_day_write_failure");
    },
    get choice() {
      return null;
    },
    set choice(_value: MerchantReadState["choice"]) {
      trace.push("choice");
    },
  };
  expect(() => recordMerchantTrade(state, 2, 4, "check")).toThrow("original_day_write_failure");
  expect(trace).toEqual(["remaining", "day"]);
  expect(stored.remaining).toBe(0);
});
