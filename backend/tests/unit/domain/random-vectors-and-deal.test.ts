/**
 * 单元测试：验证固定命名 RNG 向量及固定角色发牌校验。输入为字面种子、参考浮点数和完整角色表；不消耗父随机流的 fork 及原非法牌组断言为预期，不执行完整对局。
 */
import { expect, test } from "bun:test";
import { bootstrapGame } from "../../../src/app/bootstrap";
import { COMPONENT, Role, type RoleComponent } from "../../../src/core";
import { createRandom, RANDOM_ALGORITHM } from "../../../src/core/domain/random";
import { sixPlayerMvpConfig } from "../../../src/runtime/scenarios/six_player_mvp";

test("named random streams have frozen versioned vectors and do not consume their parent", () => {
  const root = createRandom("awa-vector");
  expect(root.metadata.algorithm).toBe(RANDOM_ALGORITHM);
  // Independently calculated reference vectors; changing the algorithm requires a version change.
  expect(Array.from({ length: 4 }, () => root.next())).toEqual([
    0.8902139561250806, 0.4405340019147843, 0.7681344449520111, 0.4770409520715475,
  ]);
  const consumed = root.fork("player:1");
  for (let index = 0; index < 100; index++) consumed.next();
  expect(root.fork("deal").next()).toBe(createRandom("awa-vector").fork("deal").next());
  expect(root.fork("player:2").next()).not.toBe(root.fork("player:1").next());
  expect(createRandom("欢乐局").fork("night").fork("day:1:wolf-order").next()).toBe(
    0.8437032753136009,
  );
  expect(() => createRandom(" ")).toThrow("random_seed_empty");
});

test("fixed role fixtures preserve deck counts and never bypass board rules", () => {
  const fixedRoles = [Role.Wolf, Role.Seer, Role.Villager, Role.Wolf, Role.Guard, Role.Villager];
  const { world } = bootstrapGame(sixPlayerMvpConfig, {
    fixedRoles,
    random: createRandom("fixed"),
  });
  expect(
    world.entityIds().map((id) => world.getComponent(id, COMPONENT.Role)?.role),
  ).toEqual(fixedRoles);
  expect(() => bootstrapGame(sixPlayerMvpConfig, { fixedRoles: fixedRoles.slice(1) })).toThrow(
    "fixed_role_deck_mismatch",
  );
  expect(() => bootstrapGame(sixPlayerMvpConfig, { fixedRoles: Array(6).fill(Role.Wolf) })).toThrow(
    "fixed_role_deck_mismatch",
  );
});
