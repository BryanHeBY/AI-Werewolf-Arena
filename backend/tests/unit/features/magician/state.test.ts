/**
 * 单元测试验证魔术师原状态校验与脱离知识边界；输入为原内存 fixture、数据 descriptor、
 * 明确非法修改和 Proxy。原引用／历史／字面拒绝断言作为预期，不在迁移中重新生成。
 * 只调用原 reader／projection，不运行整局、模型或物理传输；旧样本／标题与状态政策保持；当前Camp改用显式夹具来源，新增一条独立输入风险。
 */
import { expect, test } from "bun:test";
import { scholarMentorStateForRole } from "../../../../src/features/scholar-mentor/ports";
import type { CampComponent } from "../../../../src/domain/components/camp";
import { Camp, type Role, type RoleComponent } from "../../../../src/domain";
import {
  createMagicianState,
  getMagicianState,
  projectMagicianState,
} from "../../../../src/features/magician/state-slot";
function fixture(firstNight: 1 | 2 = 1) {
  const state = createMagicianState(firstNight);
  const role = {
    role: "magician" as Role,
    privateState: { magician: state },
    renderPrompt: () => "",
  } as RoleComponent;
  const camp = { camp: Camp.Good };
  return { state, role, camp, currentCamp: () => camp };
}
for (const firstNight of [1, 2] as const)
  test("Magician state owns one-use seats and detached history/" + firstNight, () => {
    const f = fixture(firstNight);
    expect(getMagicianState(f.role, f.currentCamp)).toBe(f.state);
    f.state.history.push(
      { day: firstNight, pair: [1, 2] },
      { day: firstNight + 1, pair: null },
      { day: firstNight + 2, pair: [3, 4] },
    );
    const view = projectMagicianState(f.role, f.currentCamp)!;
    expect(view).toEqual(f.state);
    expect(view).not.toBe(f.state);
    view.history[0]!.pair![0] = 99;
    expect(f.state.history[0]!.pair).toEqual([1, 2]);
  });
test("Magician state rejects reused seats, duplicate days, wrong camp and pre-activation choices", () => {
  const f = fixture(2);
  f.state.history.push({ day: 1, pair: null });
  expect(getMagicianState(f.role, f.currentCamp)).toBeUndefined();
  f.state.history = [
    { day: 2, pair: [1, 2] },
    { day: 3, pair: [2, 3] },
  ];
  expect(getMagicianState(f.role, f.currentCamp)).toBeUndefined();
  f.state.history = [
    { day: 2, pair: null },
    { day: 2, pair: [3, 4] },
  ];
  expect(getMagicianState(f.role, f.currentCamp)).toBeUndefined();
  f.state.history = [{ day: 2, pair: [2, 1] }];
  expect(getMagicianState(f.role, f.currentCamp)).toBeUndefined();
  f.state.history = [];
  f.camp.camp = Camp.Wolf;
  expect(getMagicianState(f.role, f.currentCamp)).toBeUndefined();
});
test("Magician state refuses getters and proxies without invoking them", () => {
  const f = fixture();
  let reads = 0;
  Object.defineProperty(f.state, "firstNight", {
    get() {
      reads++;
      throw new Error("must_not_read");
    },
  });
  expect(getMagicianState(f.role, f.currentCamp)).toBeUndefined();
  expect(reads).toBe(0);
  const g = fixture();
  (g.role.privateState as Record<string, unknown>).magician = new Proxy(g.state, {
    ownKeys() {
      reads++;
      throw new Error("must_not_trap");
    },
  });
  expect(getMagicianState(g.role, g.currentCamp)).toBeUndefined();
  expect(reads).toBe(0);
  const h = fixture();
  Object.defineProperty(h.state.history, "0", {
    get() {
      reads++;
      throw new Error("must_not_read");
    },
  });
  expect(getMagicianState(h.role, h.currentCamp)).toBeUndefined();
  expect(reads).toBe(0);
});

test("Magician projection avoids inherited constructor and revoked proxies", () => {
  const f = fixture();
  f.state.history.push({ day: 1, pair: [1, 2] });
  let reads = 0;
  const prototype = Object.create(Array.prototype);
  Object.defineProperty(prototype, "constructor", {
    get() {
      reads++;
      throw new Error("must_not_read_species");
    },
  });
  Object.setPrototypeOf(f.state.history, prototype);
  expect(projectMagicianState(f.role, f.currentCamp)?.history).toEqual([{ day: 1, pair: [1, 2] }]);
  expect(reads).toBe(0);
  const p = Proxy.revocable([], {});
  p.revoke();
  Object.defineProperty(f.state, "history", { value: p.proxy });
  expect(() => getMagicianState(f.role, f.currentCamp)).not.toThrow();
  expect(getMagicianState(f.role, f.currentCamp)).toBeUndefined();
});

for (const policy of ["original", "exchanged"] as const)
  test("Magician state retains explicit death shot mapping policy/" + policy, () => {
    const f = fixture();
    f.state.deathShotTargetPolicy = policy;
    expect(projectMagicianState(f.role, f.currentCamp)?.deathShotTargetPolicy).toBe(policy);
    Object.defineProperty(f.state, "deathShotTargetPolicy", { value: "implicit" });
    expect(getMagicianState(f.role, f.currentCamp)).toBeUndefined();
  });
test("Magician reader rejects own constructor accessors without executing them", () => {
  const f = fixture();
  let reads = 0;
  Object.defineProperty(f.state.history, "constructor", {
    get() {
      reads++;
      throw new Error("must_not_execute");
    },
  });
  expect(getMagicianState(f.role, f.currentCamp)).toBeUndefined();
  expect(reads).toBe(0);
});

// 新通道直接由夹具持有，不使用Role索引／旧参数桥；具体函数仍各按原短路和own-data政策读取。
test("explicit Camp sources preserve lazy value comparison own data width and Scholar unconditional lookup", () => {
  const f = fixture(),
    reads: string[] = [];
  let current: CampComponent | undefined = f.camp;
  const source = () => {
    reads.push("source");
    return current;
  };
  expect(getMagicianState(f.role, source)).toBe(f.state);
  current = { camp: Camp.Good };
  expect(getMagicianState(f.role, source)).toBe(f.state);
  current.camp = Camp.Wolf;
  expect(getMagicianState(f.role, source)).toBeUndefined();
  let accessorReads = 0;
  current = Object.defineProperty({}, "camp", {
    get() {
      accessorReads++;
      return Camp.Good;
    },
  }) as CampComponent;
  expect(getMagicianState(f.role, source)).toBeUndefined();
  expect(accessorReads).toBe(0);
  current = Object.defineProperty({}, "camp", {
    value: Camp.Good,
    writable: false,
    enumerable: false,
  }) as CampComponent;
  expect(getMagicianState(f.role, source)).toBe(f.state);
  reads.length = 0;
  expect(getMagicianState({ ...f.role, role: "villager" as Role }, source)).toBeUndefined();
  expect(reads).toEqual([]);
  expect(scholarMentorStateForRole(undefined, source)).toBeUndefined();
  expect(reads).toEqual(["source"]);
  const failure = new Error("literal_new_camp_source_failure");
  expect(() =>
    scholarMentorStateForRole(undefined, () => {
      throw failure;
    }),
  ).toThrow(failure);
});
