/**
 * 单元测试验证盗贼／千面人公共牌组发布的原晚读、数组receiver及异常前缀。
 * 输入是测试自有World、真实已安装牌组和明确getter／时钟；预期是字面事件与读取顺序。
 * 公共整副牌组不含手牌映射、不授设置许可；本测试不运行首夜选择、完整阶段或模型。
 */
import { expect, test } from "bun:test";
import type { GameEvent } from "@ai-werewolf-arena/game-contract/events";
import { World } from "../../../../src/domain/world";
import { COMPONENT } from "../../../../src/domain/components/names";
import { createRoleComponent } from "../../../../src/domain/components/role";
import { createVictoryComponent } from "../../../../src/domain/components/victory";
import { Camp, Role } from "../../../../src/domain/identity";
import { createAliveComponent } from "../../../../src/agents/observation/component-presentation";
import {
  initialIdentityDeal,
  installInitialIdentityDeal,
} from "../../../../src/features/initial-identity/deal";
import { publishInitialIdentityDeal } from "../../../../src/features/initial-identity/initial-deal-publication";

function fixture(kind: "thief" | "shapeshifter") {
  const world = new World();
  const ids = [world.createEntity(), world.createEntity()];
  world.addComponent(ids[0]!, COMPONENT.Role, createRoleComponent(Role.Wolf));
  world.addComponent(ids[0]!, COMPONENT.Camp, { camp: Camp.Wolf });
  world.addComponent(ids[1]!, COMPONENT.Role, createRoleComponent(Role.Villager));
  world.addComponent(ids[1]!, COMPONENT.Camp, { camp: Camp.Good });
  for (const id of ids) world.addComponent(id, COMPONENT.Alive, createAliveComponent());
  world.addComponent(
    ids[0]!,
    COMPONENT.Victory,
    createVictoryComponent([{ kind: "faction", faction: Camp.Wolf }]),
  );
  world.addComponent(
    ids[1]!,
    COMPONENT.Victory,
    createVictoryComponent([{ kind: "faction", faction: Camp.Good }]),
  );
  installInitialIdentityDeal(
    world,
    [Role.Wolf, Role.Villager, Role.Villager, Role.Villager],
    ids,
    kind,
  );
  return world;
}

test("no initial deal still queries kind before skipping public fields", () => {
  const world = new World(),
    trace: string[] = [];
  const failure = new Error("literal_second_world_failure");
  expect(() =>
    publishInitialIdentityDeal({
      world() {
        trace.push("world");
        if (trace.length === 2) throw failure;
        return world;
      },
      events() {
        trace.push("events");
        return [];
      },
      boardSize() {
        trace.push("board");
        return 2;
      },
    }),
  ).toThrow(failure);
  expect(trace).toEqual(["world", "world"]);
});

test("both initial kinds publish the copied public deck with original push receiver and clock order", () => {
  for (const kind of ["thief", "shapeshifter"] as const) {
    const world = fixture(kind),
      events: GameEvent[] = [],
      trace: string[] = [];
    Object.defineProperty(events, "push", {
      configurable: true,
      get() {
        trace.push("push");
        return Array.prototype.push;
      },
    });
    const originalNow = Date.now;
    Date.now = () => {
      trace.push("clock");
      return 7;
    };
    try {
      publishInitialIdentityDeal({
        world() {
          trace.push("world");
          return world;
        },
        events() {
          trace.push("events");
          return events;
        },
        boardSize() {
          trace.push("board");
          return 2;
        },
      });
    } finally {
      Date.now = originalNow;
    }
    expect(trace).toEqual(["world", "world", "board", "events", "push", "clock"]);
    expect(events as unknown).toEqual([
      {
        timestamp: 7,
        type: kind === "shapeshifter" ? "shapeshifter_initial_deal" : "thief_initial_deal",
        payload: {
          roles: ["wolf", "villager", "villager", "villager"],
          boardSize: 2,
          policy:
            kind === "shapeshifter"
              ? "awa_netease_shapeshifter_two_extra_villagers_v1"
              : "lui_meme_thief_two_extra_villagers_v1",
        },
      },
    ]);
    expect(events[0]!.payload).not.toHaveProperty("hands");
    expect(initialIdentityDeal(world) as unknown).toEqual([
      "wolf",
      "villager",
      "villager",
      "villager",
    ]);
  }
});

test("push lookup failure follows board size and precedes clock without changing the initial stock", () => {
  const world = fixture("thief"),
    events: GameEvent[] = [],
    trace: string[] = [];
  const failure = new Error("literal_initial_deal_push_failure");
  Object.defineProperty(events, "push", {
    configurable: true,
    get() {
      trace.push("push");
      throw failure;
    },
  });
  const originalNow = Date.now;
  Date.now = () => {
    trace.push("clock");
    return 7;
  };
  try {
    expect(() =>
      publishInitialIdentityDeal({
        world() {
          trace.push("world");
          return world;
        },
        events() {
          trace.push("events");
          return events;
        },
        boardSize() {
          trace.push("board");
          return 2;
        },
      }),
    ).toThrow(failure);
  } finally {
    Date.now = originalNow;
  }
  expect(trace).toEqual(["world", "world", "board", "events", "push"]);
  expect(events).toHaveLength(0);
  expect(initialIdentityDeal(world) as unknown).toEqual([
    "wolf",
    "villager",
    "villager",
    "villager",
  ]);
});
