/**
 * Unit tests: Mist Raven owner projection uses literal nested private histories and
 * hostile descriptors; exact whitelists, detached copies and zero foreign-code assertions
 * check DTO privacy. Inputs and expected outcomes remain the original literal or
 * immutable-fixture oracle; these module assertions invoke no model or complete-game
 * driver.
 */
import { expect, test } from "bun:test";
import {
  createRoleComponent,
  Role,
  Camp,
  World,
  type RoleComponent,
  type GameEvent,
} from "../../../src/core";
import {
  createAlchemistState,
  createRavenState,
} from "../../../src/game/mechanisms/roles/mist_raven/state";
import {
  projectAlchemist,
  projectRaven,
} from "../../../src/game/mechanisms/roles/mist_raven/player_projection";
import { AgentEventVisibilityRegistry } from "../../../src/game/mechanisms/broadcast/agent_event_visibility_registry";
import { ScriptEventRenderRegistry } from "../../../src/game/mechanisms/script/event_render_registry";
import { buildAgentVisibleEvent } from "../../../src/game/engine/agent_visible_event_feed";
const role = (kind: Role) => {
  const value = createRoleComponent(kind, kind === Role.Alchemist ? Camp.Good : Camp.Wolf);
  if (kind === Role.Alchemist) value.privateState.alchemist = createAlchemistState();
  else value.privateState.ravenClaw = createRavenState();
  return value;
};
test("owner DTOs use independent whitelists and detach all nested history and knowledge", () => {
  const a = role(Role.Alchemist),
    r = role(Role.RavenClawWolf);
  a.privateState.alchemist = {
    policy: "awa_mist_raven_v1",
    mistRemaining: 0,
    healRemaining: 1,
    mistHistory: [{ day: 1, targetIds: [1, 2, 3] }],
    healHistory: [{ day: 1, targetId: null }],
  };
  r.privateState.ravenClaw = {
    policy: "awa_mist_raven_v1",
    awakenedDay: 2,
    knownTeammateIds: [10],
    extraRemaining: 1,
    extraHistory: [{ day: 2, targetId: null }],
  };
  const alchemist = projectAlchemist(a)!,
    raven = projectRaven(r)!;
  expect(Object.keys(alchemist).sort()).toEqual(
    ["policy", "mistRemaining", "healRemaining", "mistHistory", "healHistory"].sort(),
  );
  expect(Object.keys(raven).sort()).toEqual(
    ["policy", "awakened", "knownTeammateIds", "extraRemaining", "extraHistory"].sort(),
  );
  alchemist.mistHistory[0]!.targetIds![0] = 99;
  raven.knownTeammateIds[0] = 99;
  expect(projectAlchemist(a)!.mistHistory[0]!.targetIds).toEqual([1, 2, 3]);
  expect(projectRaven(r)!.knownTeammateIds).toEqual([10]);
  expect(projectRaven(a)).toBeUndefined();
  expect(projectAlchemist(r)).toBeUndefined();
});
test("DTO queries execute no private accessors or proxy traps", () => {
  let reads = 0;
  const a = role(Role.Alchemist);
  Object.defineProperty(a, "privateState", {
    get() {
      reads++;
      throw new Error("must not read");
    },
  });
  expect(projectAlchemist(a)).toBeUndefined();
  expect(reads).toBe(0);
  const proxied = new Proxy(role(Role.Alchemist), {
    get() {
      reads++;
      throw new Error("must not read");
    },
    getOwnPropertyDescriptor() {
      reads++;
      throw new Error("must not describe");
    },
  });
  expect(projectAlchemist(proxied)).toBeUndefined();
  expect(reads).toBe(0);
  const container = role(Role.RavenClawWolf);
  container.privateState = new Proxy(
    {},
    {
      getOwnPropertyDescriptor() {
        reads++;
        throw new Error("must not describe");
      },
    },
  );
  expect(projectRaven(container)).toBeUndefined();
  expect(reads).toBe(0);
  const broken = role(Role.Alchemist);
  (broken.privateState.alchemist as Record<string, unknown>).healRemaining = 0;
  expect(projectAlchemist(broken)).toBeUndefined();
});
const facts: GameEvent[] = [
  {
    timestamp: 1,
    type: "alchemist_mist_chosen",
    payload: { actorId: 1, day: 1, targetIds: [1, 2, 3] },
    audience: [1],
  },
  {
    timestamp: 1,
    type: "alchemist_mist_skipped",
    payload: { actorId: 1, day: 1, reason: "dead" },
    audience: [1],
  },
  {
    timestamp: 1,
    type: "alchemist_snake_chosen",
    payload: { actorId: 1, day: 1, targetId: 1 },
    audience: [1],
  },
  {
    timestamp: 1,
    type: "raven_unsealed",
    payload: { actorId: 2, day: 2, awakened: true, knownTeammateIds: [10] },
    audience: [2],
  },
  {
    timestamp: 1,
    type: "raven_knife_chosen",
    payload: { actorId: 2, day: 2, targetId: 3 },
    audience: [2],
  },
  {
    timestamp: 1,
    type: "raven_knife_skipped",
    payload: { actorId: 2, day: 1, reason: "sealed" },
    audience: [2],
  },
];
test("foreign arrays cannot execute descriptor callbacks at the player feed boundary", () => {
  const payload: { actorId: number; day: number; targetIds: number[]; privateCanary?: string } = {
    actorId: 1,
    day: 1,
    targetIds: [],
  };
  payload.targetIds = new Proxy([1, 5, 6], {
    getPrototypeOf(value) {
      payload.targetIds = [1, 5, 6];
      payload.privateCanary = "hidden-only";
      return Reflect.getPrototypeOf(value);
    },
  });
  const event: GameEvent = { timestamp: 1, type: "alchemist_mist_chosen", payload, audience: [1] };
  const visible = buildAgentVisibleEvent(new World(), event, 1, 1);
  expect(visible).toBeNull();
  expect(JSON.stringify(visible)).not.toContain("privateCanary");
  expect(payload.privateCanary).toBeUndefined();
});
for (const event of facts)
  test(`private ${event.type} stays owner-only and absent from public terminal`, () => {
    const visibility = new AgentEventVisibilityRegistry(),
      world = new World(),
      render = new ScriptEventRenderRegistry();
    const owner = (event.payload as { actorId: number }).actorId;
    for (let id = 1; id <= 12; id++)
      expect(visibility.canView(world, event, id)).toBe(id === owner);
    expect(visibility.canView(world, { ...event, audience: [1, 2] } as GameEvent, owner)).toBe(
      false,
    );
    for (const locale of ["zh-CN", "en"] as const) {
      expect(render.toLiveRender(event, false, locale)).toEqual([]);
      expect(render.toChatLine(event, locale)).toBeNull();
      expect(render.toLiveRender(event, true, locale)).toHaveLength(1);
      expect(render.toJudgeLine(event, locale)).not.toBe(event.type);
    }
  });
