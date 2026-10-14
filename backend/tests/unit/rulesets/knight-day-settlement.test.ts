/**
 * 单元测试负责骑士日结算的前置短路、已付事件前缀和死亡后裁决的晚读取。
 * 输入为真实双人组件、原骑士库存与字面故障；输出为手写字面预期的读取轨迹、资源值和提案引用。
 * 不替代窗口／网关授权，不模拟真实死亡；经理的原DR等待另由精准旧场景覆盖。
 */
import { expect, test } from "bun:test";
import { Camp, Role, type GameEvent } from "../../../src/core/domain/model";
import { COMPONENT } from "../../../src/core/domain/components/names";
import { World } from "../../../src/core/domain/world";
import { createRoleComponent } from "../../../src/core/domain/components/role";
import { createAliveComponent } from "../../../src/core/domain/components/alive";
import { setKnightState } from "../../../src/game/mechanisms/roles/knight/state";
import { settleKnightDay, type KnightDaySettlementRuntime } from "../../../src/rulesets/knight-day-settlement";

function fixture() {
  const world = new World(), actorId = world.createEntity(), targetId = world.createEntity();
  const actor = createRoleComponent(Role.Knight), target = createRoleComponent(Role.Wolf);
  const stock = setKnightState(actor, { canDuel: true });
  const actorLife = createAliveComponent(), targetLife = createAliveComponent();
  world.addComponent(actorId, COMPONENT.Role, actor);
  world.addComponent(actorId, COMPONENT.Camp, { camp: Camp.Good });
  world.addComponent(targetId, COMPONENT.Role, target);
  world.addComponent(targetId, COMPONENT.Camp, { camp: Camp.Wolf });
  world.addComponent(actorId, COMPONENT.Alive, actorLife);
  world.addComponent(targetId, COMPONENT.Alive, targetLife);
  return { world, stock, actorLife, targetLife, choice: { actorId, targetId } };
}

test("当前性先于夜已结算短路，两个拒绝分支不读取提交参数或付款", () => {
  const reads: string[] = [];
  const runtime: KnightDaySettlementRuntime = {
    get isCurrent() { reads.push("current"); return () => false; },
    get nightSettled(): never { throw new Error("literal_night_must_not_read"); },
    get world(): never { throw new Error("literal_world_must_not_read"); },
    get events(): never { throw new Error("literal_events_must_not_read"); },
    get dayRevision(): never { throw new Error("literal_revision_must_not_read"); },
    checkResult(): never { throw new Error("literal_result_must_not_run"); },
  };
  expect(settleKnightDay(runtime, { actorId: 1, targetId: 2 }).next()).toEqual({ done: true, value: "rejected" });
  expect(reads).toEqual(["current"]);
  Object.defineProperty(runtime, "isCurrent", { get() { reads.push("current"); return () => true; } });
  Object.defineProperty(runtime, "nightSettled", { get() { reads.push("night"); return false; } });
  reads.length = 0;
  expect(settleKnightDay(runtime, { actorId: 1, targetId: 2 }).next()).toEqual({ done: true, value: "rejected" });
  expect(reads).toEqual(["current", "night"]);
});

test("事件或元数据日期读取失败保原已付资源／事实前缀，未yield死亡", () => {
  for (const point of ["event", "revision"] as const) {
    const f = fixture(), events: GameEvent[] = [], reads: string[] = [];
    const failure = new Error(`literal_duel_${point}_failed`);
    Object.defineProperty(events, "push", {
      value(this: GameEvent[], event: GameEvent) {
        reads.push("publish");
        if (point === "event") throw failure;
        return Array.prototype.push.call(this, event);
      },
    });
    const settlement = settleKnightDay({
      get isCurrent() { reads.push("current"); return () => true; },
      get nightSettled() { reads.push("night"); return true; },
      get world() { reads.push("world"); return f.world; },
      get events() { reads.push("events"); return events; },
      get dayRevision(): never { reads.push("revision"); throw failure; },
      checkResult(): never { throw new Error("literal_result_must_not_run"); },
    }, f.choice);
    expect(() => settlement.next()).toThrow(failure);
    expect(reads).toEqual(point === "event"
      ? ["current", "night", "world", "events", "publish"]
      : ["current", "night", "world", "events", "publish", "revision"]);
    expect(f.stock.canDuel).toBe(false);
    expect(events).toHaveLength(point === "event" ? 0 : 1);
    expect([f.actorLife.alive, f.targetLife.alive]).toEqual([true, true]);
  }
});

test("死亡边界只交原提案／无原型元数据，恢复后current与封盘先于endsDay", () => {
  for (const point of ["stale", "sealed", "continue"] as const) {
    const f = fixture(), events: GameEvent[] = [], reads: string[] = [];
    let currentCalls = 0;
    const settlement = settleKnightDay({
      world: f.world, events, nightSettled: true, dayRevision: 7,
      isCurrent() { reads.push("current"); return ++currentCalls === 1 || point !== "stale"; },
      checkResult() { reads.push("seal"); return point === "sealed"; },
    }, f.choice);
    const step = settlement.next();
    expect(step.done).toBe(false);
    if (step.done) throw new Error("literal_duel_step_missing");
    expect(step.value.duel.deaths).toEqual([f.choice.targetId]);
    expect(Object.getPrototypeOf(step.value.duelMetadata)).toBe(null);
    expect(Object.keys(step.value.duelMetadata)).toEqual(["execution"]);
    expect(step.value.duelMetadata.execution).toEqual({ phaseRevision: 7 });
    Object.defineProperty(step.value.duel, "endsDay", {
      get() {
        reads.push("endsDay");
        if (point !== "continue") throw new Error("literal_ends_day_must_not_read");
        return true;
      },
    });
    reads.length = 0;
    expect(settlement.next()).toEqual({ done: true, value: point === "continue" ? "night" : "terminal" });
    expect(reads).toEqual(point === "stale" ? ["current"] : point === "sealed" ? ["current", "seal"] : ["current", "seal", "endsDay"]);
    expect(f.stock.canDuel).toBe(false);
  }
});
