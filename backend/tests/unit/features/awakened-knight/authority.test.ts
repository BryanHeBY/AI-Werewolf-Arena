/**
 * 负责觉醒骑士原体窗口／全局尝试与连续链付款单元测试。输入为最小World与字面选择，
 * 人工预期明确成功／误中、同号目标不返还、同步重入和末查询换体；不运行第二引擎生成oracle。
 */
import { expect, test } from "bun:test";
import { Camp, Role } from "@ai-werewolf-arena/game-contract";
import { AWAKENED_KNIGHT_ROLE_ID } from "@ai-werewolf-arena/game-contract/facts/awakened-duel";
import { World } from "../../../../src/domain/world";
import { COMPONENT } from "../../../../src/domain/components/names";
import { createAliveComponent } from "../../../../src/domain/components/alive";
import { createRoleComponent } from "../../../../src/domain/components/role";
import {
  initializeAwakenedKnightState,
  getAwakenedKnightState,
} from "../../../../src/features/awakened-knight/state";
import {
  prepareAwakenedKnight,
  openDuelBoundary,
  duelBoundaryOptions,
  duelBoundaryCurrent,
  duelChoiceAllowed,
  commitDuelChoice,
  paidDuelProposal,
  duelChainCurrent,
  closeDuelBoundary,
  closeDuelChain,
  type DuelChoiceResult,
} from "../../../../src/features/awakened-knight/authority";
function fixture() {
  const world = new World("en"),
    lives = Array.from({ length: 5 }, (_, i) => {
      const id = world.createEntity(),
        life = createAliveComponent(),
        role = createRoleComponent(
          i === 0 ? (AWAKENED_KNIGHT_ROLE_ID as Role) : i < 3 ? Role.Wolf : Role.Villager,
        );
      world.addComponent(id, COMPONENT.Alive, life);
      world.addComponent(id, COMPONENT.Role, role);
      world.addComponent(id, COMPONENT.Camp, { camp: i === 1 || i === 2 ? Camp.Wolf : Camp.Good });
      if (i === 0) initializeAwakenedKnightState(role, world);
      return life;
    }),
    role = world.getComponent(1, COMPONENT.Role)!;
  prepareAwakenedKnight(world, 1, () => true);
  return { world, lives, role, state: () => getAwakenedKnightState(role)! };
}
function attempt(result: DuelChoiceResult) {
  if (result.kind !== "attempt") throw new Error("literal_expected_attempt");
  return result;
}
test("两次Wolf尝试按同链记录且候选不暴露camp，原body提案不标死；null结束成功链", () => {
  const f = fixture(),
    boundary = {},
    first = openDuelBoundary(f.world, 1, 1, boundary)!;
  expect(duelBoundaryOptions(f.world, first)).toEqual({
    actorId: 1,
    day: 1,
    continuing: false,
    targetIds: [2, 3, 4, 5],
  });
  const a = attempt(commitDuelChoice(f.world, first, 2, () => true));
  expect(a.branch).toBe("wolf");
  expect(f.lives.every((l) => l.alive)).toBe(true);
  expect(paidDuelProposal(f.world, a.attempt).deaths).toEqual([2]);
  expect(openDuelBoundary(f.world, 1, 1, boundary, a.chain)).toBeNull();
  const next = openDuelBoundary(f.world, 1, 1, {}, a.chain)!;
  expect(duelBoundaryOptions(f.world, next)!.targetIds).toEqual([3, 4, 5]);
  expect(duelChoiceAllowed(f.world, next, 2)).toBe(false);
  const b = attempt(commitDuelChoice(f.world, next, 3, () => true));
  expect(b.chain).toBe(a.chain);
  const end = openDuelBoundary(f.world, 1, 1, {}, b.chain)!;
  expect(commitDuelChoice(f.world, end, null, () => true)).toEqual({
    kind: "ended",
    chain: a.chain,
  });
  expect(duelChainCurrent(f.world, a.chain)).toBe(false);
  expect(f.state().attempts).toEqual([
    { day: 1, chain: 1, targetId: 2, branch: "wolf" },
    { day: 1, chain: 1, targetId: 3, branch: "wolf" },
  ]);
});
test("普通null只谢绝同边界，误中原Good双方提案关闭链，下一边界保活骑士仍可新链但不能重挑旧号", () => {
  const f = fixture(),
    id = {},
    b = openDuelBoundary(f.world, 1, 1, id)!;
  expect(commitDuelChoice(f.world, b, null, () => true)).toEqual({ kind: "declined" });
  expect(f.state().attempts).toEqual([]);
  expect(openDuelBoundary(f.world, 1, 1, id)).toBeNull();
  const a = attempt(commitDuelChoice(f.world, openDuelBoundary(f.world, 1, 1, {})!, 4, () => true));
  expect(a.branch).toBe("good");
  expect(paidDuelProposal(f.world, a.attempt).deaths).toEqual([1, 4]);
  expect(duelChainCurrent(f.world, a.chain)).toBe(false);
  closeDuelChain(f.world, a.chain);
  f.world.addComponent(4, COMPONENT.Alive, createAliveComponent());
  const fresh = openDuelBoundary(f.world, 1, 2, {})!;
  expect(duelBoundaryOptions(f.world, fresh)!.targetIds).toEqual([2, 3, 5]);
  commitDuelChoice(f.world, fresh, 2, () => true);
  expect(f.state().attempts).toEqual([
    { day: 1, chain: 1, targetId: 4, branch: "good" },
    { day: 2, chain: 2, targetId: 2, branch: "wolf" },
  ]);
});
test.each(["actor", "target", "camp", "state", "deadline"] as const)(
  "未付%s撤权不记尝试、不生成正常ended",
  (mode) => {
    const f = fixture(),
      b = openDuelBoundary(f.world, 1, 1, {})!;
    expect(() =>
      commitDuelChoice(f.world, b, 2, () => {
        if (mode === "actor") f.world.addComponent(1, COMPONENT.Alive, createAliveComponent());
        if (mode === "target") f.world.addComponent(2, COMPONENT.Alive, createAliveComponent());
        if (mode === "camp") f.world.addComponent(2, COMPONENT.Camp, { camp: Camp.Good });
        if (mode === "state")
          Object.defineProperty(f.role.privateState, "awakenedKnight", {
            value: structuredClone(f.state()),
          });
        return mode !== "deadline";
      }),
    ).toThrow("awakened_duel_choice_revoked");
    expect(f.state().attempts).toEqual([]);
    closeDuelBoundary(b);
    expect(duelBoundaryCurrent(f.world, b)).toBe(false);
  },
);
test("末target查询同步撤换actor后稳定付款拒绝；反方向交换也在首写前拒绝", () => {
  for (const reverse of [false, true]) {
    const f = fixture(),
      b = openDuelBoundary(f.world, 1, 1, {})!,
      get = f.world.getComponent.bind(f.world);
    let armed = false,
      swapped = false;
    f.world.getComponent = ((id, name) => {
      const result = get(id, name);
      if (armed && !swapped && id === (reverse ? 1 : 2) && name === COMPONENT.Camp) {
        swapped = true;
        f.world.addComponent(reverse ? 2 : 1, COMPONENT.Alive, createAliveComponent());
      }
      return result;
    }) as typeof f.world.getComponent;
    expect(() =>
      commitDuelChoice(f.world, b, 2, () => {
        armed = true;
        return true;
      }),
    ).toThrow("awakened_duel_choice_revoked");
    expect(swapped).toBe(true);
    expect(f.state().attempts).toEqual([]);
  }
});
test("beforeWrite同步付款另一目标只保内层真实前缀，外层旧next不覆盖；取消成功链保原尝试", () => {
  const f = fixture(),
    b = openDuelBoundary(f.world, 1, 1, {})!;
  let paid: ReturnType<typeof attempt>;
  expect(() =>
    commitDuelChoice(f.world, b, 2, () => {
      paid = attempt(commitDuelChoice(f.world, b, 3, () => true));
      return true;
    }),
  ).toThrow("awakened_duel_choice_revoked");
  expect(f.state().attempts).toEqual([{ day: 1, chain: 1, targetId: 3, branch: "wolf" }]);
  closeDuelChain(f.world, paid!.chain);
  expect(duelChainCurrent(f.world, paid!.chain)).toBe(false);
  expect(paidDuelProposal(f.world, paid!.attempt).targetId).toBe(3);
});
test("JSON复制状态和链不重建运行许可，原槽被观察撤权后恢复仍不复活", () => {
  const f = fixture(),
    b = openDuelBoundary(f.world, 1, 1, {})!,
    original = f.state();
  Object.defineProperty(f.role.privateState, "awakenedKnight", {
    value: structuredClone(original),
  });
  expect(duelBoundaryCurrent(f.world, b)).toBe(false);
  Object.defineProperty(f.role.privateState, "awakenedKnight", { value: original });
  expect(duelBoundaryCurrent(f.world, b)).toBe(false);
  const other = fixture(),
    a = attempt(
      commitDuelChoice(other.world, openDuelBoundary(other.world, 1, 1, {})!, 2, () => true),
    );
  expect(() => openDuelBoundary(other.world, 1, 1, {}, structuredClone(a.chain))).toThrow(
    "awakened_duel_chain_invalid",
  );
  expect(() => paidDuelProposal(other.world, structuredClone(a.attempt))).toThrow(
    "awakened_duel_attempt_invalid",
  );
});
