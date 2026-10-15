/**
 * 验证首付款末端只读真实 ECS Map。输入为实际 World、被替换查询与伪造容器，输出字面原组件／拒绝。
 * 该原语不授行动、复制库存或调用 getter；场景由机制作者另外证明其原体／资源付款边界。
 */
import { expect, test } from "bun:test";
import { World, readWorldComponentAtCommit } from "../../../src/domain/world";
import { COMPONENT } from "../../../src/domain/components/names";
import { createAliveComponent } from "../../../src/domain/components/alive";

test("stable component read ignores reentrant instance query and returns the actual stored object", () => {
  const world = new World("en"),
    id = world.createEntity(),
    life = createAliveComponent();
  world.addComponent(id, COMPONENT.Alive, life);
  let queried = 0;
  world.getComponent = (() => {
    queried++;
    return undefined;
  }) as typeof world.getComponent;
  expect(readWorldComponentAtCommit(world, id, COMPONENT.Alive)).toBe(life);
  expect(readWorldComponentAtCommit(world, id, COMPONENT.Role)).toBeUndefined();
  expect(queried).toBe(0);
  expect(life.alive).toBe(true);
});

test("proxy World, accessor stores and fake Map are rejected without invoking any getter", () => {
  const world = new World("en");
  let reads = 0;
  const proxy = new Proxy(world, {
    get() {
      reads++;
      throw new Error("must_not_read_proxy");
    },
  });
  expect(readWorldComponentAtCommit(proxy, 1, COMPONENT.Alive)).toBeUndefined();
  Object.defineProperty(world, "stores", {
    configurable: true,
    get() {
      reads++;
      throw new Error("must_not_read_stores");
    },
  });
  expect(readWorldComponentAtCommit(world, 1, COMPONENT.Alive)).toBeUndefined();
  Object.defineProperty(world, "stores", {
    value: {
      get: () => {
        reads++;
        return new Map();
      },
    },
  });
  expect(readWorldComponentAtCommit(world, 1, COMPONENT.Alive)).toBeUndefined();
  expect(reads).toBe(0);
});
