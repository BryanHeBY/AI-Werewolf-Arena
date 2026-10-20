/**
 * 负责觉醒巡猎原生命授权的单元测试；手写座位／阵营和死亡根预期，不调用生产选狼函数生成oracle。
 * 本层只消费真实库存并核不透明提案，不登记角色或宣称完成真实DR／SDK／ACP交付。
 */
import { expect, test } from "bun:test";
import { Role, Camp, Phase, DeathCause } from "@ai-werewolf-arena/game-contract";
import { World } from "../../../../src/domain/world";
import { COMPONENT } from "../../../../src/domain/components/names";
import { createAliveComponent } from "../../../../src/domain/components/alive";
import { createRoleComponent } from "../../../../src/domain/components/role";
import { createCampComponent } from "../../../../src/domain/components/camp";
import {
  initializeAwakenedPatrolState,
  getAwakenedPatrolState,
} from "../../../../src/features/awakened-hunter/state";
import {
  bindAwakenedPatrol,
  qualifyAwakenedPatrol,
  awakenedPatrolCurrent,
  payAwakenedPatrol,
  paidAwakenedPatrol,
  nightPatrolSuppressesBeauty,
  closeAwakenedPatrol,
} from "../../../../src/features/awakened-hunter/authority";
function fixture() {
  const world = new World();
  for (let id = 1; id <= 6; id++) {
    world.createEntity();
    const role = createRoleComponent(
      id === 1 ? Role.AwakenedHunter : [3, 4, 6].includes(id) ? Role.Wolf : Role.Villager,
    );
    if (id === 1) initializeAwakenedPatrolState(role);
    world.addComponent(id, COMPONENT.Role, role);
    world.addComponent(
      id,
      COMPONENT.Camp,
      createCampComponent([3, 4, 6].includes(id) ? Camp.Wolf : Camp.Good),
    );
    world.addComponent(id, COMPONENT.Alive, createAliveComponent());
  }
  bindAwakenedPatrol(world, 1);
  world.getComponent(4, COMPONENT.Alive)!.alive = false;
  return world;
}
function dead(world: World, root = Phase.Night) {
  world.getComponent(1, COMPONENT.Alive)!.alive = false;
  return qualifyAwakenedPatrol(world, 1, 1, root, [DeathCause.Poison], () => true)!;
}
for (const [direction, id] of [
  ["clockwise", 3],
  ["counter_clockwise", 6],
] as const)
  test(`毒死仍可${direction}，只命中方向最近原活真狼${id}`, () => {
    const world = fixture(),
      handle = dead(world);
    const proposal = payAwakenedPatrol(world, handle, direction, () => true)!;
    const paid = paidAwakenedPatrol(world, proposal, 1)!;
    expect(paid.target.id).toBe(id);
    expect(paid.rootPhase).toBe(Phase.Night);
    expect(nightPatrolSuppressesBeauty(world, proposal, 1, paid.target)).toBe(true);
    closeAwakenedPatrol(handle);
    expect(paidAwakenedPatrol(world, proposal, 1)?.target.id).toBe(id);
  });
test("alive提前资格查询不污染后续真实死亡；null明确耗唯一单位", () => {
  const world = fixture();
  expect(
    qualifyAwakenedPatrol(world, 1, 1, Phase.Night, [DeathCause.Poison], () => true),
  ).toBeNull();
  const handle = dead(world);
  expect(payAwakenedPatrol(world, handle, null, () => true)).toBeNull();
  expect(
    getAwakenedPatrolState(world.getComponent(1, COMPONENT.Role))!.payment?.direction,
  ).toBeNull();
  expect(awakenedPatrolCurrent(world, handle)).toBe(false);
});
test("无原活狼时资格为null，不创建方向请求或扣单位", () => {
  const world = fixture();
  for (const id of [3, 4, 6]) world.getComponent(id, COMPONENT.Alive)!.alive = false;
  expect(dead(world)).toBeNull();
  expect(getAwakenedPatrolState(world.getComponent(1, COMPONENT.Role))!.payment).toBeNull();
});
test("最后回调杀死原最近狼，付款前仅按方向重算一次", () => {
  const world = fixture(),
    handle = dead(world);
  const proposal = payAwakenedPatrol(world, handle, "clockwise", () => {
    world.getComponent(3, COMPONENT.Alive)!.alive = false;
    return true;
  })!;
  expect(paidAwakenedPatrol(world, proposal, 1)?.target.id).toBe(6);
});
test("日根巡猎不带夜源抑制，DTO复制与错误World/日期无权且不毒原提案", () => {
  const world = fixture(),
    handle = dead(world, Phase.Voting),
    proposal = payAwakenedPatrol(world, handle, "clockwise", () => true)!;
  const paid = paidAwakenedPatrol(world, proposal, 1)!;
  expect(nightPatrolSuppressesBeauty(world, proposal, 1, paid.target)).toBe(false);
  expect(paidAwakenedPatrol(new World(), proposal, 1)).toBeNull();
  expect(paidAwakenedPatrol(world, proposal, 2)).toBeNull();
  expect(paidAwakenedPatrol(world, { ...proposal }, 1)).toBeNull();
  expect(paidAwakenedPatrol(world, proposal, 1)).not.toBeNull();
});
test("N1原体绑定后新body死亡不授巡猎，恢复旧引用也不恢复已观察撤权", () => {
  const world = fixture(),
    original = world.getComponent(1, COMPONENT.Alive)!;
  world.addComponent(1, COMPONENT.Alive, createAliveComponent(false));
  expect(
    qualifyAwakenedPatrol(world, 1, 1, Phase.Night, [DeathCause.Poison], () => true),
  ).toBeNull();
  world.addComponent(1, COMPONENT.Alive, original);
  original.alive = false;
  expect(
    qualifyAwakenedPatrol(world, 1, 1, Phase.Night, [DeathCause.Poison], () => true),
  ).toBeNull();
});
test("已付原目标换body撤权，不补巡别狼，恢复旧引用也无效", () => {
  const world = fixture(),
    handle = dead(world),
    proposal = payAwakenedPatrol(world, handle, "clockwise", () => true)!;
  const original = world.getComponent(3, COMPONENT.Alive)!;
  world.addComponent(3, COMPONENT.Alive, createAliveComponent());
  expect(paidAwakenedPatrol(world, proposal, 1)).toBeNull();
  world.addComponent(3, COMPONENT.Alive, original);
  expect(paidAwakenedPatrol(world, proposal, 1)).toBeNull();
  expect(getAwakenedPatrolState(world.getComponent(1, COMPONENT.Role))!.payment?.targetId).toBe(3);
});
test("deadline与源原体末撤权零支付，重入内层付款保留真实prefix", () => {
  const world = fixture(),
    handle = dead(world);
  expect(() => payAwakenedPatrol(world, handle, "clockwise", () => false)).toThrow(
    "awakened_patrol_payment_revoked",
  );
  expect(getAwakenedPatrolState(world.getComponent(1, COMPONENT.Role))!.payment).toBeNull();
  expect(() =>
    payAwakenedPatrol(world, handle, "clockwise", () => {
      payAwakenedPatrol(world, handle, null, () => true);
      return true;
    }),
  ).toThrow("awakened_patrol_payment_revoked");
  expect(
    getAwakenedPatrolState(world.getComponent(1, COMPONENT.Role))!.payment?.direction,
  ).toBeNull();
});
test("候选换体被观察后恢复旧组件不恢复巡猎目标权", () => {
  const world = fixture(),
    handle = dead(world),
    original = world.getComponent(3, COMPONENT.Role)!;
  world.addComponent(3, COMPONENT.Role, createRoleComponent(Role.Villager));
  expect(awakenedPatrolCurrent(world, handle)).toBe(true);
  world.addComponent(3, COMPONENT.Role, original);
  const proposal = payAwakenedPatrol(world, handle, "clockwise", () => true)!;
  expect(paidAwakenedPatrol(world, proposal, 1)!.target.id).toBe(6);
});
