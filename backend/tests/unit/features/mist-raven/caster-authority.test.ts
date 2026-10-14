/**
 * 单元测试：验证雾鸦施法者的独立权限契约与原 owner／frame／reader。输入为内存 fixture、受控回调和畸形修改；原引用、字面值及拒绝断言为预期，不执行装配周期、模型或实体传输。
 */
import { createCampComponent, createAliveComponent } from "../../../../src/game/observation/component-presentation";
import { expect, test } from "bun:test";
import { World } from "../../../../src/core/domain/world";
import { Camp, type Role } from "../../../../src/core/domain/identity";
import { createRoleComponent } from "../../../../src/game/observation/role-presentation";


import { createIdentityComponent } from "../../../../src/core/domain/entities/player";
import { COMPONENT } from "../../../../src/core/domain/components/names";
import {
  createAlchemistState,
  createRavenState,
} from "../../../../src/game/mechanisms/roles/mist_raven/state";
import { MistCasterAuthority } from "../../../../src/game/mechanisms/roles/mist_raven/caster_authority";
function fixture(caster: "alchemist" | "raven_claw_wolf" = "alchemist", day = 1) {
  const world = new World(),
    id = world.createEntity(),
    role = createRoleComponent(caster as Role),
    life = createAliveComponent(),
    identity = createIdentityComponent(id, 1, "Literal Player");
  (role.privateState as Record<string, unknown>)[
    caster === "alchemist" ? "alchemist" : "ravenClaw"
  ] = caster === "alchemist" ? createAlchemistState() : createRavenState();
  world.addComponent(id, COMPONENT.Role, role);
  world.addComponent(id, COMPONENT.Camp, createCampComponent(caster === "alchemist" ? Camp.Good : Camp.Wolf));
  world.addComponent(id, COMPONENT.Alive, life);
  world.addComponent(id, COMPONENT.Identity, identity);
  const authority = new MistCasterAuthority(world, id, day, caster);
  return { world, id, role, life, identity, authority };
}
test("same-night legitimate mist update preserves authority for snake and consumes both stocks", () => {
  const { authority, role } = fixture();
  const original = (role.privateState as { readonly alchemist?: unknown }).alchemist;
  authority.commitMist([1, 2, 3], [1, 2, 3]);
  expect((role.privateState as { readonly alchemist?: unknown }).alchemist).not.toBe(original);
  expect(authority.isCurrent()).toBe(true);
  expect(authority.commitSnake(1, [1])).toMatchObject({
    mistRemaining: 0,
    healRemaining: 0,
    mistHistory: [{ day: 1, targetIds: [1, 2, 3] }],
    healHistory: [{ day: 1, targetId: 1 }],
  });
  expect(authority.isCurrent()).toBe(true);
  expect(() => authority.commitSnake(1, [1])).toThrow("snake_choice_unavailable");
});
test("raven is checked once at night start, and legitimate unseal permits an independent knife", () => {
  const { authority, role } = fixture("raven_claw_wolf", 2);
  expect(() => authority.commitRavenKnife(4, [1, 4])).toThrow("raven_night_start_required");
  expect(authority.checkRavenAtNightStart([1, 2])).toMatchObject({
    awakenedDay: 2,
    knownTeammateIds: [2],
  });
  expect(authority.isCurrent()).toBe(true);
  expect(authority.commitRavenKnife(4, [1, 2, 4])).toMatchObject({
    extraRemaining: 0,
    extraHistory: [{ day: 2, targetId: 4 }],
  });
  expect(() => authority.checkRavenAtNightStart([1])).toThrow("raven_night_start_reentry");
  const later = new MistCasterAuthority(fixtureWorld(role), 1, 3, "raven_claw_wolf");
  expect(later.checkRavenAtNightStart([1])).toMatchObject({
    awakenedDay: 2,
    knownTeammateIds: [2],
  });
});
function fixtureWorld(role: ReturnType<typeof createRoleComponent>) {
  const world = new World(),
    id = world.createEntity();
  world.addComponent(id, COMPONENT.Role, role);
  world.addComponent(id, COMPONENT.Camp, createCampComponent(Camp.Wolf));
  world.addComponent(id, COMPONENT.Alive, createAliveComponent());
  world.addComponent(id, COMPONENT.Identity, createIdentityComponent(id, 1, "Literal Player"));
  return world;
}
test("one night owner cannot rerun the sealed start check after wolves decrease", () => {
  const { authority } = fixture("raven_claw_wolf");
  expect(authority.checkRavenAtNightStart([1, 2, 3])).toMatchObject({
    awakenedDay: null,
    knownTeammateIds: [],
  });
  expect(() => authority.checkRavenAtNightStart([1, 2])).toThrow("raven_night_start_reentry");
  expect(authority.state()).toMatchObject({ awakenedDay: null });
});
for (const edit of [
  "role_object",
  "role_name",
  "camp",
  "identity_object",
  "identity_name",
  "identity_seat",
  "private_container",
  "state_equal_copy",
  "history_equal_copy",
  "stock",
  "life_object",
  "revived",
  "life_accessor",
] as const)
  test(`caster original authority rejects foreign mutation/${edit}`, () => {
    const { world, id, role, life, identity, authority } = fixture();
    switch (edit) {
      case "role_object":
        world.addComponent(id, COMPONENT.Role, createRoleComponent(role.role));
        break;
      case "role_name":
        role.role = "villager" as Role;
        break;
      case "camp":
        world.getComponent(id, COMPONENT.Camp)!.camp = Camp.Wolf;
        break;
      case "identity_object":
        world.addComponent(id, COMPONENT.Identity, { ...identity });
        break;
      case "identity_name":
        identity.name = "Changed";
        break;
      case "identity_seat":
        identity.seat = 2;
        break;
      case "private_container":
        (role as { privateState: Readonly<Record<string, unknown>> }).privateState = {
          ...role.privateState,
        };
        break;
      case "state_equal_copy":
        (role.privateState as Record<string, unknown>).alchemist = structuredClone(
          (role.privateState as { readonly alchemist?: unknown }).alchemist,
        );
        break;
      case "history_equal_copy":
        (
          (role.privateState as { readonly alchemist?: unknown }).alchemist as ReturnType<
            typeof createAlchemistState
          >
        ).mistHistory = [];
        break;
      case "stock":
        (
          (role.privateState as { readonly alchemist?: unknown }).alchemist as ReturnType<
            typeof createAlchemistState
          >
        ).healRemaining = 0;
        break;
      case "life_object":
        world.addComponent(id, COMPONENT.Alive, createAliveComponent());
        break;
      case "revived":
        life.alive = false;
        life.alive = true;
        break;
      case "life_accessor":
        Object.defineProperty(life, "alive", {
          get() {
            throw Error("must_not_read_foreign_getter");
          },
          enumerable: true,
          configurable: true,
        });
        break;
    }
    expect(authority.isCurrent()).toBe(false);
    expect(() => authority.commitMist(null, [id])).toThrow("mist_caster_authority_revoked");
  });
test("DTO copies never become authority or mutate the engine-owned inventory", () => {
  const { authority } = fixture();
  const dto = authority.state() as ReturnType<typeof createAlchemistState>;
  dto.healRemaining = 0;
  dto.mistHistory.push({ day: 1, targetIds: [1, 2, 3] });
  expect(authority.isCurrent()).toBe(true);
  expect(authority.state()).toEqual(createAlchemistState());
});
test("invalid tool selection preserves the originally owned resources", () => {
  const { authority } = fixture();
  expect(() => authority.commitMist([1, 1, 2], [1, 2, 3])).toThrow("mist_choice_target_invalid");
  expect(() => authority.commitSnake(2, [])).toThrow("snake_choice_target_invalid");
  expect(authority.state()).toEqual(createAlchemistState());
  expect(authority.isCurrent()).toBe(true);
});
test("state binding never calls a foreign array map accessor", () => {
  const { world, role } = fixture();
  let calls = 0;
  const initial = createAlchemistState();
  const prototype = Object.create(Array.prototype);
  Object.defineProperty(prototype, "map", {
    get() {
      calls++;
      throw Error("mapgetter");
    },
  });
  Object.setPrototypeOf(initial.mistHistory, prototype);
  (role.privateState as Record<string, unknown>).alchemist = initial;
  const authority = new MistCasterAuthority(world, 1, 1, "alchemist");
  expect(authority.isCurrent()).toBe(true);
  expect(authority.state()).toEqual(createAlchemistState());
  expect(calls).toBe(0);
});
for (const day of [1, 2])
  test(`nested equal mist array replacement revokes day ${day} snake authority`, () => {
    const { world, role, authority } = fixture();
    authority.commitMist([1, 2, 3], [1, 2, 3]);
    const current = day === 1 ? authority : new MistCasterAuthority(world, 1, 2, "alchemist");
    const state = (role.privateState as { readonly alchemist?: unknown }).alchemist as ReturnType<
      typeof createAlchemistState
    >;
    state.mistHistory[0]!.targetIds = [...state.mistHistory[0]!.targetIds!];
    expect(current.isCurrent()).toBe(false);
    expect(() => current.commitSnake(1, [1])).toThrow("mist_caster_authority_revoked");
    expect(state.healRemaining).toBe(1);
  });
for (const mode of ["same-value", "camp-value", "getter"] as const)
  test(`actual Camp component is bound/${mode}`, () => {
    const { world, id, authority } = fixture();
    const camp = world.getComponent(id, COMPONENT.Camp)!;
    let calls = 0;
    if (mode === "same-value") world.addComponent(id, COMPONENT.Camp, { ...camp });
    else if (mode === "camp-value") camp.camp = Camp.Wolf;
    else
      Object.defineProperty(camp, "camp", {
        get() {
          calls++;
          return Camp.Good;
        },
        enumerable: true,
        configurable: true,
      });
    expect(authority.isCurrent()).toBe(false);
    expect(calls).toBe(0);
    expect(() => authority.commitSnake(null, [])).toThrow("mist_caster_authority_revoked");
    expect(calls).toBe(0);
  });

test("original first death preserves paid knowledge while never allowing another resource commit", () => {
  const { authority, life } = fixture("raven_claw_wolf", 2);
  authority.checkRavenAtNightStart([1, 2]);
  authority.commitRavenKnife(3, [1, 2, 3]);
  life.alive = false;
  expect(authority.isCurrent()).toBe(false);
  expect(authority.isCurrent(true)).toBe(true);
  expect(authority.state(true)).toMatchObject({ knownTeammateIds: [2], extraRemaining: 0 });
  expect(() => authority.commitRavenKnife(null, [1, 2])).toThrow("mist_caster_authority_revoked");
  life.alive = true;
  expect(authority.isCurrent(true)).toBe(false);
});
test("a replaced body cannot use the first-death read permission", () => {
  const { world, authority, id, life } = fixture();
  life.alive = false;
  world.addComponent(id, COMPONENT.Alive, createAliveComponent(false));
  expect(authority.isCurrent(true)).toBe(false);
  expect(() => authority.state(true)).toThrow("mist_caster_authority_revoked");
});
