/**
 * 负责典狱长唯一库存、四格收益与原体撤权的字面单元验收。输入是最小真实World和手写决定，
 * 预期表独立写死，不从生产计算结果生成oracle；覆盖未完成决定的真实付款前缀。
 */
import { expect, test } from "bun:test";
import { Camp, Role } from "@ai-werewolf-arena/game-contract";
import { World } from "../../../../src/domain/world";
import { COMPONENT } from "../../../../src/domain/components/names";
import { createAliveComponent } from "../../../../src/domain/components/alive";
import { createRoleComponent } from "../../../../src/domain/components/role";
import { createCampComponent } from "../../../../src/domain/components/camp";
import { initializeWardenState, getWardenState } from "../../../../src/features/warden/state";
import {
  openWardenNight,
  closeWardenNight,
  wardenCandidates,
  commitWardenPair,
  commitWardenDecision,
  wardenDecisionCurrent,
  wardenOutcome,
  wardenEffectScopes,
  forcedWardenPartner,
} from "../../../../src/features/warden/authority";
import type { WardenDecision } from "@ai-werewolf-arena/game-contract/facts/warden";
function fixture() {
  const w = new World();
  for (const id of [1, 2, 3, 4]) {
    expect(w.createEntity()).toBe(id);
    const r = createRoleComponent(id === 1 ? Role.Warden : Role.Villager);
    if (id === 1) initializeWardenState(r);
    w.addComponent(id, COMPONENT.Role, r);
    w.addComponent(id, COMPONENT.Alive, createAliveComponent());
    w.addComponent(id, COMPONENT.Camp, createCampComponent(id === 1 ? Camp.Wolf : Camp.Good));
  }
  return w;
}
function pair(w: World, ids: readonly [number, number] = [2, 3]) {
  openWardenNight(w, 1, 2);
  commitWardenPair(w, 1, 2, ids, () => true);
}
for (const [a, b, outcome, deaths] of [
  ["trade", "trade", "protect", []],
  ["trade", "betray", "deal", [2]],
  ["betray", "trade", "deal", [3]],
  ["betray", "betray", "force", []],
] as const)
  test(`普通四格 ${a}/${b}`, () => {
    const w = fixture();
    pair(w);
    commitWardenDecision(w, 2, 2, a, () => true);
    expect(wardenOutcome(w, 2)).toBeNull();
    commitWardenDecision(w, 3, 2, b, () => true);
    closeWardenNight(w);
    expect(wardenOutcome(w, 2)).toEqual({
      actorId: 1,
      pair: [2, 3],
      choices: [a, b],
      outcome,
      dealIds: deaths,
    });
    expect(forcedWardenPartner(w, 2, 2)?.targetId ?? null).toBe(outcome === "force" ? 3 : null);
    expect(wardenEffectScopes(w, 2, "protect").map((s) => s.id)).toEqual(
      outcome === "protect" ? [2, 3] : [],
    );
  });
for (const [a, b, dead] of [
  ["trade", "trade", 1],
  ["trade", "betray", 2],
  ["betray", "trade", 2],
  ["betray", "betray", 1],
] as const)
  test(`自身四格 ${a}/${b}`, () => {
    const w = fixture();
    pair(w, [1, 2]);
    commitWardenDecision(w, 1, 2, a, () => true);
    commitWardenDecision(w, 2, 2, b, () => true);
    expect(wardenOutcome(w, 2)?.dealIds).toEqual([dead]);
    expect(wardenOutcome(w, 2)?.outcome).toBe("deal");
  });
test("N1无窗口；同日墓碑、活窗跨日期和旧日期均拒绝", () => {
  const w = fixture();
  expect(() => openWardenNight(w, 1, 1)).toThrow();
  openWardenNight(w, 1, 2);
  expect(() => openWardenNight(w, 1, 3)).toThrow();
  closeWardenNight(w);
  expect(() => openWardenNight(w, 1, 2)).toThrow();
  expect(() => openWardenNight(w, 1, 1)).toThrow();
  openWardenNight(w, 1, 3);
});
test("pair首写消耗双方，单个receipt在另一方失败后保留，下夜只剩未参与者", () => {
  const w = fixture();
  pair(w);
  commitWardenDecision(w, 2, 2, "trade", () => true);
  closeWardenNight(w);
  expect(wardenOutcome(w, 2)).toBeNull();
  expect(getWardenState(w.getComponent(1, COMPONENT.Role))!.history).toEqual([
    { day: 2, pair: [2, 3], decisions: [{ playerId: 2, choice: "trade" }], resolved: false },
  ]);
  openWardenNight(w, 1, 3);
  expect(wardenCandidates(w, 1, 3)).toEqual([1, 4]);
  expect(() => commitWardenPair(w, 1, 3, [2, 4], () => true)).toThrow();
});
test("null明确空过不消费参与者，决定不能冒用或重复付款", () => {
  const w = fixture();
  openWardenNight(w, 1, 2);
  commitWardenPair(w, 1, 2, null, () => true);
  expect(wardenDecisionCurrent(w, 2, 2)).toBe(false);
  closeWardenNight(w);
  openWardenNight(w, 1, 3);
  expect(wardenCandidates(w, 1, 3)).toEqual([1, 2, 3, 4]);
});
for (const revoke of ["deadline", "actor", "first", "second", "throw"] as const)
  test(`pair最后guard ${revoke}零消费`, () => {
    const w = fixture();
    openWardenNight(w, 1, 2);
    const sentinel = new Error("original_guard");
    const act = () =>
      commitWardenPair(w, 1, 2, [2, 3], () => {
        if (revoke === "throw") throw sentinel;
        if (revoke === "deadline") return false;
        w.addComponent(
          revoke === "actor" ? 1 : revoke === "first" ? 2 : 3,
          COMPONENT.Alive,
          createAliveComponent(),
        );
        return true;
      });
    if (revoke === "throw") expect(act).toThrow(sentinel);
    else expect(act).toThrow();
    expect(getWardenState(w.getComponent(1, COMPONENT.Role))!.history).toEqual([]);
  });
for (const id of [1, 2, 3])
  test(`pair末查询同步替换${id}号原体也不能付款`, () => {
    const w = fixture();
    openWardenNight(w, 1, 2);
    const originalGet = w.getComponent.bind(w),
      role = originalGet(1, COMPONENT.Role)!;
    let armed = false;
    w.getComponent = ((entity, name) => {
      const value = originalGet(entity, name);
      if (armed && entity === 3 && name === COMPONENT.Camp) {
        armed = false;
        w.addComponent(id, COMPONENT.Alive, createAliveComponent());
      }
      return value;
    }) as typeof w.getComponent;
    expect(() =>
      commitWardenPair(w, 1, 2, [2, 3], () => {
        armed = true;
        return true;
      }),
    ).toThrow("warden_pair_revoked");
    expect(getWardenState(role)!.history).toEqual([]);
  });
for (const id of [2, 3])
  test(`decide末查询同步替换${id}号不丢已付另一回执也不新增付款`, () => {
    const w = fixture();
    pair(w);
    commitWardenDecision(w, 2, 2, "trade", () => true);
    const originalGet = w.getComponent.bind(w),
      role = originalGet(1, COMPONENT.Role)!;
    let armed = false;
    w.getComponent = ((entity, name) => {
      const value = originalGet(entity, name);
      if (armed && entity === 3 && name === COMPONENT.Camp) {
        armed = false;
        w.addComponent(id, COMPONENT.Alive, createAliveComponent());
      }
      return value;
    }) as typeof w.getComponent;
    expect(() =>
      commitWardenDecision(w, 3, 2, "betray", () => {
        armed = true;
        return true;
      }),
    ).toThrow("warden_decision_revoked");
    expect(getWardenState(role)!.history).toEqual([
      { day: 2, pair: [2, 3], decisions: [{ playerId: 2, choice: "trade" }], resolved: false },
    ]);
  });
test("已付pair不依赖施者当前身份；参与者换体撤销而不退款", () => {
  const w = fixture();
  pair(w);
  w.addComponent(1, COMPONENT.Role, createRoleComponent(Role.Wolf));
  commitWardenDecision(w, 2, 2, "trade", () => true);
  commitWardenDecision(w, 3, 2, "trade", () => true);
  closeWardenNight(w);
  expect(wardenEffectScopes(w, 2, "protect").map((s) => s.id)).toEqual([2, 3]);
  w.addComponent(2, COMPONENT.Alive, createAliveComponent());
  expect(wardenEffectScopes(w, 2, "protect").map((s) => s.id)).toEqual([3]);
  expect(wardenEffectScopes(w, 3, "protect")).toEqual([]);
});
test("已付效果允许原目标首次死亡但拒复活与同号角色替换", () => {
  const w = fixture();
  pair(w);
  for (const id of [2, 3]) commitWardenDecision(w, id, 2, "trade", () => true);
  closeWardenNight(w);
  const life = w.getComponent(2, COMPONENT.Alive)!;
  life.alive = false;
  expect(wardenEffectScopes(w, 2, "protect").map((s) => s.id)).toEqual([2, 3]);
  life.alive = true;
  expect(wardenEffectScopes(w, 2, "protect").map((s) => s.id)).toEqual([3]);
});
test("单个decide最后guard撤目标生命不接受该回执", () => {
  const w = fixture();
  pair(w);
  commitWardenDecision(w, 2, 2, "betray", () => true);
  expect(() =>
    commitWardenDecision(w, 3, 2, "trade", () => {
      w.addComponent(3, COMPONENT.Alive, createAliveComponent());
      return true;
    }),
  ).toThrow();
  expect(getWardenState(w.getComponent(1, COMPONENT.Role))!.history[0]!.decisions).toEqual([
    { playerId: 2, choice: "betray" },
  ]);
});

test("付款前原privateState被改访问器时拒绝且零执行getter", () => {
  const w = fixture();
  openWardenNight(w, 1, 2);
  const role = w.getComponent(1, COMPONENT.Role)!,
    container = role.privateState;
  let reads = 0;
  Object.defineProperty(role, "privateState", {
    get() {
      reads++;
      return container;
    },
    configurable: true,
  });
  expect(() => commitWardenPair(w, 1, 2, [2, 3], () => true)).toThrow();
  expect(reads).toBe(0);
});

test("观察到目标原体失配后恢复旧引用也不复活已撤保护或force", () => {
  for (const choice of ["trade", "betray"] as const) {
    const w = fixture();
    pair(w);
    for (const id of [2, 3]) commitWardenDecision(w, id, 2, choice, () => true);
    closeWardenNight(w);
    const force = forcedWardenPartner(w, 2, 2),
      original = w.getComponent(2, COMPONENT.Alive)!;
    w.addComponent(2, COMPONENT.Alive, createAliveComponent());
    if (force) expect(force.isCurrent()).toBe(false);
    else expect(wardenEffectScopes(w, 2, "protect").map((s) => s.id)).toEqual([3]);
    w.addComponent(2, COMPONENT.Alive, original);
    if (force) expect(force.isCurrent()).toBe(false);
    else expect(wardenEffectScopes(w, 2, "protect").map((s) => s.id)).toEqual([3]);
  }
});

test("决定末查询重入另一方付款不丢其receipt，旧expected的外层提交拒绝", () => {
  const w = fixture();
  pair(w);
  expect(() =>
    commitWardenDecision(w, 2, 2, "trade", () => {
      commitWardenDecision(w, 3, 2, "betray", () => true);
      return true;
    }),
  ).toThrow("warden_decision_revoked");
  expect(getWardenState(w.getComponent(1, COMPONENT.Role))!.history[0]!.decisions).toEqual([
    { playerId: 3, choice: "betray" },
  ]);
  expect(wardenDecisionCurrent(w, 2, 2)).toBe(true);
});
