/**
 * 单元测试负责验证真实判胜扩展只取得窄查询；手写成员、统计和调用顺序作为预期。
 * 查询保持实时，候选构造不封盘；跨局绑定和检查点过滤不依赖默认条件的实现反推结果。
 */
import { bindVictoryQueries } from "../../../src/rulesets/victory/default-specs";
import { expect, test } from "bun:test";
import { bootstrapGame } from "../../../src/app/bootstrap";
import { COMPONENT, Camp, Role, WinCondition } from "../../../src/domain";
import { World } from "../../../src/domain/world";
import { sixPlayerMvpConfig } from "../../../src/rulesets/presets/six-player-mvp";
import { WinConditionRegistry } from "../../../src/engine/victory/condition-registry";
import type { VictoryQueries, WinConditionSpec } from "../../../src/engine/victory/contracts";
import {
  ConditionRegistry,
  type WinConditionEvaluator,
} from "../../../src/domain/registries/condition-registry";

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
  const result = new WinConditionRegistry([spec]).evaluate(
    bindVictoryQueries(world),
    WinCondition.SlaughterCity,
  )!;
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

test("检查点先于实际查询读取，首次查询异常保原错误", () => {
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
  expect(
    registry.evaluate(bindVictoryQueries(world), WinCondition.SlaughterCity, "night_settled"),
  ).toBeNull();
  expect(trace).toEqual([]);
  try {
    registry.evaluate(bindVictoryQueries(world), WinCondition.SlaughterCity, "exile_settled");
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
  registry.evaluate(bindVictoryQueries(first), WinCondition.SlaughterCity);
  registry.evaluate(bindVictoryQueries(second), WinCondition.SlaughterCity);
  expect(views[0]).not.toBe(views[1]);
  expect(views[0]!.aliveIds()).toEqual([2, 3, 4, 5, 6]);
  expect(views[1]!.aliveIds()).toEqual([1, 2, 3, 4, 5, 6]);
});

test("下层判胜评估器只取得实际查询与原接收者，返回候选不提交世界", () => {
  const { world } = fixture();
  const candidate = {
    winner: null,
    reason: "literal_custom_evaluator",
    outcome: { kind: "no_winner" as const },
  };
  const trace: string[] = [];
  let observed: VictoryQueries | undefined;
  const evaluator: WinConditionEvaluator = {
    evaluate(queries, condition, checkpoint) {
      trace.push("evaluate");
      expect(this).toBe(evaluator);
      observed = queries;
      expect(condition).toBe(WinCondition.SlaughterCity);
      expect(checkpoint).toBe("night_settled");
      expect(Object.keys(queries).sort()).toEqual([
        "aliveIds",
        "camp",
        "cupidCityDecision",
        "decision",
        "eliminationCounts",
        "entityIds",
        "role",
        "weddingFactionResult",
      ]);
      for (const key of [
        "world",
        "getWorld",
        "getComponent",
        "addComponent",
        "removeComponent",
        "createEntity",
      ])
        expect(key in queries).toBe(false);
      expect(queries.role(3)).toBe(Role.Seer);
      expect(queries.camp(1)).toBe(Camp.Wolf);
      expect(queries.aliveIds()).toEqual([1, 2, 3, 4, 5, 6]);
      return candidate;
    },
  };
  const registry = new ConditionRegistry(evaluator);
  const result = registry.evaluate(
    bindVictoryQueries(world),
    WinCondition.SlaughterCity,
    "night_settled",
  );
  expect(result).toBe(candidate);
  expect(trace).toEqual(["evaluate"]);
  // 只有真实所有者写生命；旧查询仍晚读同一局，返回数组本身不持组件或库存。
  const ids = observed!.entityIds() as number[];
  ids.push(99);
  expect(world.entityIds()).toEqual([1, 2, 3, 4, 5, 6]);
  world.getComponent(1, COMPONENT.Alive)!.alive = false;
  expect(observed!.aliveIds()).toEqual([2, 3, 4, 5, 6]);
  expect(world.activeDeathActionCount).toBe(0);
});

test("下层判胜覆盖先于评估，晚callee首异常保原对象且不读取查询", () => {
  const world = new World();
  const failure = new Error("literal_lower_evaluator_callee");
  const candidate = {
    winner: null,
    reason: "literal_override",
    outcome: { kind: "no_winner" as const },
  };
  const trace: string[] = [];
  const evaluator: WinConditionEvaluator = {
    get evaluate(): WinConditionEvaluator["evaluate"] {
      trace.push("callee");
      throw failure;
    },
  };
  Object.defineProperty(world, "getComponent", {
    get() {
      trace.push("component");
      throw new Error("must_not_query");
    },
  });
  const queries = bindVictoryQueries(world);
  const registry = new ConditionRegistry(evaluator);
  expect(
    registry.evaluateMany(queries, [WinCondition.SlaughterCity], "night_settled", {
      [WinCondition.SlaughterCity]: candidate,
    }),
  ).toBe(candidate);
  expect(trace).toEqual([]);
  try {
    registry.evaluateMany(queries, [WinCondition.SlaughterCity], "night_settled");
    throw new Error("must_throw");
  } catch (error) {
    expect(error).toBe(failure);
  }
  expect(trace).toEqual(["callee"]);
});

test("下层判胜连续规格各持新查询表，早规格改方法并返回空不污染后规格", () => {
  const { world } = fixture();
  const source = bindVictoryQueries(world);
  const views: VictoryQueries[] = [];
  const candidate = {
    winner: null,
    reason: "literal_second_spec",
    outcome: { kind: "no_winner" as const },
  };
  const registry = new ConditionRegistry(
    new WinConditionRegistry([
      {
        id: WinCondition.SlaughterCity,
        evaluate(queries) {
          views.push(queries);
          // 现行规格可以覆盖自己的数据字段；下一规格应仍取得新的表和真实默认查询。
          queries.camp = () => Camp.Good;
          queries.eliminationCounts = () => ({ wolves: 99, gods: 0, villagers: 0, good: 0 });
          expect(queries.camp(1)).toBe(Camp.Good);
          return null;
        },
      },
      {
        id: WinCondition.SlaughterSide,
        evaluate(queries) {
          views.push(queries);
          expect(queries).not.toBe(views[0]);
          expect(queries.camp(1)).toBe(Camp.Wolf);
          expect(queries.eliminationCounts()).toEqual({
            wolves: 2,
            gods: 2,
            villagers: 2,
            good: 4,
          });
          return candidate;
        },
      },
    ]),
  );
  expect(
    registry.evaluateMany(
      source,
      [WinCondition.SlaughterCity, WinCondition.SlaughterSide],
      "night_settled",
    ),
  ).toBe(candidate);
  expect(views).toHaveLength(2);
  expect(source.camp(1)).toBe(Camp.Wolf);
  expect(world.activeDeathActionCount).toBe(0);
});
