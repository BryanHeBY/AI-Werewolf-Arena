/**
 * 验证真实判胜扩展只取得窄查询；手写成员、统计和调用顺序作为预期。
 * 查询保持实时，候选构造不封盘；跨局绑定和检查点过滤不依赖默认条件的实现反推结果。
 */
import { expect, test } from "bun:test";
import { bootstrapGame } from "../../../src/app/bootstrap";
import { COMPONENT, Camp, Role, WinCondition } from "../../../src/domain";
import { World } from "../../../src/domain/world";
import { sixPlayerMvpConfig } from "../../../src/rulesets/presets/six-player-mvp";
import { WinConditionRegistry } from "../../../src/engine/victory/condition-registry";
import type { VictoryQueries, WinConditionSpec } from "../../../src/engine/victory/contracts";

function fixture() {
  return bootstrapGame(sixPlayerMvpConfig, {
    fixedRoles: [Role.Wolf, Role.Wolf, Role.Seer, Role.Guard, Role.Villager, Role.Villager],
  });
}

test("自定义判胜取得实时值查询和成员候选构造，不能改写世界", () => {
  const { world } = fixture();
  let observed: VictoryQueries | undefined;
  const spec: WinConditionSpec = {
    id: WinCondition.SlaughterCity,
    evaluate(queries) {
      expect(this).toBe(spec);
      observed = queries;
      for (const key of [
        "world",
        "getWorld",
        "getComponent",
        "addComponent",
        "removeComponent",
        "openDeathAction",
      ])
        expect(key in queries).toBe(false);
      expect(queries.aliveIds()).toEqual([1, 2, 3, 4, 5, 6]);
      expect(queries.role(3)).toBe(Role.Seer);
      expect(queries.camp(1)).toBe(Camp.Wolf);
      expect(queries.eliminationCounts()).toEqual({ wolves: 2, gods: 2, villagers: 2, good: 4 });
      return queries.decision({ kind: "faction", faction: Camp.Good }, "custom_candidate");
    },
  };
  const result = new WinConditionRegistry([spec]).evaluate(world, WinCondition.SlaughterCity)!;
  expect(result).toEqual({
    winner: Camp.Good,
    reason: "custom_candidate",
    outcome: {
      kind: "victory",
      primary: { kind: "faction", faction: Camp.Good, winningPlayerIds: [3, 4, 5, 6] },
      additional: [],
      winningPlayerIds: [3, 4, 5, 6],
    },
  });
  // 查询数组是数据副本；后续领域写入仍由真实所有者实施，旧查询能看到新值。
  (observed!.entityIds() as number[]).push(99);
  expect(world.entityIds()).toEqual([1, 2, 3, 4, 5, 6]);
  world.getComponent(1, COMPONENT.Alive)!.alive = false;
  expect(observed!.aliveIds()).toEqual([2, 3, 4, 5, 6]);
  expect(observed!.eliminationCounts()).toEqual({ wolves: 1, gods: 2, villagers: 2, good: 4 });
  expect(world.activeDeathActionCount).toBe(0);
});

test("检查点先于查询构造和实际读取，首次查询异常保原错误", () => {
  const world = new World(),
    failure = new Error("victory_late_query");
  const trace: string[] = [];
  Object.defineProperty(world, "getComponent", {
    get() {
      trace.push("component");
      throw failure;
    },
  });
  const registry = new WinConditionRegistry([
    {
      id: WinCondition.SlaughterCity,
      checkpoints: ["exile_settled"],
      evaluate(queries) {
        trace.push("evaluate");
        queries.camp(1);
        return null;
      },
    },
  ]);
  expect(registry.evaluate(world, WinCondition.SlaughterCity, "night_settled")).toBeNull();
  expect(trace).toEqual([]);
  try {
    registry.evaluate(world, WinCondition.SlaughterCity, "exile_settled");
    throw Error("must_throw");
  } catch (error) {
    expect(error).toBe(failure);
  }
  expect(trace).toEqual(["evaluate", "component"]);
});

test("默认注册表和自定义规格都不缓存上一局的世界", () => {
  const first = fixture().world,
    second = fixture().world;
  first.getComponent(1, COMPONENT.Alive)!.alive = false;
  const views: VictoryQueries[] = [];
  const registry = new WinConditionRegistry([
    {
      id: WinCondition.SlaughterCity,
      evaluate(queries) {
        views.push(queries);
        return null;
      },
    },
  ]);
  registry.evaluate(first, WinCondition.SlaughterCity);
  registry.evaluate(second, WinCondition.SlaughterCity);
  expect(views[0]).not.toBe(views[1]);
  expect(views[0]!.aliveIds()).toEqual([2, 3, 4, 5, 6]);
  expect(views[1]!.aliveIds()).toEqual([1, 2, 3, 4, 5, 6]);
});
