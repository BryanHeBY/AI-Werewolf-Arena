/**
 * 单元测试以字面共享 handler、外来 pack／plan 迭代器及被观察的 Ghost Map／字段操作为输入，核对可观察阶段来源和实际执行项。独立引用、来源、接收者及失败前缀预期验证单遍收集且不增加 handler getter；不运行模型／整局驱动，不改写夹具或用编译器生成预期。
 */
import { createRoleCatalog } from "../../../src/rulesets/roles/role-catalog-assembly";
import { expect, test } from "bun:test";
import { Role } from "@ai-werewolf-arena/game-contract";
import { World } from "../../../src/domain/world";
import { RoleCatalog } from "../../../src/rulesets/roles/catalog";
import type { RoleProfile } from "../../../src/rulesets/roles/contracts";
import type { NightStageHandler } from "../../../src/engine/night/contracts";
import { NightStageRegistry } from "../../../src/rulesets/night-stage-plan";
import { applyGhostBrideStageRegistration } from "../../../src/rulesets/night-stage-registration";
import { sixPlayerMvpConfig } from "../../../src/rulesets/presets/six-player-mvp";
import { nightStageContext } from "../../support/builders/night-stage-context";
import { bootstrapGame } from "../../../src/app/bootstrap";
import { NightPipeline } from "../../../src/engine/phases/night-pipeline";
import { ToolGateway } from "../../../src/engine/actions/tool-gateway";
import { DamageResolutionSystem } from "../../../src/domain/systems/damage-resolution-system";
import { createRandom } from "../../../src/domain/random";

const profile = (role: Role, nightStages: NightStageHandler[]): RoleProfile => ({
  role,
  label: role,
  skillBrief: role,
  nightStages,
});
const config = (roles: Role[]) => ({
  ...sixPlayerMvpConfig,
  roleSetups: roles.map((role) => ({ role, count: 1 })),
});

test("same handler records every observed role source without new ID or priority getter reads", async () => {
  let idReads = 0,
    priorityReads = 0;
  const receivers: boolean[] = [],
    shared: NightStageHandler = {
      get id() {
        idReads++;
        return "shared";
      },
      get priority() {
        priorityReads++;
        return 1;
      },
      async execute() {
        receivers.push(this === shared);
      },
    };
  const plan = new NightStageRegistry(
    createRoleCatalog([profile(Role.Wolf, [shared]), profile(Role.Guard, [shared])]),
  ).getPlan(config([Role.Wolf, Role.Guard]));
  expect(idReads).toBe(5);
  expect(priorityReads).toBe(0);
  if (plan.mode !== "snapshot") throw new Error("expected_owned_snapshot");
  expect(plan.entries).toHaveLength(1);
  expect(plan.entries[0]!.handler).toBe(shared);
  expect(plan.entries[0]!.sources).toEqual([
    { kind: "role-profile", role: Role.Wolf },
    { kind: "role-profile", role: Role.Guard },
  ]);
  expect(Object.isFrozen(plan.entries)).toBe(true);
  expect(Object.isFrozen(plan.entries[0])).toBe(true);
  expect(Object.isFrozen(plan.entries[0]!.sources)).toBe(true);
  expect(plan.entries[0]!.sources.every(Object.isFrozen)).toBe(true);
  expect(Object.isFrozen(shared)).toBe(false);
  for (const entry of plan.entries)
    await entry.handler.execute(nightStageContext({ world: new World("en") }));
  expect(receivers).toEqual([true]);
});

test("source capture preserves the original spread completion and iterator failure prefix", () => {
  const seed: NightStageHandler = { id: "seed", priority: 1, async execute() {} },
    later: NightStageHandler = { id: "later", priority: 2, async execute() {} },
    failure = new Error("original_pack_after_yield"),
    pack = [later],
    lengths: number[] = [];
  let collected: unknown[] | undefined,
    iteratorCalls = 0;
  const originalPush = Array.prototype.push;
  Object.defineProperty(pack, Symbol.iterator, {
    value: function* () {
      iteratorCalls++;
      lengths.push(collected!.length);
      yield later;
      lengths.push(collected!.length);
      throw failure;
    },
  });
  Array.prototype.push = function (...values) {
    if (values.length === 1 && values[0] === seed) collected = this;
    return originalPush.apply(this, values);
  };
  let thrown: unknown;
  try {
    new NightStageRegistry(
      createRoleCatalog([profile(Role.Wolf, [seed]), profile(Role.Seer, pack)]),
    ).getPlan(config([Role.Wolf, Role.Seer]));
  } catch (error) {
    thrown = error;
  } finally {
    Array.prototype.push = originalPush;
  }
  expect(thrown).toBe(failure);
  expect(iteratorCalls).toBe(1);
  expect(lengths).toEqual([1, 1]);
  expect(collected).toEqual([seed]);
});

test("possible ability closure remains one initial-role pass and derived templates keep observed profile sources", () => {
  const first: NightStageHandler = { id: "first", priority: 1, async execute() {} },
    second: NightStageHandler = { id: "second", priority: 2, async execute() {} },
    wolf = { ...profile(Role.Wolf, [first]), possibleNightAbilities: ["seer_check" as const] },
    seer = profile(Role.Seer, [second]);
  let extraReads = 0;
  Object.defineProperty(seer, "possibleNightAbilities", {
    get() {
      extraReads++;
      throw new Error("derived_possible_read");
    },
  });
  const plan = new NightStageRegistry(createRoleCatalog([wolf, seer])).getPlan(config([Role.Wolf]));
  expect(extraReads).toBe(0);
  if (plan.mode !== "snapshot") throw new Error("expected_owned_snapshot");
  expect(plan.entries.map((entry) => entry.handler)).toEqual([first, second]);
  expect(plan.entries.map((entry) => entry.sources)).toEqual([
    [{ kind: "role-profile", role: Role.Wolf }],
    [{ kind: "role-profile", role: Role.Seer }],
  ]);
});

test("a native virtual override has explicit unknown source and original handler receiver", async () => {
  let calls = 0,
    correctReceiver = false;
  const handler: NightStageHandler = {
    id: "custom",
    priority: 1,
    async execute() {
      correctReceiver = this === handler;
    },
  };
  class Custom extends NightStageRegistry {
    override getStages() {
      calls++;
      return [handler];
    }
  }
  const plan = new Custom(createRoleCatalog([])).getPlan(config([]));
  expect(calls).toBe(1);
  if (plan.mode !== "snapshot") throw new Error("expected_owned_snapshot");
  expect(plan.entries[0]!.sources).toEqual([{ kind: "unknown", reason: "override" }]);
  await plan.entries[0]!.handler.execute(nightStageContext({ world: new World("en") }));
  expect(correctReceiver).toBe(true);
});

for (const mode of ["throw-after-first", "depends-on-first"] as const)
  test(`opaque execution entries preserve lazy first commit and next timing/${mode}`, async () => {
    const effects: string[] = [],
      pulls: string[] = [],
      failure = new Error("original_next_failure");
    const first: NightStageHandler = {
        id: "first",
        priority: 1,
        async execute() {
          effects.push(this === first ? "first" : "wrong_receiver");
        },
      },
      second: NightStageHandler = {
        id: "second",
        priority: 2,
        async execute() {
          effects.push(this === second ? "second" : "wrong_receiver");
        },
      },
      source = [first, second];
    let iteratorCalls = 0;
    Object.defineProperty(source, Symbol.iterator, {
      value: function* () {
        iteratorCalls++;
        pulls.push("first");
        yield first;
        pulls.push("next");
        if (mode === "throw-after-first") throw failure;
        if (!effects.includes("first")) throw new Error("first_not_committed");
        yield second;
      },
    });
    class Custom extends NightStageRegistry {
      override getStages() {
        return source;
      }
    }
    const plan = new Custom(createRoleCatalog([])).getPlan(config([]));
    expect(plan.mode).toBe("opaque");
    expect(iteratorCalls).toBe(0);
    let thrown: unknown;
    try {
      for (const entry of plan.entries) {
        expect(entry.sources).toEqual([{ kind: "unknown", reason: "override" }]);
        await entry.handler.execute(nightStageContext({ world: new World("en") }));
      }
    } catch (error) {
      thrown = error;
    }
    expect(iteratorCalls).toBe(1);
    expect(pulls).toEqual(["first", "next"]);
    expect(effects).toEqual(mode === "throw-after-first" ? ["first"] : ["first", "second"]);
    expect(thrown).toBe(mode === "throw-after-first" ? failure : undefined);
  });

test("Ghost clone capture keeps Map method, ID, spread and set order and original source reference", () => {
  const trace: string[] = [],
    chat: NightStageHandler = {
      get id() {
        trace.push("chat.id");
        return "wolf_discussion";
      },
      get priority() {
        trace.push("chat.priority");
        return 1;
      },
      async execute() {},
    },
    weddingChat: NightStageHandler = { id: "wedding_chat", priority: 2, async execute() {} },
    weddingKnife: NightStageHandler = { id: "wedding_knife", priority: 3, async execute() {} },
    map = new Map<string, NightStageHandler>([["wolf_discussion", chat]]),
    nativeSet = map.set;
  Object.defineProperty(map, "set", {
    get() {
      trace.push("get:set");
      return function (
        this: Map<string, NightStageHandler>,
        key: string,
        value: NightStageHandler,
      ) {
        trace.push(`set:${key}`);
        return nativeSet.call(this, key, value);
      };
    },
  });
  const changes = applyGhostBrideStageRegistration(map, weddingChat, weddingKnife);
  expect(trace).toEqual([
    "get:set",
    "set:wedding_chat",
    "get:set",
    "set:wedding_knife",
    "get:set",
    "chat.id",
    "chat.id",
    "chat.priority",
    "set:wolf_discussion",
  ]);
  expect(changes.map((change) => change.operation)).toEqual([
    "wedding-chat",
    "wedding-knife",
    "ordinary-chat-priority",
  ]);
  expect(changes[2]!.original).toBe(chat);
  expect(changes[2]!.handler).toBe(map.get("wolf_discussion")!);
  expect(changes[2]!.handler).not.toBe(chat);
  expect(Object.isFrozen(changes)).toBe(true);
  expect(changes.every(Object.isFrozen)).toBe(true);
});

test("the actual pipeline executes owned entries and preserves the original handler receiver", async () => {
  const game = bootstrapGame(sixPlayerMvpConfig, { random: createRandom("c21-entry-consumer") }),
    receivers: boolean[] = [],
    handler: NightStageHandler = {
      id: "controlled_entry",
      priority: 1,
      async execute() {
        receivers.push(this === handler);
      },
    };
  class EntriesOnly extends NightStageRegistry {
    override getPlan(...args: Parameters<NightStageRegistry["getPlan"]>) {
      const plan = super.getPlan(...args);
      return {
        ...plan,
        get stages(): never {
          throw new Error("legacy_stage_array_consumed");
        },
      };
    }
  }
  const pipeline = new NightPipeline({
    world: game.world,
    events: [],
    toolGateway: new ToolGateway(),
    damageResolutionSystem: new DamageResolutionSystem(),
    stageRegistry: new EntriesOnly(createRoleCatalog([profile(Role.Wolf, [handler])])),
  });
  const result = await pipeline.execute(sixPlayerMvpConfig, { getAction: async () => null }, 1);
  expect(result.interrupted).toBe(false);
  expect(receivers).toEqual([true]);
});
