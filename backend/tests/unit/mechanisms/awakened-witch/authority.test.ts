/**
 * 负责觉醒女巫三轮秘密协作授权的字面单元测试；输入为最小真实World与手工决定，
 * 预期来自冻结规则卡的资源/一致性表，不运行生产策略作为oracle。
 * 核首次付款、明确否决、失败半成品、原体撤权与恶意重入，不以DTO重建权限。
 */
import { expect, test } from "bun:test";
import { Camp, Role } from "@ai-werewolf-arena/game-contract";
import {
  AWAKENED_WITCH_ROLE_ID,
  awakenedWitchResources,
} from "@ai-werewolf-arena/game-contract/facts/awakened-witch";
import { World } from "../../../../src/domain/world";
import { COMPONENT } from "../../../../src/domain/components/names";
import { createAliveComponent } from "../../../../src/domain/components/alive";
import { createRoleComponent } from "../../../../src/domain/components/role";
import { createCampComponent } from "../../../../src/domain/components/camp";
import {
  initializeAwakenedWitchState,
  getAwakenedWitchState,
} from "../../../../src/features/awakened-witch/state";
import {
  openAwakenedWitchNight,
  closeAwakenedWitchNight,
  awakenedWitchNightCurrent,
  awakenedWitchOptions,
  awakenedBrewAllowed,
  commitAwakenedBrew,
  awakenedBrewParticipants,
  awakenedBrewDiscussionCurrent,
  awakenedBrewApprovalCurrent,
  commitBrewDiscussion,
  commitBrewApproval,
  finalizeAwakenedBrew,
  prepareAwakenedBrewPoisonScope,
} from "../../../../src/features/awakened-witch/authority";
const yes = () => true;
function fixture() {
  const world = new World();
  for (let id = 1; id <= 12; id++) {
    world.createEntity();
    const role = createRoleComponent(
      id === 1 ? (AWAKENED_WITCH_ROLE_ID as Role) : id > 8 ? Role.Wolf : Role.Villager,
    );
    if (id === 1) initializeAwakenedWitchState(role);
    world.addComponent(id, COMPONENT.Role, role);
    world.addComponent(id, COMPONENT.Camp, createCampComponent(id > 8 ? Camp.Wolf : Camp.Good));
    world.addComponent(id, COMPONENT.Alive, createAliveComponent());
  }
  return world;
}
function state(w: World) {
  return getAwakenedWitchState(w.getComponent(1, COMPONENT.Role))!;
}
function brew(w: World, day: number, targetId: number, assistantIds: number[]) {
  openAwakenedWitchNight(w, 1, day, 2);
  commitAwakenedBrew(w, 1, day, { mode: "poison", targetId, assistantIds }, yes);
}
function discuss(w: World, day: number, ids: number[]) {
  for (const id of ids) commitBrewDiscussion(w, id, day, id === 3 ? "" : "private-" + id, yes);
}
test("原槽唯一安装且嵌套历史冻结，访问器与预占undefined均不补装", () => {
  const role = createRoleComponent(AWAKENED_WITCH_ROLE_ID as Role);
  initializeAwakenedWitchState(role);
  expect(() => initializeAwakenedWitchState(role)).toThrow();
  expect(Object.isFrozen(getAwakenedWitchState(role)!.nights)).toBe(true);
  const occupied = createRoleComponent(AWAKENED_WITCH_ROLE_ID as Role);
  Object.defineProperty(occupied.privateState, "awakenedWitch", { value: undefined });
  expect(() => initializeAwakenedWitchState(occupied)).toThrow();
  let reads = 0;
  const accessor = createRoleComponent(AWAKENED_WITCH_ROLE_ID as Role);
  Object.defineProperty(accessor, "privateState", {
    get() {
      reads++;
      throw Error("no-read");
    },
  });
  expect(getAwakenedWitchState(accessor)).toBeUndefined();
  expect(() => initializeAwakenedWitchState(accessor)).toThrow();
  expect(reads).toBe(0);
});
test("三轮分别需1/2/3名新协助者；否决照耗并且最终只生成两次毒资格", () => {
  const w = fixture();
  brew(w, 1, 9, [3]);
  discuss(w, 1, [3]);
  expect(prepareAwakenedBrewPoisonScope(w, 1)!.isCurrent()).toBe(false);
  commitBrewApproval(w, 3, 1, true, yes);
  expect(finalizeAwakenedBrew(w, 1, yes)).toBe("poison");
  expect(prepareAwakenedBrewPoisonScope(w, 1)!.isCurrent()).toBe(true);
  closeAwakenedWitchNight(w);
  brew(w, 2, 8, [5, 4]);
  expect(awakenedBrewParticipants(w, 2)).toEqual({ ordinal: 2, targetId: 8, assistantIds: [4, 5] });
  discuss(w, 2, [4, 5]);
  commitBrewApproval(w, 5, 2, false, yes);
  commitBrewApproval(w, 4, 2, true, yes);
  expect(finalizeAwakenedBrew(w, 2, yes)).toBe("vetoed");
  expect(prepareAwakenedBrewPoisonScope(w, 2)!.isCurrent()).toBe(false);
  closeAwakenedWitchNight(w);
  brew(w, 3, 1, [8, 6, 7]);
  discuss(w, 3, [6, 7, 8]);
  for (const id of [8, 6, 7]) commitBrewApproval(w, id, 3, true, yes);
  expect(finalizeAwakenedBrew(w, 3, yes)).toBe("poison");
  closeAwakenedWitchNight(w);
  openAwakenedWitchNight(w, 1, 4, 2);
  expect(awakenedWitchResources(state(w))).toEqual({
    healRemaining: 1,
    brewRemaining: 0,
    usedAssistantIds: [3, 4, 5, 6, 7, 8],
  });
  expect(awakenedWitchOptions(w, 1, 4)!.canPoison).toBe(false);
  expect(
    awakenedBrewAllowed(w, 1, 4, { mode: "poison", targetId: 9, assistantIds: [2, 10, 11, 12] }),
  ).toBe(false);
  expect(
    state(w).nights.map((n) => (n.mode === "poison" ? [n.ordinal, n.outcome] : n.mode)),
  ).toEqual([
    [1, "poison"],
    [2, "vetoed"],
    [3, "poison"],
  ]);
});
test("明确空过零资源；解药仅基础刀口且不能自救，用后不再暴露刀口", () => {
  const w = fixture();
  openAwakenedWitchNight(w, 1, 1, 1);
  expect(awakenedWitchOptions(w, 1, 1)!.canHeal).toBe(false);
  expect(awakenedBrewAllowed(w, 1, 1, { mode: "heal", targetId: 1, assistantIds: [] })).toBe(false);
  commitAwakenedBrew(w, 1, 1, { mode: "pass", targetId: null, assistantIds: [] }, yes);
  closeAwakenedWitchNight(w);
  openAwakenedWitchNight(w, 1, 2, 2);
  expect(awakenedBrewAllowed(w, 1, 2, { mode: "heal", targetId: 3, assistantIds: [] })).toBe(false);
  commitAwakenedBrew(w, 1, 2, { mode: "heal", targetId: 2, assistantIds: [] }, yes);
  closeAwakenedWitchNight(w);
  openAwakenedWitchNight(w, 1, 3, 3);
  expect(awakenedWitchOptions(w, 1, 3)!.wolfTarget).toBeUndefined();
  expect(awakenedWitchOptions(w, 1, 3)!.canHeal).toBe(false);
  expect(awakenedWitchResources(state(w)).brewRemaining).toBe(3);
});
test("曾参与者和本人不可协助；只剩两新活协助者时第三轮不缩编", () => {
  const w = fixture();
  brew(w, 1, 9, [3]);
  discuss(w, 1, [3]);
  commitBrewApproval(w, 3, 1, false, yes);
  finalizeAwakenedBrew(w, 1, yes);
  closeAwakenedWitchNight(w);
  openAwakenedWitchNight(w, 1, 2, null);
  for (const ids of [[3, 4], [1, 4], [4, 4], [4]])
    expect(awakenedBrewAllowed(w, 1, 2, { mode: "poison", targetId: 9, assistantIds: ids })).toBe(
      false,
    );
  commitAwakenedBrew(w, 1, 2, { mode: "poison", targetId: 9, assistantIds: [4, 5] }, yes);
  discuss(w, 2, [4, 5]);
  for (const id of [4, 5]) commitBrewApproval(w, id, 2, false, yes);
  finalizeAwakenedBrew(w, 2, yes);
  closeAwakenedWitchNight(w);
  for (const id of [2, 8, 9, 10, 11, 12]) w.getComponent(id, COMPONENT.Alive)!.alive = false;
  openAwakenedWitchNight(w, 1, 3, null);
  expect(awakenedWitchOptions(w, 1, 3)!.assistantIds).toEqual([6, 7]);
  expect(awakenedWitchOptions(w, 1, 3)!.canPoison).toBe(false);
  expect(awakenedWitchResources(state(w)).brewRemaining).toBe(1);
});
for (const subject of ["actor", "target", "assistant", "deadline", "exception"] as const)
  test(`首写前${subject}失效不消费`, () => {
    const w = fixture();
    openAwakenedWitchNight(w, 1, 1, 2);
    const original = Error("original-owner-error");
    const act = () =>
      commitAwakenedBrew(w, 1, 1, { mode: "poison", targetId: 9, assistantIds: [3] }, () => {
        if (subject === "exception") throw original;
        if (subject === "deadline") return false;
        w.addComponent(
          subject === "actor" ? 1 : subject === "target" ? 9 : 3,
          COMPONENT.Alive,
          createAliveComponent(),
        );
        return true;
      });
    expect(act).toThrow(subject === "exception" ? original : "awakened_brew_revoked");
    expect(state(w).nights).toEqual([]);
  });
test("半成品关闭保留已消费资源与讨论，不伪装否决，不可重开或跨夜续接", () => {
  const w = fixture();
  brew(w, 1, 9, [3]);
  discuss(w, 1, [3]);
  closeAwakenedWitchNight(w);
  expect(awakenedWitchResources(state(w)).brewRemaining).toBe(2);
  expect(state(w).nights).toEqual([
    {
      day: 1,
      mode: "poison",
      ordinal: 1,
      targetId: 9,
      assistantIds: [3],
      discussions: [{ actorId: 3, text: "" }],
      approvals: [],
      outcome: "building",
    },
  ]);
  expect(() => openAwakenedWitchNight(w, 1, 1, 2)).toThrow();
  expect(() => openAwakenedWitchNight(w, 1, 2, 2)).toThrow();
  expect(awakenedBrewApprovalCurrent(w, 3, 1)).toBe(false);
});
test("讨论固定顺序、独立批准不暴露前票；重复决定不写，重入不能覆盖已付另一票", () => {
  const w = fixture();
  brew(w, 1, 9, [3]);
  discuss(w, 1, [3]);
  commitBrewApproval(w, 3, 1, true, yes);
  finalizeAwakenedBrew(w, 1, yes);
  closeAwakenedWitchNight(w);
  brew(w, 2, 10, [4, 5]);
  expect(awakenedBrewDiscussionCurrent(w, 5, 2)).toBe(false);
  expect(() => commitBrewApproval(w, 4, 2, true, yes)).toThrow();
  discuss(w, 2, [4, 5]);
  expect(() =>
    commitBrewApproval(w, 4, 2, true, () => {
      commitBrewApproval(w, 5, 2, false, yes);
      return true;
    }),
  ).toThrow("awakened_brew_revoked");
  expect((state(w).nights[1] as { approvals: unknown }).approvals).toEqual([
    { actorId: 5, approve: false },
  ]);
  commitBrewApproval(w, 4, 2, true, yes);
  expect(() => commitBrewApproval(w, 4, 2, false, yes)).toThrow();
  expect(awakenedBrewParticipants(w, 2)).toEqual({
    ordinal: 2,
    targetId: 10,
    assistantIds: [4, 5],
  });
});
for (const id of [1, 3, 9])
  test(`已收全同意后原${id}号换体使最后Poison首写失败`, () => {
    const w = fixture();
    brew(w, 1, 9, [3]);
    discuss(w, 1, [3]);
    commitBrewApproval(w, 3, 1, true, yes);
    expect(() =>
      finalizeAwakenedBrew(w, 1, () => {
        w.addComponent(id, COMPONENT.Alive, createAliveComponent());
        return true;
      }),
    ).toThrow("awakened_brew_revoked");
    expect((state(w).nights[0] as { outcome: string }).outcome).toBe("building");
    expect(prepareAwakenedBrewPoisonScope(w, 1)!.isCurrent()).toBe(false);
  });
test("已付毒闭窗后仍有效，协助者死亡不撤毒；原施者首次死亡有效，复活或目标换体无效", () => {
  const w = fixture();
  brew(w, 1, 9, [3]);
  discuss(w, 1, [3]);
  commitBrewApproval(w, 3, 1, true, yes);
  finalizeAwakenedBrew(w, 1, yes);
  const effect = prepareAwakenedBrewPoisonScope(w, 1)!;
  closeAwakenedWitchNight(w);
  w.getComponent(3, COMPONENT.Alive)!.alive = false;
  expect(effect.isCurrent()).toBe(true);
  w.getComponent(1, COMPONENT.Alive)!.alive = false;
  expect(effect.isCurrent()).toBe(true);
  w.getComponent(1, COMPONENT.Alive)!.alive = true;
  expect(effect.isCurrent()).toBe(false);
});
test("状态同形clone、角色容器访问器都不续旧权限且不执行getter", () => {
  const w = fixture();
  openAwakenedWitchNight(w, 1, 1, 2);
  const role = w.getComponent(1, COMPONENT.Role)!;
  Object.assign(role.privateState, { awakenedWitch: structuredClone(state(w)) });
  expect(awakenedWitchNightCurrent(w, 1, 1)).toBe(false);
  const w2 = fixture();
  openAwakenedWitchNight(w2, 1, 1, 2);
  let reads = 0;
  Object.defineProperty(w2.getComponent(1, COMPONENT.Role)!, "privateState", {
    get() {
      reads++;
      throw Error("no-read");
    },
  });
  expect(awakenedWitchNightCurrent(w2, 1, 1)).toBe(false);
  expect(reads).toBe(0);
});

for (const changed of [1, 9])
  test(`末协助者查询同步替换${changed}号原体，首付款稳定核两端后拒绝`, () => {
    const w = fixture();
    openAwakenedWitchNight(w, 1, 1, 2);
    const original = w.getComponent.bind(w);
    let armed = false,
      swapped = false;
    w.getComponent = ((id: number, name: (typeof COMPONENT)[keyof typeof COMPONENT]) => {
      const value = original(id, name);
      if (armed && !swapped && id === 3 && name === COMPONENT.Camp) {
        swapped = true;
        w.addComponent(changed, COMPONENT.Alive, createAliveComponent());
      }
      return value;
    }) as typeof w.getComponent;
    expect(() =>
      commitAwakenedBrew(w, 1, 1, { mode: "poison", targetId: 9, assistantIds: [3] }, () => {
        armed = true;
        return true;
      }),
    ).toThrow("awakened_brew_revoked");
    expect(swapped).toBe(true);
    expect(state(w).nights).toEqual([]);
  });
for (const changed of [1, 9])
  test(`最终协作首写的末查询同步替换${changed}号，资源前缀保留且不造Poison`, () => {
    const w = fixture();
    brew(w, 1, 9, [3]);
    discuss(w, 1, [3]);
    commitBrewApproval(w, 3, 1, true, yes);
    const original = w.getComponent.bind(w);
    let armed = false,
      swapped = false;
    w.getComponent = ((id: number, name: (typeof COMPONENT)[keyof typeof COMPONENT]) => {
      const value = original(id, name);
      if (armed && !swapped && id === 3 && name === COMPONENT.Camp) {
        swapped = true;
        w.addComponent(changed, COMPONENT.Alive, createAliveComponent());
      }
      return value;
    }) as typeof w.getComponent;
    expect(() =>
      finalizeAwakenedBrew(w, 1, () => {
        armed = true;
        return true;
      }),
    ).toThrow("awakened_brew_revoked");
    expect(swapped).toBe(true);
    expect((state(w).nights[0] as { outcome: string }).outcome).toBe("building");
  });
test("已观察换体和换槽撤权后，恢复原引用也不能续原许可", () => {
  const w = fixture();
  openAwakenedWitchNight(w, 1, 1, 2);
  const life = w.getComponent(9, COMPONENT.Alive)!;
  w.addComponent(9, COMPONENT.Alive, createAliveComponent());
  expect(awakenedWitchOptions(w, 1, 1)!.targetIds).not.toContain(9);
  w.addComponent(9, COMPONENT.Alive, life);
  expect(awakenedWitchOptions(w, 1, 1)!.targetIds).not.toContain(9);
  const role = w.getComponent(1, COMPONENT.Role)!,
    original = state(w);
  Object.assign(role.privateState, { awakenedWitch: structuredClone(original) });
  expect(awakenedWitchNightCurrent(w, 1, 1)).toBe(false);
  Object.assign(role.privateState, { awakenedWitch: original });
  expect(awakenedWitchNightCurrent(w, 1, 1)).toBe(false);
});
