/**
 * 负责觉醒狼美人夜窗与替死原体授权的单元测试；手写隔夜、同波与巡猎根阶段结果，预期不调用生产真值函数。
 * 本层只核真实库存和内存提案，实际DR死亡、公开事实与完整协议在场景层另验。
 */
import { expect, test } from "bun:test";
import { Role, Camp, Phase, DeathCause } from "@ai-werewolf-arena/game-contract";
import { World } from "../../../../src/domain/world";
import { COMPONENT } from "../../../../src/domain/components/names";
import { createAliveComponent, aliveLifeVersion } from "../../../../src/domain/components/alive";
import { createRoleComponent } from "../../../../src/domain/components/role";
import { createCampComponent } from "../../../../src/domain/components/camp";
import {
  initializeAwakenedBeautyState,
  getAwakenedBeautyState,
} from "../../../../src/features/awakened-wolf-beauty/state";
import { initializeAwakenedPatrolState } from "../../../../src/features/awakened-hunter/state";
import {
  bindAwakenedPatrol,
  qualifyAwakenedPatrol,
  payAwakenedPatrol,
} from "../../../../src/features/awakened-hunter/authority";
import {
  prepareAwakenedBeautyNight,
  openAwakenedCharm,
  awakenedCharmCandidates,
  payAwakenedCharm,
  closeAwakenedCharm,
  payAwakenedBeautyReplacement,
  readPaidBeautyReplacement,
  beautyReplacementTargetCurrent,
} from "../../../../src/features/awakened-wolf-beauty/authority";
function fixture() {
  const world = new World();
  for (let id = 1; id <= 6; id++) {
    world.createEntity();
    const role = createRoleComponent(
      id === 1
        ? Role.AwakenedWolfBeauty
        : id === 5
          ? Role.AwakenedHunter
          : id === 4
            ? Role.Wolf
            : Role.Villager,
    );
    if (id === 1) initializeAwakenedBeautyState(role);
    if (id === 5) initializeAwakenedPatrolState(role);
    world.addComponent(id, COMPONENT.Role, role);
    world.addComponent(
      id,
      COMPONENT.Camp,
      createCampComponent([1, 4].includes(id) ? Camp.Wolf : Camp.Good),
    );
    world.addComponent(id, COMPONENT.Alive, createAliveComponent());
  }
  bindAwakenedPatrol(world, 5);
  prepareAwakenedBeautyNight(world, 1, 1, () => true);
  return world;
}
function charm(world: World, day = 1, id: number | null = 2) {
  expect(openAwakenedCharm(world, 1, day)).toBe(true);
  payAwakenedCharm(world, 1, day, id, () => true);
  closeAwakenedCharm(world, 1, day);
}
function threatened(world: World) {
  const life = world.getComponent(1, COMPONENT.Alive)!;
  return { id: 1, life, version: aliveLifeVersion(life)! };
}
test("N1选择N2冷却无请求旧关系到期，N3可再选同人", () => {
  const world = fixture();
  charm(world);
  expect(() => openAwakenedCharm(world, 1, 1)).toThrow();
  prepareAwakenedBeautyNight(world, 1, 2, () => true);
  expect(openAwakenedCharm(world, 1, 2)).toBe(false);
  expect(
    payAwakenedBeautyReplacement(
      world,
      2,
      Phase.Voting,
      Phase.Voting,
      threatened(world),
      [DeathCause.Exile],
      new Set([1]),
      undefined,
      () => true,
    ),
  ).toBeNull();
  prepareAwakenedBeautyNight(world, 1, 3, () => true);
  charm(world, 3, 2);
  expect(getAwakenedBeautyState(world.getComponent(1, COMPONENT.Role))!.choices).toEqual([
    { day: 1, targetId: 2 },
    { day: 3, targetId: 2 },
  ]);
});
test("null不设冷却或耗once，自选不在候选且拒绝", () => {
  const world = fixture();
  expect(openAwakenedCharm(world, 1, 1)).toBe(true);
  expect(awakenedCharmCandidates(world, 1, 1)).toEqual([2, 3, 4, 5, 6]);
  expect(() => payAwakenedCharm(world, 1, 1, 1, () => true)).toThrow();
  payAwakenedCharm(world, 1, 1, null, () => true);
  prepareAwakenedBeautyNight(world, 1, 2, () => true);
  expect(openAwakenedCharm(world, 1, 2)).toBe(true);
  expect(getAwakenedBeautyState(world.getComponent(1, COMPONENT.Role))!.replacement).toBeNull();
});
test("同一波刀毒只付一次，不改Alive；后续独立致死无第二机会", () => {
  const world = fixture();
  charm(world);
  const receipt = payAwakenedBeautyReplacement(
    world,
    1,
    Phase.Day,
    Phase.Night,
    threatened(world),
    [DeathCause.WolfKill, DeathCause.Poison],
    new Set([1]),
    undefined,
    () => true,
  )!;
  expect(readPaidBeautyReplacement(world, receipt, 1)?.target.id).toBe(2);
  expect(world.getComponent(1, COMPONENT.Alive)!.alive).toBe(true);
  expect(world.getComponent(2, COMPONENT.Alive)!.alive).toBe(true);
  expect(
    payAwakenedBeautyReplacement(
      world,
      1,
      Phase.Voting,
      Phase.Voting,
      threatened(world),
      [DeathCause.Exile],
      new Set([1]),
      undefined,
      () => true,
    ),
  ).toBeNull();
});
for (const dead of [false, true])
  test(`替身已独立${dead ? "真实死亡" : "同波必死"}不消费一次`, () => {
    const world = fixture();
    charm(world);
    if (dead) world.getComponent(2, COMPONENT.Alive)!.alive = false;
    expect(
      payAwakenedBeautyReplacement(
        world,
        1,
        Phase.Day,
        Phase.Night,
        threatened(world),
        [DeathCause.WolfKill],
        new Set(dead ? [1] : [1, 2]),
        undefined,
        () => true,
      ),
    ).toBeNull();
    expect(getAwakenedBeautyState(world.getComponent(1, COMPONENT.Role))!.replacement).toBeNull();
  });
for (const root of [Phase.Night, Phase.Voting])
  test(`真实巡猎${root}根只抑制本次夜源替死`, () => {
    const world = fixture();
    charm(world);
    world.getComponent(5, COMPONENT.Alive)!.alive = false;
    const handle = qualifyAwakenedPatrol(world, 5, 1, root, [DeathCause.Poison], () => true)!;
    const proposal = payAwakenedPatrol(world, handle, "clockwise", () => true)!;
    const replacement = payAwakenedBeautyReplacement(
      world,
      1,
      Phase.Day,
      root,
      threatened(world),
      [DeathCause.AwakenedPatrol],
      new Set([1]),
      proposal,
      () => true,
    );
    expect(replacement === null).toBe(root === Phase.Night);
    expect(
      getAwakenedBeautyState(world.getComponent(1, COMPONENT.Role))!.replacement === null,
    ).toBe(root === Phase.Night);
  });
test("替死最后guard目标换体零支付；已付目标换体不杀新body或退款", () => {
  const world = fixture();
  charm(world);
  const original = world.getComponent(2, COMPONENT.Alive)!;
  expect(() =>
    payAwakenedBeautyReplacement(
      world,
      1,
      Phase.Day,
      Phase.Night,
      threatened(world),
      [DeathCause.Poison],
      new Set([1]),
      undefined,
      () => {
        world.addComponent(2, COMPONENT.Alive, createAliveComponent());
        return true;
      },
    ),
  ).toThrow("awakened_beauty_replacement_revoked");
  expect(getAwakenedBeautyState(world.getComponent(1, COMPONENT.Role))!.replacement).toBeNull();
  world.addComponent(2, COMPONENT.Alive, original);
  expect(
    payAwakenedBeautyReplacement(
      world,
      1,
      Phase.Day,
      Phase.Night,
      threatened(world),
      [DeathCause.Poison],
      new Set([1]),
      undefined,
      () => true,
    ),
  ).toBeNull();
  const other = fixture();
  charm(other);
  const receipt = payAwakenedBeautyReplacement(
    other,
    1,
    Phase.Day,
    Phase.Night,
    threatened(other),
    [DeathCause.Poison],
    new Set([1]),
    undefined,
    () => true,
  )!;
  const target = other.getComponent(2, COMPONENT.Alive)!;
  other.addComponent(2, COMPONENT.Alive, createAliveComponent());
  expect(beautyReplacementTargetCurrent(other, receipt, 1)).toBe(false);
  other.addComponent(2, COMPONENT.Alive, target);
  expect(beautyReplacementTargetCurrent(other, receipt, 1)).toBe(false);
  expect(getAwakenedBeautyState(other.getComponent(1, COMPONENT.Role))!.replacement).not.toBeNull();
});
