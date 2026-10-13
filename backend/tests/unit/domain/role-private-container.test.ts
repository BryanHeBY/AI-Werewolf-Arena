/**
 * Unit tests check the role container's read contract and explicit custom initialization.
 * Literal role objects, extension records and delegated context getters supply inputs;
 * key/descriptor identity, original callback receiver and trace order are the oracle.
 * Compile-only valid-shape writes must fail outside initialization. Runtime records
 * remain mutable as before; no game, schema, transport or model executes here.
 */
import "../../../src/app/bootstrap";
import { expect, test } from "bun:test";
import { Camp, Role } from "@ai-werewolf-arena/game-contract";
import { createRoleComponent, type RoleComponent } from "../../../src/core/domain/components/role";
import { World } from "../../../src/core/domain/world";
import { RoleCatalog } from "../../../src/game/mechanisms/roles/catalog";
import type { RoleProfile, RoleInitContext } from "../../../src/game/mechanisms/roles/contracts";
import { setHunterState } from "../../../src/game/mechanisms/roles/hunter/state";

function ordinaryReaderCannotWrite(role: RoleComponent) {
  // @ts-expect-error An otherwise valid record cannot replace the read-only container.
  role.privateState = {};
  // @ts-expect-error An otherwise valid scalar cannot write an arbitrary private key.
  role.privateState.custom = 42;
  // @ts-expect-error Read-only index access also denies deleting a private key.
  delete role.privateState.custom;
}
void ordinaryReaderCannotWrite;

test("component factory keeps the original record, keys and writable runtime descriptor", () => {
  const role = createRoleComponent(Role.Villager, Camp.Good),
    stored = role.privateState,
    descriptor = Object.getOwnPropertyDescriptor(role, "privateState")!;
  expect(Object.keys(role)).toEqual(["role", "camp", "privateState", "renderPrompt"]);
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
  const role = createRoleComponent(Role.Villager, Camp.Good),
    firstRecord = role.privateState,
    extension = { custom: "raw extension" },
    replacement = { replacement: extension },
    world = new World(),
    trace: string[] = [];
  const ctx: RoleInitContext = {
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
  const catalog = new RoleCatalog([profile]);
  catalog.applyRuntime(role, ctx);
  expect(trace).toEqual(["init", "locale"]);
  expect((firstRecord as { readonly extension?: unknown }).extension).toBe(extension);
  expect(role.privateState).toBe(replacement);
  expect(role.renderPrompt()).toBe("Custom prompt");
  expect(trace).toEqual(["init", "locale", "world", "render"]);
});

test("plain Hunter owner evaluates its original privateState LHS once and returns the same input", () => {
  const stored = {},
    state = { canShoot: true },
    trace: string[] = [],
    role: RoleComponent = {
      role: Role.Hunter,
      camp: Camp.Good,
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
