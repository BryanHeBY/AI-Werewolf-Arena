/**
 * 单元测试验证警长三真实请求构造点的惰性、独立寿命及构造失败后的许可关闭。
 * 输入为测试自有 World、明确构造器 getter／类和原Provider；字面轨迹、实例／参数引用、许可与原错误是预期。
 * 不运行完整对局、模型或档案，不把构造签名和测试自建候选当资源／死亡授权。
 */
import { expect, test } from "bun:test";
import { Camp, Phase, Role, type GameEvent } from "@ai-werewolf-arena/game-contract";
import { World } from "../../../../src/domain/world";
import { COMPONENT } from "../../../../src/domain/components/names";
import { createAliveComponent } from "../../../../src/domain/components/alive";
import { createRoleComponent } from "../../../../src/domain/components/role";
import { createBadgeComponent } from "../../../../src/domain/components/badge";
import { createVotingRightComponent } from "../../../../src/domain/components/voting-right";
import { createIdentityComponent } from "../../../../src/domain/entities/player";
import type { ActionRequestConstructionInput } from "../../../../src/domain/actions";
import { GameActionRequestFactory } from "../../../../src/engine/actions/action-request-factory";
import { ToolGateway } from "../../../../src/engine/actions/tool-gateway";
import { electSheriffIfNeeded } from "../../../../src/features/sheriff/election";
import { chooseSpeakerDirection } from "../../../../src/features/sheriff/speaking-order";
import { resolveSheriffBadge } from "../../../../src/features/sheriff/badge-choice";
import { assignSheriff } from "../../../../src/features/sheriff/badge";

function fixture() {
  const world = new World(),
    events: GameEvent[] = [],
    gateway = new ToolGateway();
  for (let i = 0; i < 2; i++) {
    const id = world.createEntity();
    world.addComponent(id, COMPONENT.Alive, createAliveComponent());
    world.addComponent(id, COMPONENT.Role, createRoleComponent(Role.Villager));
    world.addComponent(id, COMPONENT.Camp, { camp: Camp.Good });
    world.addComponent(id, COMPONENT.Identity, createIdentityComponent(id, id, "literal:" + id));
    world.addComponent(id, COMPONENT.Badge, createBadgeComponent());
    world.addComponent(id, COMPONENT.VotingRight, createVotingRightComponent());
  }
  return { world, events, gateway };
}

test("disabled election and direction, absent holder and badge return before constructor lookup", async () => {
  const f = fixture();
  let reads = 0;
  const dependency = {
    get requestFactory(): never {
      reads++;
      throw new Error("literal_unneeded_ctor");
    },
  };
  const provider = {
    async getAction(): Promise<null> {
      throw new Error("literal_unneeded_provider");
    },
  };
  expect(
    await electSheriffIfNeeded({
      ...f,
      toolGateway: f.gateway,
      actionProvider: provider,
      day: 1,
      enableSheriff: false,
      get requestFactory() {
        return dependency.requestFactory;
      },
    }),
  ).toBeNull();
  expect(
    await chooseSpeakerDirection({
      ...f,
      toolGateway: f.gateway,
      actionProvider: provider,
      day: 1,
      enableSheriff: false,
      get requestFactory() {
        return dependency.requestFactory;
      },
    }),
  ).toBe("clockwise");
  expect(
    await chooseSpeakerDirection({
      ...f,
      toolGateway: f.gateway,
      actionProvider: provider,
      day: 1,
      enableSheriff: true,
      get requestFactory() {
        return dependency.requestFactory;
      },
    }),
  ).toBe("clockwise");
  await resolveSheriffBadge(
    f.world,
    1,
    "literal",
    f.events,
    f.gateway,
    provider,
    Phase.Day,
    1,
    () => true,
    dependency,
  );
  expect(reads).toBe(0);
  expect(f.events).toEqual([]);
});

test("election builds after alive collection once, direction constructs its separate original instance", async () => {
  const f = fixture(),
    trace: string[] = [],
    instances: TrackingRequests[] = [],
    used: TrackingRequests[] = [],
    days: number[] = [];
  const alive = f.world.getAliveEntityIds;
  f.world.getAliveEntityIds = function () {
    trace.push("alive");
    return alive.call(this);
  };
  class TrackingRequests extends GameActionRequestFactory {
    constructor(world: World, events: readonly GameEvent[], day: number) {
      super(world, events, day);
      expect(world).toBe(f.world);
      expect(events).toBe(f.events);
      instances.push(this);
      days.push(day);
      trace.push("new");
    }
    override create(input: ActionRequestConstructionInput) {
      used.push(this);
      return super.create(input);
    }
  }
  const winner = await electSheriffIfNeeded({
    world: f.world,
    events: f.events,
    toolGateway: f.gateway,
    day: 1,
    enableSheriff: true,
    get requestFactory() {
      trace.push("election-factory");
      return TrackingRequests;
    },
    actionProvider: {
      async getAction() {
        return { name: "run_for_sheriff" as const, args: { run: false } };
      },
    },
  });
  expect(winner).toBeNull();
  expect(trace.slice(0, 4)).toEqual(["alive", "alive", "election-factory", "new"]);
  expect(instances).toHaveLength(1);
  expect(used).toEqual([instances[0]!, instances[0]!]);
  expect(assignSheriff(f.world, 1)).toBe(true);
  const direction = await chooseSpeakerDirection({
    world: f.world,
    events: f.events,
    toolGateway: f.gateway,
    day: 4,
    enableSheriff: true,
    get requestFactory() {
      trace.push("direction-factory");
      return TrackingRequests;
    },
    actionProvider: {
      async getAction() {
        return null;
      },
    },
  });
  expect(direction).toBe("clockwise");
  expect(instances).toHaveLength(2);
  expect(instances[1]).not.toBe(instances[0]);
  expect(used.at(-1)).toBe(instances[1]);
  expect(days).toEqual([1, 4]);
});

test("badge constructor failure happens after permit opening and finally closes without committing a choice", async () => {
  const f = fixture(),
    trace: string[] = [],
    failure = new Error("literal_badge_ctor_failed");
  const badge = f.world.getComponent(1, COMPONENT.Badge)!;
  badge.isSheriff = true;
  badge.handoffPolicy = "awa_holder_choice_v1";
  f.world.getComponent(1, COMPONENT.Alive)!.alive = false;
  f.events.push({
    timestamp: 0,
    type: "day_speech",
    payload: { actorId: 2, text: "literal-existing-prefix" },
  });
  const prefix = [...f.events];
  let permitId: number | undefined;
  const open = f.world.openDeathAction;
  // 调用真实开放方法并保 receiver／参数／原permit；只在测试记录这次身份，不把缺id查询当许可。
  f.world.openDeathAction = function (...args: Parameters<World["openDeathAction"]>) {
    trace.push("permit");
    const permit = open.apply(this, args);
    permitId = permit.id;
    return permit;
  };
  class FailingRequests {
    constructor(world: World, events: readonly GameEvent[], day: number) {
      trace.push("new");
      expect(new.target).toBe(FailingRequests);
      expect(world).toBe(f.world);
      expect(events).toBe(f.events);
      expect(day).toBe(7);
      expect(world.hasDeathAction(1, "choose_badge_successor", Phase.Day, 7, permitId)).toBe(true);
      throw failure;
    }
    create(): never {
      throw new Error("literal_create_unreachable");
    }
  }
  await expect(
    resolveSheriffBadge(
      f.world,
      1,
      "literal",
      f.events,
      f.gateway,
      {
        async getAction(): Promise<null> {
          throw new Error("literal_provider_unreachable");
        },
      },
      Phase.Day,
      7,
      () => true,
      {
        get requestFactory() {
          trace.push("factory");
          return FailingRequests;
        },
      },
    ),
  ).rejects.toBe(failure);
  expect(trace).toEqual(["permit", "factory", "new"]);
  expect(f.world.hasDeathAction(1, "choose_badge_successor", Phase.Day, 7, permitId)).toBe(false);
  expect(badge).toMatchObject({ isSheriff: true, destroyed: false });
  expect(f.events).toEqual(prefix);
});
