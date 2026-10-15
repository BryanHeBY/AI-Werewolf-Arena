/**
 * 单元测试用有序双施法者选择及首夜知识政策验证狼术师 frame。字面组合目标、循环处理和
 * withheld 知识断言是预期，输入及字面／不可变 fixture 保持原样，不运行模型或完整对局。
 */
import { createAliveComponent } from "../../../src/agents/observation/component-presentation";
import { WOLF_SORCERER_ROLE_PROFILE } from "../../../src/features/wolf-sorcerer/profile";
import { expect, test } from "bun:test";
import { COMPONENT, Camp, type World, type RoleComponent } from "../../../src/domain";

import { createMagicianState } from "../../../src/features/magician/state-slot";
import { createWolfSorcererState } from "../../../src/features/wolf-sorcerer/state-slot";
import {
  installMagicianBoard,
  beginMagicianNight,
  commitMagicianExchange,
  closeMagicianNight,
  resolveMagicianNightTarget,
} from "../../../src/features/magician/night-frame";
import {
  installWolfSorcererBoard,
  beginWolfSorcererNight,
  commitWolfSorcererExchange,
  closeWolfSorcererNight,
  wolfSorcererChoiceTargets,
  wolfSorcererPackReady,
  abortWolfSorcererNight,
} from "../../../src/features/wolf-sorcerer/night-frame";
function fixture(firstNight: 1 | 2 = 1, shot: "original" | "exchanged" = "exchanged") {
  const mage = createMagicianState(firstNight, shot),
    wolf = createWolfSorcererState(firstNight);
  const roles = new Map<number, RoleComponent>([
    [
      1,
      {
        role: "magician",
        privateState: { magician: mage },
      } as unknown as RoleComponent,
    ],
    [
      2,
      {
        role: "wolf_sorcerer",
        privateState: { wolfSorcerer: wolf },
      } as unknown as RoleComponent,
    ],
    ...[3, 4, 5, 6].map(
      (id) =>
        [id, { role: "villager", privateState: {} } as RoleComponent] as const,
    ),
  ]);
  // 独立实际Camp组件输入；Role只保角色和原privateState，名单历史仍按原时点捕获。
  const camps = new Map([...roles.keys()].map((id) => [id, { camp: id === 2 ? Camp.Wolf : Camp.Good }]));
  const lives = new Map([...roles.keys()].map((id) => [id, createAliveComponent()]));
  const identities = new Map(
    [...roles.keys()].map((id) => [
      id,
      { id, seat: id, name: "Seat " + id, sessionId: "seat_" + id },
    ]),
  );
  const world = {
    entityIds: () => [...roles.keys()],
    getComponent: (id: number, kind: unknown) =>
      kind === COMPONENT.Camp
        ? camps.get(id)
        : kind === COMPONENT.Role
          ? roles.get(id)
        : kind === COMPONENT.Alive
          ? lives.get(id)
          : kind === COMPONENT.Identity
            ? identities.get(id)
            : undefined,
  } as unknown as World;
  installMagicianBoard(world);
  installWolfSorcererBoard(world);
  const begin = (day: number) => {
    beginMagicianNight(world, day);
    return beginWolfSorcererNight(world, day);
  };
  const close = (day: number) => {
    closeMagicianNight(world, day);
    closeWolfSorcererNight(world, day);
  };
  return { world, roles, lives, identities, mage, wolf, begin, close };
}
test("Ordered two-caster frame waits for both choices and resolves a directed cycle", () => {
  const f = fixture();
  f.begin(1);
  commitMagicianExchange(f.world, 1, 1, [3, 4]);
  expect(wolfSorcererPackReady(f.world)).toBe(false);
  expect(() => resolveMagicianNightTarget(f.world, 1, 3)).toThrow("wolf_sorcerer_night_unsettled");
  commitWolfSorcererExchange(f.world, 2, 1, [4, 5]);
  expect(wolfSorcererPackReady(f.world)).toBe(true);
  expect([3, 4, 5].map((id) => resolveMagicianNightTarget(f.world, 1, id).effectiveId)).toEqual([
    4, 5, 3,
  ]);
  const token = resolveMagicianNightTarget(f.world, 1, 3);
  expect(token.isCurrent()).toBe(true);
  f.close(1);
  expect(token.isCurrent()).toBe(false);
});
test("First-night policy withholds pack knowledge until the eligible choice settles", () => {
  const f = fixture(2);
  expect(f.begin(1)).toBeNull();
  expect(wolfSorcererPackReady(f.world)).toBe(false);
  expect(resolveMagicianNightTarget(f.world, 1, 3).effectiveId).toBe(3);
  expect(() => commitWolfSorcererExchange(f.world, 2, 1, null)).toThrow();
  f.close(1);
  expect(f.begin(2)).toBe(2);
  expect(wolfSorcererPackReady(f.world)).toBe(false);
  commitMagicianExchange(f.world, 1, 2, null);
  commitWolfSorcererExchange(f.world, 2, 2, null);
  expect(wolfSorcererPackReady(f.world)).toBe(true);
  expect(f.wolf.history).toEqual([{ day: 2, pair: null }]);
});
test("Equal pairs cancel effects without refunding either caster number inventory", () => {
  const f = fixture();
  f.begin(1);
  commitMagicianExchange(f.world, 1, 1, [3, 4]);
  commitWolfSorcererExchange(f.world, 2, 1, [4, 3]);
  for (const id of [1, 2, 3, 4, 5, 6])
    expect(resolveMagicianNightTarget(f.world, 1, id).effectiveId).toBe(id);
  expect(f.mage.history).toEqual(f.wolf.history);
  f.close(1);
  f.begin(2);
  expect(wolfSorcererChoiceTargets(f.world, 2)).toEqual([1, 2, 5, 6]);
  expect(() => commitWolfSorcererExchange(f.world, 2, 2, [3, 5])).toThrow();
  expect(f.wolf.history).toHaveLength(1);
});
for (const shot of ["original", "exchanged"] as const)
  test("Two-caster death-shot target policy/" + shot, () => {
    const f = fixture(1, shot);
    f.begin(1);
    commitMagicianExchange(f.world, 1, 1, [3, 4]);
    commitWolfSorcererExchange(f.world, 2, 1, [4, 5]);
    expect(resolveMagicianNightTarget(f.world, 1, 3, "death_shot").effectiveId).toBe(
      shot === "original" ? 3 : 4,
    );
  });
test("A dead intermediate seat occupant does not prevent reaching the living final occupant", () => {
  const f = fixture();
  f.begin(1);
  commitMagicianExchange(f.world, 1, 1, [4, 5]);
  commitWolfSorcererExchange(f.world, 2, 1, [3, 4]);
  f.lives.get(4)!.alive = false;
  const token = resolveMagicianNightTarget(f.world, 1, 3, "death_shot");
  expect(token.effectiveId).toBe(5);
  expect(token.scope.life.alive).toBe(true);
  expect(token.isCurrent()).toBe(true);
});
test("Committed composed effects survive ordinary caster deaths but reject revival", () => {
  const f = fixture();
  f.begin(1);
  commitMagicianExchange(f.world, 1, 1, [3, 4]);
  commitWolfSorcererExchange(f.world, 2, 1, [4, 5]);
  const token = resolveMagicianNightTarget(f.world, 1, 3);
  f.lives.get(1)!.alive = false;
  f.lives.get(2)!.alive = false;
  expect(token.isCurrent()).toBe(true);
  f.lives.get(2)!.alive = true;
  expect(token.isCurrent()).toBe(false);
  expect(() => resolveMagicianNightTarget(f.world, 1, 3)).toThrow();
});
test("Composed receipts reject history mutation, replacement and independent cleanup", () => {
  for (const mutate of [
    (f: ReturnType<typeof fixture>) => {
      f.wolf.history[0]!.pair = [3, 6];
    },
    (f: ReturnType<typeof fixture>) => {
      f.lives.set(5, createAliveComponent());
    },
    (f: ReturnType<typeof fixture>) => {
      f.identities.get(4)!.seat = 99;
    },
    (f: ReturnType<typeof fixture>) => {
      abortWolfSorcererNight(f.world);
    },
  ]) {
    const f = fixture();
    f.begin(1);
    commitMagicianExchange(f.world, 1, 1, [3, 4]);
    commitWolfSorcererExchange(f.world, 2, 1, [4, 5]);
    const token = resolveMagicianNightTarget(f.world, 1, 3);
    mutate(f);
    expect(token.isCurrent()).toBe(false);
    expect(() => resolveMagicianNightTarget(f.world, 1, 3)).toThrow();
  }
});

test("Wolf Sorcerer retains learned pack identities before later exchanges", () => {
  const f = fixture(2),
    role = f.roles.get(2)!;
  const capability = WOLF_SORCERER_ROLE_PROFILE.runtime.wolfTeam;
  if (typeof capability !== "function") throw new Error("expected_dynamic_pack_capability");
  f.begin(1);
  expect(capability(role, f.world, () => f.world.getComponent(2, COMPONENT.Camp))).toEqual({
    recognizedByPack: false,
    recognizes: "none",
    canChat: false,
    canVoteForKill: false,
  });
  f.close(1);
  f.begin(2);
  expect(capability(role, f.world, () => f.world.getComponent(2, COMPONENT.Camp)).recognizes).toBe("none");
  commitMagicianExchange(f.world, 1, 2, null);
  commitWolfSorcererExchange(f.world, 2, 2, null);
  expect(capability(role, f.world, () => f.world.getComponent(2, COMPONENT.Camp))).toEqual({
    recognizedByPack: true,
    recognizes: "pack",
    canChat: true,
    canVoteForKill: true,
  });
  f.close(2);
  f.begin(3);
  expect(capability(role, f.world, () => f.world.getComponent(2, COMPONENT.Camp))).toEqual({
    recognizedByPack: true,
    recognizes: "pack",
    canChat: false,
    canVoteForKill: false,
  });
  commitMagicianExchange(f.world, 1, 3, null);
  commitWolfSorcererExchange(f.world, 2, 3, null);
  expect(capability(role, f.world, () => f.world.getComponent(2, COMPONENT.Camp))).toEqual({
    recognizedByPack: true,
    recognizes: "pack",
    canChat: true,
    canVoteForKill: true,
  });
});
