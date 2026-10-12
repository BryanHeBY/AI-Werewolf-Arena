/**
 * Unit tests for public ordinary wolf target contributions and fixed live query order.
 * Inputs are literal restrictions, instrumented Role reads, malformed candidates
 * and a finite Mist board. Independent boolean/trace expectations verify short
 * circuit failure prefixes, original repeated reads and zero binding queries.
 * No model, complete-game driver, fixture rewrite or generated rule oracle runs.
 */
import { expect, test } from "bun:test";
import { Camp, Role, type EntityId } from "@ai-werewolf-arena/game-contract";
import { World } from "../../../src/core/domain/world";
import { COMPONENT, type ComponentName } from "../../../src/core/domain/components/names";
import { createRoleComponent, type RoleComponent } from "../../../src/core/domain/components/role";
import { createAliveComponent } from "../../../src/core/domain/components/alive";
import { createNobleState } from "../../../src/game/mechanisms/roles/noble_secret_body/state";
import { freshNightmareShadowState } from "../../../src/game/mechanisms/roles/nightmare_shadow/state";
import {
  bindWolfKnifeTargetQuery,
  createWolfKnifeTargetQuery,
  type WolfKnifeTargetQuery,
  type WolfKnifeRosterQuery,
} from "../../../src/game/mechanisms/roles/wolf/ports";
import {
  bindMistKnifeTargetQuery,
  type MistKnifeTargetQuery,
} from "../../../src/game/mechanisms/roles/mist_raven/ports";
import { bindNobleKnifeTargetQuery } from "../../../src/game/mechanisms/roles/noble_secret_body/ports";
import { bindEvilKnightKnifeTargetQuery } from "../../../src/game/mechanisms/roles/evil_knight/ports";
import { bindNightmareKnifeTargetQuery } from "../../../src/game/mechanisms/roles/nightmare_shadow/ports";
import {
  beginMistNight,
  commitMistChoice,
  abortMistNight,
} from "../../../src/game/mechanisms/roles/mist_raven/night_frame";
import { bootstrapGame } from "../../../src/app/bootstrap";
import { parseBoardDefinition } from "../../../src/runtime/config/board_definition";
import { createRandom } from "../../../src/core/domain/random";
import mistDefinition from "../../../../configs.example/boards/awa_mist_raven_12_v1.json";

function targetWorld(role: RoleComponent = createRoleComponent(Role.Villager, Camp.Good, "en")) {
  const world = new World("en"),
    id = world.createEntity();
  world.addComponent(id, COMPONENT.Role, role);
  world.addComponent(id, COMPONENT.Alive, createAliveComponent(true, "en"));
  return { world, id, role };
}

function observeRoleReads(world: World, trace: string[], roleAt?: (read: number) => RoleComponent) {
  const get = world.getComponent.bind(world),
    alive = world.getAliveEntityIds.bind(world);
  let reads = 0;
  Object.defineProperty(world, "getComponent", {
    value(actorId: EntityId, component: ComponentName) {
      if (component === COMPONENT.Role) {
        trace.push("role");
        reads++;
        if (roleAt) return roleAt(reads);
      }
      return get(actorId, component);
    },
  });
  Object.defineProperty(world, "getAliveEntityIds", {
    value() {
      trace.push("alive");
      return alive();
    },
  });
}

test("binding all public target contributions performs zero World reads and exposes only queries", () => {
  let reads = 0;
  const world = new Proxy(new World("en"), {
    get() {
      reads++;
      throw new Error("unexpected_target_binding_read");
    },
  });
  const queries = [
    bindMistKnifeTargetQuery(world),
    bindNobleKnifeTargetQuery(world),
    bindEvilKnightKnifeTargetQuery(world),
    bindNightmareKnifeTargetQuery(world),
    bindWolfKnifeTargetQuery(world),
  ];
  expect(reads).toBe(0);
  expect(queries.map((query) => Object.keys(query))).toEqual([
    ["targets"],
    ["allows"],
    ["allows"],
    ["allows"],
    ["allows"],
  ]);
  expect(queries.every(Object.isFrozen)).toBe(true);
});

test("the declared five-step composition stops at each original short-circuit boundary", () => {
  const rows = [
    { stop: "mist", expected: ["mist"], allowed: false },
    { stop: "noble", expected: ["mist", "noble"], allowed: false },
    { stop: "alive", expected: ["mist", "noble", "alive"], allowed: false },
    { stop: "evil", expected: ["mist", "noble", "alive", "evil"], allowed: false },
    {
      stop: "nightmare",
      expected: ["mist", "noble", "alive", "evil", "nightmare"],
      allowed: false,
    },
    { stop: "none", expected: ["mist", "noble", "alive", "evil", "nightmare"], allowed: true },
  ];
  for (const row of rows) {
    const trace: string[] = [];
    const query = createWolfKnifeTargetQuery(
      {
        aliveIds() {
          trace.push("alive");
          return row.stop === "alive" ? [] : [1];
        },
      },
      {
        targets() {
          trace.push("mist");
          return row.stop === "mist" ? [2] : null;
        },
      },
      {
        allows() {
          trace.push("noble");
          return row.stop !== "noble";
        },
      },
      {
        allows() {
          trace.push("evil");
          return row.stop !== "evil";
        },
      },
      {
        allows() {
          trace.push("nightmare");
          return row.stop !== "nightmare";
        },
      },
    );
    expect(query.allows(1)).toBe(row.allowed);
    expect(trace).toEqual(row.expected);
  }
});

test("Noble and Nightmare preserve the conditional second live Role lookup without caching", () => {
  const ordinary = createRoleComponent(Role.Villager, Camp.Good, "en"),
    nobleFirst = createRoleComponent(Role.NightNoble, Camp.Wolf, "en"),
    nobleSecond = createRoleComponent(Role.Villager, Camp.Good, "en");
  nobleFirst.privateState.noble = createNobleState("no_blast_no_self_knife");
  nobleSecond.privateState.noble = createNobleState("standard");
  const a = targetWorld(ordinary),
    aTrace: string[] = [];
  observeRoleReads(a.world, aTrace, (read) =>
    read === 1 ? nobleFirst : read === 2 ? nobleSecond : ordinary,
  );
  expect(bindWolfKnifeTargetQuery(a.world).allows(a.id)).toBe(true);
  expect(aTrace).toEqual(["role", "role", "alive", "role", "role"]);

  const nightmareFirst = createRoleComponent(Role.NightmareShadow, Camp.Wolf, "en"),
    nightmareSecond = createRoleComponent(Role.NightmareShadow, Camp.Wolf, "en");
  nightmareFirst.privateState.nightmareShadow = freshNightmareShadowState(
    "optional",
    "no_blast_no_self_knife",
  );
  nightmareSecond.privateState.nightmareShadow = freshNightmareShadowState("optional", "standard");
  const b = targetWorld(ordinary),
    bTrace: string[] = [];
  observeRoleReads(b.world, bTrace, (read) =>
    read === 3 ? nightmareFirst : read === 4 ? nightmareSecond : ordinary,
  );
  expect(bindWolfKnifeTargetQuery(b.world).allows(b.id)).toBe(true);
  expect(bTrace).toEqual(["role", "alive", "role", "role", "role"]);
});

test("live role restrictions remain active outside installed boards and reject malformed candidates without coercion", () => {
  const noble = createRoleComponent(Role.NightNoble, Camp.Wolf, "en"),
    nightmare = createRoleComponent(Role.NightmareShadow, Camp.Wolf, "en");
  noble.privateState.noble = createNobleState("no_blast_no_self_knife");
  nightmare.privateState.nightmareShadow = freshNightmareShadowState(
    "optional",
    "no_blast_no_self_knife",
  );
  for (const role of [noble, nightmare, createRoleComponent(Role.EvilKnight, Camp.Wolf, "en")]) {
    const f = targetWorld(role);
    expect(bindWolfKnifeTargetQuery(f.world).allows(f.id)).toBe(false);
    role.role = Role.Villager;
    expect(bindWolfKnifeTargetQuery(f.world).allows(f.id)).toBe(true);
  }
  const f = targetWorld(),
    query = bindWolfKnifeTargetQuery(f.world);
  expect(query.allows(999)).toBe(false);
  const foreign = {
    toString() {
      throw new Error("foreign_id_coerced");
    },
  };
  expect(query.allows(foreign as unknown as EntityId)).toBe(false);
  f.world.getComponent(f.id, COMPONENT.Alive)!.alive = false;
  expect(query.allows(f.id)).toBe(false);
});

test("a conditional Role field failure propagates the same object before alive or later contributions", () => {
  const first = createRoleComponent(Role.NightNoble, Camp.Wolf, "en"),
    second = createRoleComponent(Role.NightNoble, Camp.Wolf, "en"),
    failure = new Error("original_noble_private_state_failure"),
    f = targetWorld(first),
    trace: string[] = [];
  Object.defineProperty(second, "privateState", {
    get() {
      throw failure;
    },
  });
  observeRoleReads(f.world, trace, (read) => (read === 1 ? first : second));
  let thrown: unknown;
  try {
    bindWolfKnifeTargetQuery(f.world).allows(f.id);
  } catch (error) {
    thrown = error;
  }
  expect(thrown).toBe(failure);
  expect(trace).toEqual(["role", "role"]);
});

test("world and candidate argument getters precede all bound target reads", () => {
  const f = targetWorld(),
    trace: string[] = [];
  observeRoleReads(f.world, trace);
  const input = {
    get world() {
      trace.push("world");
      return f.world;
    },
    get target() {
      trace.push("target");
      return f.id;
    },
  };
  expect(bindWolfKnifeTargetQuery(input.world).allows(input.target)).toBe(true);
  expect(trace).toEqual(["world", "target", "role", "alive", "role", "role"]);
});

test("real Mist absent or closed circles stay null while revoked rosters still fail before invalid candidates", () => {
  const fixedRoles = [
    Role.Alchemist,
    Role.Seer,
    Role.Dreamer,
    Role.Idiot,
    Role.Villager,
    Role.Villager,
    Role.Villager,
    Role.Villager,
    Role.RavenClawWolf,
    Role.Wolf,
    Role.Wolf,
    Role.Wolf,
  ];
  const { world } = bootstrapGame(parseBoardDefinition(mistDefinition).config, {
    fixedRoles,
    random: createRandom("wolf-target-query-mist"),
  });
  const query = bindWolfKnifeTargetQuery(world);
  expect(query.allows(2)).toBe(true);
  beginMistNight(world, 1);
  commitMistChoice(world, 1, [1, 5, 10]);
  expect(query.allows(5)).toBe(true);
  expect(query.allows(2)).toBe(false);
  abortMistNight(world);
  expect(query.allows(2)).toBe(true);
  world.addComponent(5, COMPONENT.Role, createRoleComponent(Role.Villager, Camp.Good, "en"));
  expect(() => query.allows(999)).toThrow("mist_original_roster_revoked");
});

/** Compile-only permissions of public candidate queries and primitive ID roster views. */
function rejectedTargetCapabilities(
  query: WolfKnifeTargetQuery,
  roster: WolfKnifeRosterQuery,
  mist: MistKnifeTargetQuery,
  world: World,
) {
  // @ts-expect-error Target query has no arbitrary World argument.
  query.allows(1, world);
  // @ts-expect-error Target query cannot write a knife effect.
  query.commit();
  // @ts-expect-error Target query exposes no mutable World.
  query.world;
  // @ts-expect-error Read-only alive membership cannot be edited by a query consumer.
  roster.aliveIds().push(2);
  // @ts-expect-error Mist circle membership is read-only.
  mist.targets()?.push(2);
}
void rejectedTargetCapabilities;
