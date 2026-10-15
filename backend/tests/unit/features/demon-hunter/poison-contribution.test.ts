/**
 * 单元测试验证 demon-hunter 的独立 poison-contribution.test 契约。输入为既有内存 fixture、原回调控制和明确非法
 * 修改；原字面预期、身份快照及拒绝断言是预期，不在迁移中重新生成。仅调用原生内存
 * owner／frame／reader，测试自有 mock／组件不运行完整对局、模型或真实传输，support／fixture 字节及政策状态不变。
 */
import { createStatusMarksComponent } from "../../../../src/game/observation/component-presentation";
import { expect, test } from "bun:test";
import { World, COMPONENT, StatusMark } from "../../../../src/domain";
import {
  StatusMarksComponent,
  statusMarkSnapshot,
} from "../../../../src/domain/components/status-marks";
import {
  openNativePoisonContribution,
  commitNativePoisonContribution,
  sealNativePoisonContribution,
} from "../../../../src/game/mechanisms/roles/demon_hunter/poison_contribution";
function fixture(initial: StatusMark[] = []) {
  const world = new World(),
    id = world.createEntity(),
    marks = new StatusMarksComponent(initial);
  world.addComponent(id, COMPONENT.StatusMarks, marks);
  return { world, id, marks };
}
test("native mark has its own actual contribution; inspection does not consume marks", () => {
  const f = fixture(),
    scope = openNativePoisonContribution(f.world, f.id, f.marks);
  f.marks.add(StatusMark.PoisonMark);
  commitNativePoisonContribution(scope);
  expect(sealNativePoisonContribution(scope)).toEqual({ native: true, unknown: false });
  expect(f.marks.values()).toEqual([StatusMark.PoisonMark]);
  expect(() => sealNativePoisonContribution(scope)).toThrow();
});
for (const at of ["before", "after"] as const)
  test(`an unknown toxin ${at} native poison survives independent contribution classification`, () => {
    const f = fixture();
    if (at === "before") f.marks.add(StatusMark.PoisonMark);
    const scope = openNativePoisonContribution(f.world, f.id, f.marks);
    f.marks.add(StatusMark.PoisonMark);
    commitNativePoisonContribution(scope);
    if (at === "after") f.marks.add(StatusMark.PoisonMark);
    expect(sealNativePoisonContribution(scope)).toEqual({ native: at === "before", unknown: true });
  });
test("unrelated protection writes cannot impersonate a toxin or revoke the original contribution", () => {
  const f = fixture(),
    scope = openNativePoisonContribution(f.world, f.id, f.marks);
  f.marks.add(StatusMark.PoisonMark);
  commitNativePoisonContribution(scope);
  f.marks.add(StatusMark.GuardMark);
  f.marks.add(StatusMark.HealMark);
  expect(sealNativePoisonContribution(scope)).toEqual({ native: true, unknown: false });
});
for (const kind of ["remove", "clear", "replace", "readd"] as const)
  test(`${kind} classifies only actual present contributions`, () => {
    const f = fixture(),
      scope = openNativePoisonContribution(f.world, f.id, f.marks);
    f.marks.add(StatusMark.PoisonMark);
    commitNativePoisonContribution(scope);
    if (kind === "remove" || kind === "readd") f.marks.remove(StatusMark.PoisonMark);
    if (kind === "clear") f.marks.clear();
    if (kind === "replace") {
      const marks = createStatusMarksComponent();
      marks.add(StatusMark.PoisonMark);
      f.world.addComponent(f.id, COMPONENT.StatusMarks, marks);
    }
    if (kind === "readd") f.marks.add(StatusMark.PoisonMark);
    expect(sealNativePoisonContribution(scope)).toEqual({
      native: false,
      unknown: kind === "replace" || kind === "readd",
    });
  });
for (const kind of ["none", "two", "replacement"] as const)
  test(`${kind} is not one trusted native add`, () => {
    const f = fixture(),
      scope = openNativePoisonContribution(f.world, f.id, f.marks);
    if (kind !== "none") f.marks.add(StatusMark.PoisonMark);
    if (kind === "two") f.marks.add(StatusMark.PoisonMark);
    if (kind === "replacement")
      f.world.addComponent(f.id, COMPONENT.StatusMarks, createStatusMarksComponent());
    expect(() => commitNativePoisonContribution(scope)).toThrow();
  });
test("initial native-class poison is already an unknown source before this claim", () => {
  const f = fixture([StatusMark.PoisonMark]),
    scope = openNativePoisonContribution(f.world, f.id, f.marks);
  f.marks.add(StatusMark.PoisonMark);
  commitNativePoisonContribution(scope);
  expect(sealNativePoisonContribution(scope)).toEqual({ native: true, unknown: true });
});
for (const kind of ["getter", "proxy"] as const)
  test(`${kind} mark storage is rejected without foreign execution`, () => {
    const f = fixture();
    let reads = 0;
    let component: unknown = f.marks;
    if (kind === "getter")
      Object.defineProperty(f.marks, "marks", {
        get() {
          reads++;
          return new Set();
        },
      });
    else
      component = new Proxy(f.marks, {
        getOwnPropertyDescriptor() {
          reads++;
          return undefined;
        },
        getPrototypeOf() {
          reads++;
          return null;
        },
      });
    expect(statusMarkSnapshot(component, StatusMark.PoisonMark)).toBeNull();
    expect(reads).toBe(0);
  });
test("forged data cannot manufacture a factory revision", () => {
  expect(
    statusMarkSnapshot({ marks: new Set([StatusMark.PoisonMark]) }, StatusMark.PoisonMark),
  ).toBeNull();
  expect(() => commitNativePoisonContribution({})).toThrow();
  expect(() => sealNativePoisonContribution({})).toThrow();
});
test("a sealed snapshot survives the later ordinary damage clear", () => {
  const f = fixture(),
    scope = openNativePoisonContribution(f.world, f.id, f.marks);
  f.marks.add(StatusMark.PoisonMark);
  commitNativePoisonContribution(scope);
  const result = sealNativePoisonContribution(scope);
  f.marks.clear();
  expect(result).toEqual({ native: true, unknown: false });
  expect(f.marks.values()).toEqual([]);
});

test("raw native Set storage is inaccessible between capture and commit", () => {
  const f = fixture(),
    scope = openNativePoisonContribution(f.world, f.id, f.marks);
  expect(Object.getOwnPropertyDescriptor(f.marks, "marks")).toBeUndefined();
  expect(Object.values(f.marks).some((value) => value instanceof Set)).toBe(false);
  const foreign = new Set<StatusMark>();
  Set.prototype.add.call(foreign, StatusMark.PoisonMark);
  expect(() => commitNativePoisonContribution(scope)).toThrow(
    "demon_hunter_poison_mark_commit_invalid",
  );
  f.marks.add(StatusMark.PoisonMark);
  commitNativePoisonContribution(scope);
  expect(sealNativePoisonContribution(scope)).toEqual({ native: true, unknown: false });
});
test("delete/readd on an external Set cannot replace a sealed original native contribution", () => {
  const f = fixture(),
    scope = openNativePoisonContribution(f.world, f.id, f.marks);
  f.marks.add(StatusMark.PoisonMark);
  commitNativePoisonContribution(scope);
  expect(Object.getOwnPropertyDescriptor(f.marks, "marks")).toBeUndefined();
  const foreign = new Set([StatusMark.PoisonMark]);
  Set.prototype.delete.call(foreign, StatusMark.PoisonMark);
  Set.prototype.add.call(foreign, StatusMark.PoisonMark);
  expect(sealNativePoisonContribution(scope)).toEqual({ native: true, unknown: false });
});
test("a foreign Set shadow cannot run add accessors or lend factory revision", () => {
  const f = fixture(),
    foreign = new Set<StatusMark>();
  let reads = 0;
  Object.defineProperty(foreign, "add", {
    get() {
      reads++;
      return Set.prototype.add;
    },
  });
  Object.defineProperty(f.marks, "marks", { value: foreign });
  f.marks.add(StatusMark.PoisonMark);
  expect(f.marks.has(StatusMark.PoisonMark)).toBe(true);
  expect(foreign.size).toBe(0);
  expect(statusMarkSnapshot(f.marks, StatusMark.PoisonMark)).toBeNull();
  expect(reads).toBe(0);
});
test("replacing the legacy-looking Set delete method cannot simulate one actual add", () => {
  const f = fixture(),
    scope = openNativePoisonContribution(f.world, f.id, f.marks),
    foreign = new Set([StatusMark.PoisonMark]);
  Object.defineProperty(foreign, "delete", { value: () => true });
  Object.defineProperty(f.marks, "marks", { value: foreign });
  f.marks.remove(StatusMark.PoisonMark);
  expect(f.marks.has(StatusMark.PoisonMark)).toBe(false);
  expect(() => commitNativePoisonContribution(scope)).toThrow(
    "demon_hunter_poison_mark_commit_invalid",
  );
});
