/**
 * 单元测试验证开局公开配比的三种真实来源及原读取／写入前缀。输入为已安装初发牌、字面板子和普通 getter；
 * 输出以手写计数、完整 trace、原 Map 引用和错误验收，不从生产聚合构造预期。
 * 实际提示构造保人数先写、候选优先和原 World 方法接收方；这里不选择身份、授予许可或运行完整对局。
 */
import { expect, test } from "bun:test";
import { Camp, Role, type ReadonlyBoardConfig } from "@ai-werewolf-arena/game-contract";
import { World } from "../../../src/core/domain/world";
import { COMPONENT } from "../../../src/core/domain/components/names";
import { createAliveComponent } from "../../../src/core/domain/components/alive";
import { createRoleComponent } from "../../../src/game/observation/role-presentation";
import { installInitialIdentityDeal } from "../../../src/game/mechanisms/roles/initial_identity/deal";
import { collectPlayerInitialPublicCounts } from "../../../src/game/observation/player-initial-public-counts";
import {
  PlayerPromptPolicy,
  type PlayerPromptPolicyOptions,
} from "../../../src/ai/agents/player/player_prompt_policy";
import {
  getDefaultRoleCatalog,
  getDefaultToolSpecRegistry,
  getDefaultTargetHintRegistry,
  getDefaultPhaseStageLocalizationRegistry,
  getDefaultConfigRenderRegistry,
} from "../../../src/game/mechanisms";

const board: ReadonlyBoardConfig = {
  boardSize: 2,
  enableSheriff: false,
  hooks: {
    onDaybreak: false,
    onPreElection: false,
    onPreVote: false,
    onPerSpeechGap: false,
  },
  roleSetups: [],
};

function options(getBoard: () => ReadonlyBoardConfig | undefined): PlayerPromptPolicyOptions {
  return {
    get boardConfig() {
      return getBoard();
    },
    roleCatalog: getDefaultRoleCatalog(),
    toolSpecRegistry: getDefaultToolSpecRegistry(),
    targetHintRegistry: getDefaultTargetHintRegistry(),
    phaseStageLocalizationRegistry: getDefaultPhaseStageLocalizationRegistry(),
    configRenderRegistry: getDefaultConfigRenderRegistry(),
  };
}

/** 仅检查已有运行字段；类型断言不新增生产出口或复制缓存。 */
function cache(policy: PlayerPromptPolicy) {
  return policy as unknown as {
    publicRoleCounts: Map<Role, number>;
    publicBoardSize: number;
  };
}

test("actual policy gives initial N+2 counts priority and keeps its original cache after role changes", () => {
  const world = new World(),
    thief = world.createEntity(),
    villager = world.createEntity();
  for (const [id, role] of [
    [thief, Role.Thief],
    [villager, Role.Villager],
  ] as const) {
    world.addComponent(id, COMPONENT.Role, createRoleComponent(role, Camp.Good));
    world.addComponent(id, COMPONENT.Alive, createAliveComponent());
    world.addComponent(id, COMPONENT.Camp, { camp: Camp.Good });
    world.addComponent(id, COMPONENT.Victory, {
      affiliations: [{ kind: "faction", faction: "good" }],
    });
  }
  installInitialIdentityDeal(
    world,
    [Role.Thief, Role.Villager, Role.Wolf, Role.Villager],
    [thief, villager],
  );
  let boardReads = 0;
  const policy = new PlayerPromptPolicy(
    world,
    options(() => {
      boardReads++;
      return {
        ...board,
        get roleSetups(): ReadonlyBoardConfig["roleSetups"] {
          throw new Error("candidate_counts_must_not_read_board_roles");
        },
      };
    }),
  );
  const originalCounts = cache(policy).publicRoleCounts;
  expect(cache(policy).publicBoardSize).toBe(2);
  expect(boardReads).toBe(1);
  expect([...originalCounts]).toEqual([
    [Role.Thief, 1],
    [Role.Villager, 2],
    [Role.Wolf, 1],
  ]);
  world.addComponent(villager, COMPONENT.Role, createRoleComponent(Role.Wolf, Camp.Wolf));
  expect(cache(policy).publicRoleCounts).toBe(originalCounts);
  expect([...cache(policy).publicRoleCounts]).toEqual([
    [Role.Thief, 1],
    [Role.Villager, 2],
    [Role.Wolf, 1],
  ]);
});

test("board aggregation keeps set lookup before get and leaves the first write when the next count fails", () => {
  const world = new World(),
    counts = new Map<Role, number>(),
    trace: string[] = [],
    failure = new Error("literal_second_count_failure");
  let boardReads = 0;
  Object.defineProperty(counts, "set", {
    get() {
      trace.push("set:lookup");
      return function (this: Map<Role, number>, role: Role, count: number) {
        trace.push(this === counts ? "set:bound" : "set:foreign");
        return Map.prototype.set.call(this, role, count);
      };
    },
  });
  Object.defineProperty(counts, "get", {
    get() {
      trace.push("get:lookup");
      return function (this: Map<Role, number>, role: Role) {
        trace.push(this === counts ? "get:bound" : "get:foreign");
        return Map.prototype.get.call(this, role);
      };
    },
  });
  const configured: ReadonlyBoardConfig = {
    ...board,
    roleSetups: [
      { role: Role.Wolf, count: 2 },
      {
        role: Role.Villager,
        get count(): number {
          trace.push("second:count");
          throw failure;
        },
      },
    ],
  };
  expect(() =>
    collectPlayerInitialPublicCounts({
      world: () => world,
      boardConfig() {
        trace.push(`board:${boardReads++}`);
        return configured;
      },
      role() {
        throw new Error("board_counts_must_not_query_roles");
      },
      counts() {
        trace.push("counts");
        return counts;
      },
    }),
  ).toThrow(failure);
  expect(trace).toEqual([
    "board:0",
    "board:1",
    "counts",
    "set:lookup",
    "counts",
    "get:lookup",
    "get:bound",
    "set:bound",
    "second:count",
  ]);
  expect([...counts]).toEqual([[Role.Wolf, 2]]);
});

test("a board disappearing on the second read retains the original failure before any cache write", () => {
  const world = new World(),
    counts = new Map<Role, number>(),
    trace: string[] = [];
  let reads = 0;
  expect(() =>
    collectPlayerInitialPublicCounts({
      world: () => world,
      boardConfig() {
        trace.push(`board:${reads}`);
        return reads++ === 0 ? board : undefined;
      },
      role() {
        throw new Error("missing_board_must_not_fall_back_to_roles");
      },
      counts() {
        trace.push("counts");
        return counts;
      },
    }),
  ).toThrow(TypeError);
  expect(trace).toEqual(["board:0", "board:1"]);
  expect([...counts]).toEqual([]);
});

test("actual no-board policy keeps World receivers and two distinct role field reads in the original order", () => {
  const world = new World(),
    first = world.createEntity(),
    second = world.createEntity(),
    role = createRoleComponent(Role.Villager, Camp.Good),
    trace: string[] = [];
  let boardReads = 0,
    roleReads = 0;
  Object.defineProperty(role, "role", {
    get() {
      trace.push(`role:${roleReads}`);
      return roleReads++ === 0 ? Role.Wolf : Role.Villager;
    },
  });
  Object.defineProperty(world, "entityIds", {
    get() {
      trace.push("entity:callee");
      return function (this: World) {
        trace.push(this === world ? "entity:bound" : "entity:foreign");
        return [first, second];
      };
    },
  });
  Object.defineProperty(world, "getComponent", {
    get() {
      trace.push("component:callee");
      return function (this: World, actorId: number) {
        trace.push(this === world ? `component:bound:${actorId}` : "component:foreign");
        return actorId === first ? role : undefined;
      };
    },
  });
  const policy = new PlayerPromptPolicy(
    world,
    options(() => {
      trace.push(`board:${boardReads++}`);
      return undefined;
    }),
  );
  expect(trace).toEqual([
    "board:0",
    "entity:callee",
    "entity:bound",
    "board:1",
    "entity:callee",
    "entity:bound",
    "component:callee",
    `component:bound:${first}`,
    "role:0",
    "role:1",
    "component:callee",
    `component:bound:${second}`,
  ]);
  expect(cache(policy).publicBoardSize).toBe(2);
  expect([...cache(policy).publicRoleCounts]).toEqual([[Role.Wolf, 1]]);
});
