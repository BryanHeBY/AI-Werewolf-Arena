/**
 * 单元测试：验证隐狼与石像鬼各自的继承写 owner。输入为字面狼阵营 World 与抛错公布／资源端口；访问日志、存储引用及原生命为预期。覆盖末狼转移和已付费事实前缀，不替代刀权、身份查验或死亡波扩张。
 */
import type { HiddenWolfState, GargoyleState } from "@ai-werewolf-arena/game-contract";

import { expect, test } from "bun:test";
import { Role, Camp, type GameEvent } from "@ai-werewolf-arena/game-contract";
import { COMPONENT } from "../../../src/core/domain/components/names";
import { createAliveComponent } from "../../../src/core/domain/components/alive";
import { createRoleComponent } from "../../../src/game/observation/role-presentation";
import { World } from "../../../src/core/domain/world";
import {
  getHiddenWolfState,
  setHiddenWolfState,
} from "../../../src/game/mechanisms/roles/hidden_wolf/state";
import {
  getGargoyleState,
  setGargoyleState,
} from "../../../src/game/mechanisms/roles/gargoyle/state";
import { refreshHiddenWolfInheritance } from "../../../src/game/mechanisms/roles/hidden_wolf/inheritance";
import { refreshGargoyleInheritance } from "../../../src/game/mechanisms/roles/gargoyle/inheritance";
function readerPermissions(hidden: HiddenWolfState, gargoyle: GargoyleState) {
  // @ts-expect-error Inheritance facts are changed by their owning command.
  hidden.hasInheritedKnife = true;
  // @ts-expect-error Gargoyle readers cannot bypass its inheritance coordinator.
  gargoyle.hasInheritedKnife = true;
}
void readerPermissions;
const cases = [
  {
    role: Role.HiddenWolf,
    install: setHiddenWolfState,
    read: getHiddenWolfState,
    refresh: refreshHiddenWolfInheritance,
    event: "hidden_wolf_awakened",
  },
  {
    role: Role.Gargoyle,
    install: setGargoyleState,
    read: getGargoyleState,
    refresh: refreshGargoyleInheritance,
    event: "gargoyle_awakened",
  },
] as const;
for (const c of cases) {
  test(`${c.role}: publication rejection retains the original inherited reference without killing its owner`, () => {
    const world = new World("en"),
      id = world.createEntity(),
      role = createRoleComponent(c.role, Camp.Wolf, "en"),
      life = createAliveComponent(true, "en"),
      events: GameEvent[] = [],
      failure = new Error("inheritance_publication_failed"),
      accesses: unknown[] = [];
    world.addComponent(id, COMPONENT.Role, role);
    world.addComponent(id, COMPONENT.Alive, life);
    const state = c.install(role, { hasInheritedKnife: false });
    let inherited = false;
    Object.defineProperty(state, "hasInheritedKnife", {
      get() {
        accesses.push("read");
        return inherited;
      },
      set(value) {
        accesses.push(["write", value]);
        inherited = value;
      },
    });
    Object.defineProperty(events, "push", {
      value() {
        accesses.push("publish");
        throw failure;
      },
    });
    let caught: unknown;
    try {
      c.refresh(world, events, 2);
    } catch (error) {
      caught = error;
    }
    expect(caught).toBe(failure);
    expect(accesses).toEqual(["read", ["write", true], "publish"]);
    expect(inherited).toBe(true);
    expect(c.read(role)).toBe(state);
    expect(events).toEqual([]);
    expect(life.alive).toBe(true);
  });
  test(`${c.role}: multiple living wolves do not write a selected resource or emit a fact`, () => {
    const world = new World("en"),
      id = world.createEntity(),
      peer = world.createEntity(),
      role = createRoleComponent(c.role, Camp.Wolf, "en"),
      events: GameEvent[] = [];
    world.addComponent(id, COMPONENT.Role, role);
    world.addComponent(id, COMPONENT.Alive, createAliveComponent(true, "en"));
    world.addComponent(peer, COMPONENT.Role, createRoleComponent(Role.Wolf, Camp.Wolf, "en"));
    world.addComponent(peer, COMPONENT.Alive, createAliveComponent(true, "en"));
    const state = c.install(role, { hasInheritedKnife: false });
    let reads = 0;
    Object.defineProperty(state, "hasInheritedKnife", {
      get() {
        reads++;
        throw new Error("ineligible_resource_read");
      },
    });
    c.refresh(world, events, 2);
    expect(reads).toBe(0);
    expect(events).toEqual([]);
    expect(c.read(role)).toBe(state);
  });
}
