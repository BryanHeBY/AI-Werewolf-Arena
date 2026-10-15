/**
 * 单元测试负责 F05b 开局的真实 Camp 输入和默认／自定义胜利归属边界。
 * 输入为合法六人固定牌组、同一可写 draft 和局部安装／读取探针；引用、字面读取轨迹及错误是独立预期。
 * 只同步装配 bootstrap，不推进阶段或模型；默认 Catalog 属性与 World 方法在 finally 按原 descriptor 恢复。
 */
import { expect, test } from "bun:test";
import { bootstrapGame } from "../../../src/app/bootstrap";
import { COMPONENT } from "../../../src/domain/components/names";
import type { CampComponent } from "../../../src/domain/components/camp";
import { Camp, Role } from "../../../src/domain/identity";
import { World } from "../../../src/domain/world";
import type { RoleInitContext, RoleRuntimeContribution } from "../../../src/game/mechanisms/roles/contracts";
import { getDefaultRoleCatalog } from "../../../src/game/mechanisms/roles/role-catalog-assembly";
import { sixPlayerMvpConfig } from "../../../src/runtime/scenarios/six_player_mvp";

const cards = [Role.Villager, Role.Wolf, Role.Wolf, Role.Seer, Role.Guard, Role.Villager];
const boot = () => bootstrapGame(sixPlayerMvpConfig, { fixedRoles: cards });

/** 只替换平民运行贡献的两个输入；不登记新角色，不保留跨案例的默认实例修改。 */
function withVillagerRuntime(
  input: Pick<RoleRuntimeContribution, "init" | "initialVictoryAffiliations">,
  run: () => void,
) {
  const runtime = getDefaultRoleCatalog().requireRuntime(Role.Villager);
  const keys = ["init", "initialVictoryAffiliations"] as const;
  const descriptors = keys.map((key) => Object.getOwnPropertyDescriptor(runtime, key));
  try {
    for (const key of keys)
      Object.defineProperty(runtime, key, { configurable: true, writable: true, value: input[key] });
    run();
  } finally {
    for (let index = 0; index < keys.length; index++) {
      const key = keys[index]!, descriptor = descriptors[index];
      if (descriptor) Object.defineProperty(runtime, key, descriptor);
      else delete runtime[key];
    }
  }
}

/** 探针只覆盖本次同步装配；抛错也恢复原 getter／method descriptor，不影响其它 fixture。 */
function withWorldMethods(
  add: typeof World.prototype.addComponent,
  get: typeof World.prototype.getComponent,
  run: () => void,
) {
  const addDescriptor = Object.getOwnPropertyDescriptor(World.prototype, "addComponent")!;
  const getDescriptor = Object.getOwnPropertyDescriptor(World.prototype, "getComponent")!;
  try {
    Object.defineProperty(World.prototype, "addComponent", { ...addDescriptor, value: add });
    Object.defineProperty(World.prototype, "getComponent", { ...getDescriptor, value: get });
    run();
  } finally {
    Object.defineProperty(World.prototype, "addComponent", addDescriptor);
    Object.defineProperty(World.prototype, "getComponent", getDescriptor);
  }
}

test("custom init installs its same Camp draft and default Victory uses the initialized value", () => {
  const contexts: RoleInitContext[] = [];
  const beforeInstall: Array<CampComponent | undefined> = [];
  withVillagerRuntime({
    init(_role, ctx) {
      contexts.push(ctx);
      // source 查实际 World，在 draft 安装前不能回退初始化对象。
      beforeInstall.push(ctx.currentCamp());
      ctx.initialCamp.camp = Camp.Wolf;
    },
  }, () => {
    const { world } = boot(), ctx = contexts[0]!;
    expect(beforeInstall).toEqual([undefined, undefined]);
    expect(contexts).toHaveLength(2);
    expect(world.getComponent(1, COMPONENT.Camp)).toBe(ctx.initialCamp);
    expect(ctx.currentCamp()).toBe(ctx.initialCamp);
    expect(world.getComponent(1, COMPONENT.Camp)?.camp).toBe(Camp.Wolf);
    expect(world.getComponent(1, COMPONENT.Victory)?.affiliations).toEqual([
      { kind: "faction", faction: "wolf" },
    ]);
    expect(world.getComponent(6, COMPONENT.Camp)).toBe(contexts[1]!.initialCamp);
  });
});

test("default Victory reads the installed Camp after the original Camp installation point", () => {
  const trace: string[] = [], replacement = { camp: Camp.ThirdParty };
  const add = World.prototype.addComponent, get = World.prototype.getComponent;
  let between = false;
  const install = new Proxy(add, {
    apply(target, world: World, args) {
      const result = Reflect.apply(target, world, args);
      if (args[0] === 1 && args[1] === COMPONENT.Camp) {
        trace.push("camp-installed");
        // 在实际安装点换成另一真实组件；默认归属必须晚读当前值，不能使用 draft 或 metadata。
        Reflect.apply(add, world, [1, COMPONENT.Camp, replacement]);
        between = true;
      } else if (args[0] === 1 && args[1] === COMPONENT.Victory) {
        trace.push("victory-installed");
        between = false;
      }
      return result;
    },
  });
  const query = new Proxy(get, {
    apply(target, world: World, args) {
      if (between && args[0] === 1 && args[1] === COMPONENT.Camp) trace.push("camp-read");
      return Reflect.apply(target, world, args);
    },
  });
  withVillagerRuntime({}, () => withWorldMethods(install, query, () => {
    const { world } = boot();
    expect(trace).toEqual(["camp-installed", "camp-read", "victory-installed"]);
    expect(world.getComponent(1, COMPONENT.Camp)).toBe(replacement);
    expect(world.getComponent(1, COMPONENT.Victory)?.affiliations).toEqual([
      { kind: "faction", faction: "third_party" },
    ]);
  }));
});

test("a missing installed Camp fails only the default Victory branch before its installation", () => {
  const trace: string[] = [];
  const add = World.prototype.addComponent, get = World.prototype.getComponent;
  let capturedWorld: World | undefined;
  const install = new Proxy(add, {
    apply(target, world: World, args) {
      const result = Reflect.apply(target, world, args);
      if (args[0] === 1 && args[1] === COMPONENT.Camp) {
        capturedWorld = world;
        trace.push("camp-installed");
        world.removeComponent(1, COMPONENT.Camp);
      } else if (args[0] === 1 && args[1] === COMPONENT.Victory) trace.push("victory-installed");
      return result;
    },
  });
  const query = new Proxy(get, {
    apply(target, world: World, args) {
      if (capturedWorld === world && args[0] === 1 && args[1] === COMPONENT.Camp)
        trace.push("camp-read");
      return Reflect.apply(target, world, args);
    },
  });
  withVillagerRuntime({}, () => withWorldMethods(install, query, () => {
    expect(boot).toThrow("role_current_camp_missing");
    expect(trace).toEqual(["camp-installed", "camp-read"]);
    // 默认分支拒绝保 Role 已装、Camp 已被探针移除的前缀，不伪造 Victory 或回滚。
    expect(capturedWorld!.getComponent(1, COMPONENT.Role)?.role).toBe(Role.Villager);
    expect(capturedWorld!.getComponent(1, COMPONENT.Victory)).toBeUndefined();
  }));
});

test("custom membership receives an independent worldless context without an extra Camp query", () => {
  const trace: string[] = [], initContexts: RoleInitContext[] = [], membershipContexts: RoleInitContext[] = [];
  const add = World.prototype.addComponent, get = World.prototype.getComponent;
  let between = false, draft: CampComponent | undefined;
  const install = new Proxy(add, {
    apply(target, world: World, args) {
      const result = Reflect.apply(target, world, args);
      if (args[0] === 1 && args[1] === COMPONENT.Camp) {
        draft = args[2];
        trace.push("camp-installed");
        world.removeComponent(1, COMPONENT.Camp);
        between = true;
      } else if (args[0] === 1 && args[1] === COMPONENT.Victory) {
        trace.push("victory-installed");
        between = false;
        // membership 已提交后恢复 fixture 组件，后续管理器仍装配合法六人 World。
        Reflect.apply(add, world, [1, COMPONENT.Camp, draft]);
      }
      return result;
    },
  });
  const query = new Proxy(get, {
    apply(target, world: World, args) {
      if (between && args[0] === 1 && args[1] === COMPONENT.Camp) trace.push("unexpected-camp-read");
      return Reflect.apply(target, world, args);
    },
  });
  withVillagerRuntime({
    init(_role, ctx) { initContexts.push(ctx); },
    initialVictoryAffiliations(_role, ctx) {
      membershipContexts.push(ctx);
      if (between) trace.push("custom-membership");
      return [{ kind: "faction", faction: "third_party" }];
    },
  }, () => withWorldMethods(install, query, () => {
    const { world } = boot(), init = initContexts[0]!, membership = membershipContexts[0]!;
    expect(trace).toEqual(["camp-installed", "custom-membership", "victory-installed"]);
    expect(membershipContexts).toHaveLength(2);
    expect(membership).not.toBe(init);
    expect(Object.keys(membership)).toEqual(["boardConfig", "locale", "initialCamp", "currentCamp"]);
    expect(membership.world).toBeUndefined();
    expect(membership.boardConfig).toBe(init.boardConfig);
    expect(membership.initialCamp).toBe(init.initialCamp);
    expect(membership.currentCamp).toBe(init.currentCamp);
    expect(membership.currentCamp()).toBe(world.getComponent(1, COMPONENT.Camp));
    expect(world.getComponent(1, COMPONENT.Victory)?.affiliations).toEqual([
      { kind: "faction", faction: "third_party" },
    ]);
  }));
});
