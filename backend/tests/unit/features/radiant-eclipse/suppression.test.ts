/**
 * 单元测试：验证明辉／黯月有限本职抑制边界。
 * 输入为原内存 fixture、callback 和显式非法变更；引用、状态、错误与字面预期是独立 oracle。
 * 实际原生 owner/frame/readers 仍按原顺序执行，use/install 入口只随实际实例 owner 迁移。
 * 不运行完整对局、模型或物理传输，不重建 fixture、矩阵或生产生成的预期。
 */
import { createAliveComponent } from "../../../../src/game/observation/component-presentation";
import { expect, test } from "bun:test";
import { World } from "../../../../src/core/domain/world";
import { Role, Camp } from "../../../../src/core/domain/identity";
import { COMPONENT } from "../../../../src/core/domain/components/names";
import { Phase } from "../../../../src/core/domain/identity";
import { ToolGateway } from "../../../../src/game/gateway/tool_gateway";
import { createRoleComponent } from "../../../../src/game/observation/role-presentation";

import {
  findNightAbility,
  abilityStatus,
  projectNightAbility,
  activeNightAbility,
} from "../../../../src/game/mechanisms/roles/abilities";
import { installNativeAbility } from "../../../../src/game/mechanisms/roles/ability_changes";
import {
  openEclipseSuppression,
  type SuppressibleAbility,
} from "../../../../src/game/mechanisms/roles/radiant_eclipse/suppression";
function fixture(disabled = false) {
  const world = new World(),
    actorId = world.createEntity();
  const role = createRoleComponent(Role.Seer, Camp.Good),
    life = createAliveComponent();
  world.addComponent(actorId, COMPONENT.Role, role);
  world.addComponent(actorId, COMPONENT.Alive, life);
  world.addComponent(actorId, COMPONENT.Identity, {
    id: actorId,
    seat: 1,
    name: "original",
    sessionId: "synthetic",
  });
  installNativeAbility(role, "seer_check", {
    lastTarget: null,
    lastIsWerewolf: null,
    history: [],
  });
  const ability = findNightAbility(role, "seer_check")!;
  (ability as { disabled: boolean }).disabled = disabled;
  return { world, actorId, role, life, ability };
}
for (const initial of [false, true])
  test(`suppression closes independently of persistent disabled=${initial}`, () => {
    const f = fixture(initial),
      scope = openEclipseSuppression(f.world, f.actorId, f.ability, 2);
    expect(scope.isCurrent()).toBe(true);
    expect(f.ability.disabled).toBe(initial);
    expect(scope.close()).toBe(true);
    expect(f.ability.disabled).toBe(initial);
    expect(f.ability.nightSuppression).toBeUndefined();
    expect(scope.close()).toBe(false);
  });
test("another permanent disable is kept while only this blocker is removed", () => {
  const f = fixture(),
    scope = openEclipseSuppression(f.world, f.actorId, f.ability, 2);
  (f.ability as { disabled: boolean }).disabled = true;
  expect(scope.isCurrent()).toBe(false);
  expect(scope.close()).toBe(true);
  expect(f.ability.disabled).toBe(true);
});
test("same blocker with altered fields revokes authorization and remains its owner's cleanup", () => {
  const f = fixture(),
    scope = openEclipseSuppression(f.world, f.actorId, f.ability, 2);
  (scope.marker as { day: number }).day = 3;
  expect(scope.isCurrent()).toBe(false);
  expect(scope.close()).toBe(true);
  expect(f.ability.nightSuppression).toBeUndefined();
});
test("a replacement blocker with equal values belongs to another owner", () => {
  const f = fixture(),
    scope = openEclipseSuppression(f.world, f.actorId, f.ability, 2);
  const foreign = { ...scope.marker };
  (
    f.ability as {
      nightSuppression: import("@ai-werewolf-arena/game-contract").EclipseSuppression | undefined;
    }
  ).nightSuppression = foreign;
  expect(scope.isCurrent()).toBe(false);
  expect(scope.close()).toBe(false);
  expect(f.ability.nightSuppression).toBe(foreign);
});
for (const mode of ["death", "revival", "new_life", "new_ability"] as const)
  test(`suppression ${mode} preserves original-instance ownership`, () => {
    const f = fixture(),
      scope = openEclipseSuppression(f.world, f.actorId, f.ability, 2);
    if (mode === "death" || mode === "revival") f.life.alive = false;
    if (mode === "revival") f.life.alive = true;
    if (mode === "new_life")
      f.world.addComponent(f.actorId, COMPONENT.Alive, createAliveComponent());
    let replacement: SuppressibleAbility | undefined;
    if (mode === "new_ability") {
      replacement = { ...f.ability, nightSuppression: { ...scope.marker } };
      (
        (f.role.privateState as { readonly abilities?: unknown }).abilities as Record<
          string,
          SuppressibleAbility
        >
      )[f.ability.id] = replacement;
    }
    expect(scope.isCurrent()).toBe(false);
    expect(scope.close()).toBe(mode === "death");
    if (replacement) expect(replacement.nightSuppression).toBeDefined();
  });

test("the native instance is disabled only for the lease and its public metadata hides the blocker", () => {
  const f = fixture(),
    scope = openEclipseSuppression(f.world, f.actorId, f.ability, 2);
  expect(f.ability.disabled).toBe(false);
  expect(abilityStatus(f.ability, 2)).toBe("disabled");
  expect(activeNightAbility(f.role, "seer_check", 2)).toBeUndefined();
  const view = projectNightAbility(f.ability, 2);
  expect(view.disabled).toBe(true);
  expect(view.status).toBe("disabled");
  expect(Object.keys(view)).not.toContain("nightSuppression");
  expect(scope.close()).toBe(true);
  expect(projectNightAbility(f.ability, 2).disabled).toBe(false);
  expect(activeNightAbility(f.role, "seer_check", 2)).toBe(f.ability);
});
test("malformed or accessor blockers never reactivate an instance or execute a getter", () => {
  const f = fixture();
  let reads = 0;
  Object.defineProperty(f.ability, "nightSuppression", {
    configurable: true,
    enumerable: true,
    get() {
      reads++;
      throw new Error("blocker_getter");
    },
  });
  expect(abilityStatus(f.ability, 2)).toBe("disabled");
  expect(projectNightAbility(f.ability, 2).disabled).toBe(true);
  expect(reads).toBe(0);
  Object.defineProperty(f.ability, "nightSuppression", {
    value: { policy: "wrong", day: 1234 },
    writable: true,
    configurable: true,
    enumerable: true,
  });
  expect(abilityStatus(f.ability, 2)).toBe("disabled");
});

for (const mode of [
  "name",
  "identity_ref",
  "camp",
  "state_ref",
  "source_ref",
  "source_role",
  "ability_id",
  "first_death_name",
  "permanent_disabled_name",
] as const)
  test(`revoked ${mode} authorization still releases this blocker's original resource`, () => {
    const f = fixture(),
      scope = openEclipseSuppression(f.world, f.actorId, f.ability, 2);
    const identity = f.world.getComponent<{
      id: number;
      seat: number;
      name: string;
      sessionId: string;
    }>(f.actorId, COMPONENT.Identity)!;
    if (mode === "name" || mode === "first_death_name" || mode === "permanent_disabled_name")
      identity.name = "changed";
    if (mode === "identity_ref")
      f.world.addComponent(f.actorId, COMPONENT.Identity, { ...identity });
    if (mode === "camp") f.role.camp = Camp.Wolf;
    if (mode === "state_ref")
      (
        f.ability as {
          state: import("@ai-werewolf-arena/game-contract").SeerReadState;
        }
      ).state = { ...f.ability.state };
    if (mode === "source_ref")
      (
        f.ability as {
          source: import("@ai-werewolf-arena/game-contract").AbilitySource;
        }
      ).source = { ...f.ability.source };
    if (mode === "source_role" && f.ability.source.kind === "native")
      (f.ability.source as { role: Role }).role = Role.Witch;
    if (mode === "ability_id") (f.ability as { id: string }).id = "native:seer_check:edited";
    if (mode === "first_death_name") f.life.alive = false;
    if (mode === "permanent_disabled_name") (f.ability as { disabled: boolean }).disabled = true;
    expect(scope.isCurrent()).toBe(false);
    expect(scope.close()).toBe(true);
    expect(f.ability.nightSuppression).toBeUndefined();
    expect(f.ability.disabled).toBe(mode === "permanent_disabled_name");
    expect(abilityStatus(f.ability, 3)).toBe(
      mode === "permanent_disabled_name" ? "disabled" : "active",
    );
  });

test("actual gateway and public ability state agree during native suppression and recovery", () => {
  const f = fixture(),
    targetId = f.world.createEntity(),
    gateway = new ToolGateway();
  f.world.addComponent(targetId, COMPONENT.Alive, createAliveComponent());
  f.world.addComponent(targetId, COMPONENT.Role, createRoleComponent(Role.Villager, Camp.Good));
  const check = () =>
    gateway.validateAndSanitize(
      f.world,
      f.actorId,
      { name: "check_identity", args: { target_id: targetId } },
      { phase: Phase.Night, day: 2, abilityId: f.ability.id, deferOperation: true },
    );
  expect(check().ok).toBe(true);
  const scope = openEclipseSuppression(f.world, f.actorId, f.ability, 2);
  expect(check().ok).toBe(false);
  expect(projectNightAbility(f.ability, 2).status).toBe("disabled");
  expect(scope.close()).toBe(true);
  expect(check().ok).toBe(true);
  expect(projectNightAbility(f.ability, 2).status).toBe("active");
});
