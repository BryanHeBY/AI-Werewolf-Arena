/**
 * 单元测试：验证角色容器读契约与显式自定义初始化。输入为字面角色、扩展记录和上下文 getter；原容器 descriptor、回调 this 与 trace 为预期。展示属性离开 domain 是明确 API 退出，其他记录仍可由具体 owner 写；编译负例不执行。
 */
import { createRoleCatalog } from "../../../src/rulesets/roles/role-catalog-assembly";
import { renderRolePrompt } from "../../../src/agents/observation/role-presentation";
import "../../../src/app/bootstrap";
import { expect, test } from "bun:test";
import { Camp, Role } from "@ai-werewolf-arena/game-contract";
import { type RoleComponent } from "../../../src/domain/components/role";
import { createRoleComponent } from "../../../src/agents/observation/role-presentation";
import { World } from "../../../src/domain/world";
import { RoleCatalog } from "../../../src/rulesets/roles/catalog";
import type { RoleProfile, RoleInitContext } from "../../../src/rulesets/roles/contracts";
import { setHunterState } from "../../../src/features/hunter/ports";

function ordinaryReaderCannotWrite(role: RoleComponent) {
  // @ts-expect-error 即使记录值合法，也不能替换只读私有容器。
  role.privateState = {};
  // @ts-expect-error 即使标量值合法，也不能经读视图写任意私有键。
  role.privateState.custom = 42;
  // @ts-expect-error 只读索引也拒绝删除私有键。
  delete role.privateState.custom;
}
void ordinaryReaderCannotWrite;

test("component factory keeps the original record, keys and writable runtime descriptor", () => {
  const role = createRoleComponent(Role.Villager),
    stored = role.privateState,
    descriptor = Object.getOwnPropertyDescriptor(role, "privateState")!;
  // C36 的明确 API 退出：展示闭包离开领域组件，当前Camp转独立显式来源；容器descriptor保持原样。
  expect(Object.keys(role)).toEqual(["role", "privateState"]);
  expect(Object.getPrototypeOf(role)).toBe(Object.prototype);
  expect(Object.getPrototypeOf(stored)).toBe(Object.prototype);
  expect(descriptor).toEqual({
    value: stored,
    writable: true,
    enumerable: true,
    configurable: true,
  });
  expect(Object.isFrozen(stored)).toBe(false);
  expect(role.privateState).toBe(stored);
});

test("custom initializer keeps extension/replacement rights and original role/context receiver timing", () => {
  const role = createRoleComponent(Role.Villager),
    firstRecord = role.privateState,
    extension = { custom: "raw extension" },
    replacement = { replacement: extension },
    world = new World(),
    trace: string[] = [];
  const initialCamp = { camp: Camp.Good };
  const ctx: RoleInitContext = {
    initialCamp,
    currentCamp: () => initialCamp,
    get locale(): "en" {
      trace.push("locale");
      return "en";
    },
    get world() {
      trace.push("world");
      return world;
    },
  };
  const profile: RoleProfile = {
    role: Role.Villager,
    label: "Custom label",
    skillBrief: "Custom skill",
    init(actualRole, actualContext) {
      trace.push("init");
      expect(this).toBe(profile);
      expect<unknown>(actualRole).toBe(role);
      expect(actualContext).toBe(ctx);
      expect<unknown>(actualRole.privateState).toBe(firstRecord);
      actualRole.privateState.extension = extension;
      actualRole.privateState = replacement;
    },
    renderPrompt(actualRole, locale, actualWorld) {
      trace.push("render");
      expect(this).toBe(profile);
      expect(actualRole).toBe(role);
      expect(locale).toBe("en");
      expect(actualWorld).toBe(world);
      return "Custom prompt";
    },
  };
  const catalog = createRoleCatalog([profile]);
  catalog.applyRuntime(role, ctx);
  expect(trace).toEqual(["init", "locale"]);
  expect((firstRecord as { readonly extension?: unknown }).extension).toBe(extension);
  expect(role.privateState).toBe(replacement);
  expect(renderRolePrompt(role)).toBe("Custom prompt");
  expect(trace).toEqual(["init", "locale", "world", "render"]);
});

test("plain Hunter owner evaluates its original privateState LHS once and returns the same input", () => {
  const stored = {},
    state = { canShoot: true },
    trace: string[] = [],
    role: RoleComponent & { renderPrompt: () => string } = {
      role: Role.Hunter,
      get privateState() {
        trace.push("privateState");
        return stored;
      },
      renderPrompt: () => "unused",
    };
  expect(setHunterState(role, state)).toBe(state);
  expect(trace).toEqual(["privateState"]);
  expect(Reflect.get(stored, "hunter")).toBe(state);
});
