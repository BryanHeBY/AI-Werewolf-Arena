/**
 * 单元测试负责开局馥郁双生贡献的配置短路、原参数晚读取及首个异常前缀。
 * 输入为真实 World、最小原配置字段和受控查询／事件故障；读取轨迹与原错误为手写字面预期。
 * 受控角色查询不冒有效阵容或安装许可；实际初始板的 bootstrap 另以原精准用例验证，不运行模型或完整周期。
 */
import { expect, test } from "bun:test";
import { World } from "../../../src/domain/world";
import { Role } from "../../../src/domain/identity";
import type { GameEvent } from "@ai-werewolf-arena/game-contract";
import { fragrantPairSeerTwelveConfig } from "../../../src/rulesets/presets/fragrant-pair-seer-twelve";
import { isFragrantPairBoard } from "../../../src/features/fragrant-pair-seer/ports";
import { installFragrantGameSetup } from "../../../src/rulesets/game-setup";

test("absent fragrant setup reads configuration once without World or events", () => {
  const trace: string[] = [];
  const config = {
    get fragrantPairSeer() {
      trace.push("config");
      return undefined;
    },
  };
  const result = installFragrantGameSetup(config, {
    world(): World {
      throw new Error("unexpected_world_read");
    },
    events(): GameEvent[] {
      throw new Error("unexpected_events_read");
    },
  });
  expect(result).toBeUndefined();
  expect(trace).toEqual(["config"]);
});

test("second original role query failure preserves first index read before installation", () => {
  const trace: string[] = [],
    world = new World(),
    events: GameEvent[] = [];
  const failure = new Error("second_role_query_failure");
  const config = {
    get fragrantPairSeer() {
      trace.push("config");
      return fragrantPairSeerTwelveConfig.fragrantPairSeer;
    },
  };
  Object.defineProperty(world, "getEntityIdsByRole", {
    get() {
      trace.push("role:get");
      return function (this: World, role: Role): number[] {
        expect(this).toBe(world);
        trace.push(`role:call:${role}`);
        if (role === Role.AwakenedSeer) throw failure;
        const ids = [1];
        Object.defineProperty(ids, "0", {
          get() {
            trace.push("index:first");
            return 1;
          },
        });
        return ids;
      };
    },
  });
  let thrown: unknown;
  try {
    installFragrantGameSetup(config, {
      world() {
        trace.push("world");
        return world;
      },
      events() {
        trace.push("events");
        return events;
      },
    });
  } catch (error) {
    thrown = error;
  }
  expect(thrown).toBe(failure);
  expect(trace).toEqual([
    "config",
    "world",
    "events",
    "world",
    "role:get",
    "role:call:fragrant_phantom",
    "index:first",
    "world",
    "role:get",
    "role:call:awakened_seer",
  ]);
  expect(isFragrantPairBoard(world)).toBe(false);
  expect(events).toEqual([]);
});

test("original authority rejects foreign event prototype after both argument lookups", () => {
  const trace: string[] = [],
    world = new World();
  class ForeignEvents extends Array<GameEvent> {}
  const events = new ForeignEvents();
  Object.defineProperty(world, "getEntityIdsByRole", {
    value(role: Role) {
      trace.push(role);
      return [role === Role.FragrantPhantom ? 1 : 2];
    },
  });
  Object.defineProperty(world, "entityIds", {
    value() {
      throw new Error("unexpected_roster_capture");
    },
  });
  expect(() =>
    installFragrantGameSetup(fragrantPairSeerTwelveConfig, {
      world() {
        trace.push("world");
        return world;
      },
      events() {
        trace.push("events");
        return events;
      },
    }),
  ).toThrow("fragrant_initial_events_invalid");
  expect(trace).toEqual(["world", "events", "world", "fragrant_phantom", "world", "awakened_seer"]);
  expect(isFragrantPairBoard(world)).toBe(false);
});
