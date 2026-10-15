/**
 * 负责新owned付款末端原体查询的字面单元测试。真实World、工厂生命和原捕获为输入，
 * 独立核身份/阵营/版本、clone与跨World拒绝，不调用可重入World实例方法或普通属性访问器。
 * 查询本身不写资源；旧可扩展查询仍由原业务调用点执行，此处仅覆盖最终稳定读取。
 */
import { expect, test } from "bun:test";
import { Camp, Role } from "@ai-werewolf-arena/game-contract";
import { World } from "../../../src/domain/world";
import { COMPONENT } from "../../../src/domain/components/names";
import { createRoleComponent } from "../../../src/domain/components/role";
import { createCampComponent } from "../../../src/domain/components/camp";
import { createAliveComponent } from "../../../src/domain/components/alive";
import {
  captureOriginalPlayer,
  originalPlayerAtCommit,
} from "../../../src/domain/original-player-scope";
function fixture() {
  const world = new World(),
    id = world.createEntity(),
    life = createAliveComponent(),
    role = createRoleComponent(Role.Villager),
    camp = createCampComponent(Camp.Good);
  world.addComponent(id, COMPONENT.Alive, life);
  world.addComponent(id, COMPONENT.Role, role);
  world.addComponent(id, COMPONENT.Camp, camp);
  return { world, id, life, role, camp, scope: captureOriginalPlayer(world, id)! };
}
test("末端稳定读取不调用可重入方法，但仍识别真实ECS后续替换", () => {
  const f = fixture();
  let reads = 0;
  Object.defineProperty(f.world, "getComponent", {
    get() {
      reads++;
      throw Error("unexpected_instance_query");
    },
  });
  expect(originalPlayerAtCommit(f.world, f.scope)).toBe(true);
  expect(reads).toBe(0);
  f.world.addComponent(f.id, COMPONENT.Alive, createAliveComponent());
  expect(originalPlayerAtCommit(f.world, f.scope)).toBe(false);
  expect(reads).toBe(0);
});
test("原捕获不可由同形clone或另一个World借用，角色/阵营更换均拒绝", () => {
  const f = fixture();
  expect(originalPlayerAtCommit(f.world, { ...f.scope })).toBe(false);
  expect(originalPlayerAtCommit(fixture().world, f.scope)).toBe(false);
  f.camp.camp = Camp.Wolf;
  expect(originalPlayerAtCommit(f.world, f.scope)).toBe(false);
  f.camp.camp = Camp.Good;
  f.world.addComponent(f.id, COMPONENT.Role, createRoleComponent(Role.Villager));
  expect(originalPlayerAtCommit(f.world, f.scope)).toBe(false);
});
test("只已付场景可允许第一次原生命死亡；复活后即使再次死亡也不匹配", () => {
  const f = fixture();
  f.life.alive = false;
  expect(originalPlayerAtCommit(f.world, f.scope)).toBe(false);
  expect(originalPlayerAtCommit(f.world, f.scope, true)).toBe(true);
  f.life.alive = true;
  expect(originalPlayerAtCommit(f.world, f.scope, true)).toBe(false);
  f.life.alive = false;
  expect(originalPlayerAtCommit(f.world, f.scope, true)).toBe(false);
});
test("原角色身份访问器不执行；伪Alive访问器不能冒充工厂生命", () => {
  const f = fixture();
  let reads = 0;
  Object.defineProperty(f.role, "role", {
    get() {
      reads++;
      throw Error("unexpected_role_getter");
    },
  });
  expect(originalPlayerAtCommit(f.world, f.scope)).toBe(false);
  expect(reads).toBe(0);
  const second = fixture();
  Object.defineProperty(second.life, "alive", {
    get() {
      reads++;
      throw Error("unexpected_life_getter");
    },
  });
  expect(originalPlayerAtCommit(second.world, second.scope)).toBe(false);
  expect(reads).toBe(0);
});
