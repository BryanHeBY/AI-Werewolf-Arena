/**
 * 单元测试负责四类狼继承名单的缺角色边界。输入为有原工厂生命和实际 Camp、但没有 Role 的实体；Camp 的读取刻意抛错。
 * 独立预期是没有继承事实、没有错误，也不查询 Camp 或调用其 getter；当前阵营单一来源不能扩大参与名单。
 * 每例独立 World 与局部查询探针，不改默认注册表、不推进对局或访问模型。
 */
import { expect, test } from "bun:test";
import { World } from "../../../src/domain/world";
import { COMPONENT } from "../../../src/domain/components/names";
import { createAliveComponent } from "../../../src/domain/components/alive";
import type { CampComponent } from "../../../src/domain/components/camp";
import type { GameEvent } from "../../../src/domain/events";
import { refreshHiddenWolfInheritance } from "../../../src/features/hidden-wolf/inheritance";
import { refreshGargoyleInheritance } from "../../../src/features/gargoyle/inheritance";
import { refreshMechanicalInheritance } from "../../../src/features/mechanical-wolf/inheritance";
import { refreshAwakenedInheritance } from "../../../src/features/awakened-hidden-wolf/inheritance";

// 四个真实公开刷新入口分别执行，不以通用名单实现或模拟角色状态替代它们。
const inputs = [
  ["hidden wolf", (world: World, events: GameEvent[]) => refreshHiddenWolfInheritance(world, events, 1)],
  ["gargoyle", (world: World, events: GameEvent[]) => refreshGargoyleInheritance(world, events, 1)],
  ["mechanical wolf", (world: World, events: GameEvent[]) => refreshMechanicalInheritance(world, 1, events)],
  ["awakened hidden wolf", (world: World, events: GameEvent[]) => refreshAwakenedInheritance(world, 1, events)],
] as const;

for (const [name, refresh] of inputs) test(`${name} inheritance ignores a live Camp-only entity without touching its Camp`, () => {
  const world = new World(), id = world.createEntity(), events: GameEvent[] = [];
  let campQueries = 0, campReads = 0;
  world.addComponent(id, COMPONENT.Alive, createAliveComponent(true));
  // 真实组件的访问器刻意抛错，证明 Role 缺失的原短路仍发生在新增 Camp 通道之前。
  const camp: CampComponent = { get camp(): never { campReads++; throw new Error("missing_role_camp_must_not_be_read"); } };
  world.addComponent(id, COMPONENT.Camp, camp);
  const original = world.getComponent;
  Object.defineProperty(world, "getComponent", { value: new Proxy(original, {
    apply(target, receiver, args) {
      if (args[1] === COMPONENT.Camp) campQueries++;
      return Reflect.apply(target, receiver, args);
    },
  }) });
  expect(() => refresh(world, events)).not.toThrow();
  expect(events).toEqual([]);
  expect(campQueries).toBe(0);
  expect(campReads).toBe(0);
});
