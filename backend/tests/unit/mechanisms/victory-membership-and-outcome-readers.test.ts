/**
 * 单元测试：验证判胜条件优先级、阵营／个人／关系成员与严格 outcome reader。输入为原名单和纯结果数据；独立字面预期检查规则次序与读取拒绝，不用被测算法生成预期。
 */
import { bindVictoryQueries } from "../../../src/rulesets/victory/default-specs";
import { expect, test } from "bun:test";
import { bootstrapGame } from "../../../src/app/bootstrap";
import {
  COMPONENT,
  Camp,
  Phase,
  Role,
  WinCondition,
  createVictoryComponent,
  type RoleComponent,
} from "../../../src/domain";
import { sixPlayerMvpConfig } from "../../../src/rulesets/presets/six-player-mvp";
import { ConditionRegistry } from "../../../src/domain/registries/condition-registry";
import { WinConditionRegistry } from "../../../src/engine/victory/condition-registry";
import { victoryDecision } from "../../../src/engine/victory/results";
import { captureCheckpoint } from "../../../src/app/simulation/reproduction-context";
import { readGameOutcome, readVictoryPoint } from "@ai-werewolf-arena/replay-contract";

const deck = [Role.Wolf, Role.Wolf, Role.Seer, Role.Guard, Role.Villager, Role.Villager];

const fixture = (locale: "zh-CN" | "en") =>
  bootstrapGame(
    { ...sixPlayerMvpConfig, winConditions: [WinCondition.SlaughterCity] },
    { locale, fixedRoles: deck },
  );

function dead(world: ReturnType<typeof fixture>["world"], ids: number[]) {
  for (const id of ids) world.getComponent(id, COMPONENT.Alive)!.alive = false;
}

for (const locale of ["zh-CN", "en"] as const)
  test(`${locale}: native conditions declare all faction winners including dead teammates and retain ordered condition priority`, () => {
    for (const mode of [
      WinCondition.SlaughterCity,
      WinCondition.SlaughterSide,
      WinCondition.WolfReachHalf,
    ]) {
      const { world } = fixture(locale);
      dead(world, [1, 2, 4]);
      const result = new ConditionRegistry(new WinConditionRegistry()).evaluate(
        bindVictoryQueries(world),
        mode,
      );
      expect(result).toEqual({
        winner: Camp.Good,
        reason: "all_wolves_eliminated",
        outcome: {
          kind: "victory",
          primary: { kind: "faction", faction: "good", winningPlayerIds: [3, 4, 5, 6] },
          additional: [],
          winningPlayerIds: [3, 4, 5, 6],
        },
      });
    }
    const { world } = fixture(locale);
    dead(world, [3, 4]);
    const registry = new ConditionRegistry(new WinConditionRegistry());
    expect(
      registry.evaluateMany(bindVictoryQueries(world), [
        WinCondition.SlaughterSide,
        WinCondition.WolfReachHalf,
      ])!.reason,
    ).toBe("slaughter_side_completed");
    expect(
      registry.evaluateMany(bindVictoryQueries(world), [
        WinCondition.WolfReachHalf,
        WinCondition.SlaughterSide,
      ])!.reason,
    ).toBe("wolves_reach_half");
    dead(world, [1, 2, 5, 6]);
    expect(registry.evaluate(bindVictoryQueries(world), WinCondition.SlaughterCity)!.winner).toBe(
      Camp.Good,
    ); // 同时全员死亡的优先级。
  });

for (const locale of ["zh-CN", "en"] as const)
  test(`${locale}: win membership is independent of identity, true camp, survival and abilities; third-party gods do not count as good gods`, () => {
    const { world } = fixture(locale);
    const template = [{ kind: "faction" as const, faction: "wolf" as const }];
    world.addComponent(5, COMPONENT.Victory, createVictoryComponent(template));
    template.length = 0;
    const result = victoryDecision(world, { kind: "faction", faction: "wolf" }, "scenario_faction");
    expect(result.outcome).toEqual({
      kind: "victory",
      primary: { kind: "faction", faction: "wolf", winningPlayerIds: [1, 2, 5] },
      additional: [],
      winningPlayerIds: [1, 2, 5],
    });
    expect(world.getComponent(5, COMPONENT.Role)).toMatchObject({
      role: Role.Villager,
    });
    expect(world.getComponent(5, COMPONENT.Camp)!.camp).toBe(Camp.Good);
    world.getComponent(3, COMPONENT.Camp)!.camp = Camp.ThirdParty;
    dead(world, [4]);
    expect(
      new ConditionRegistry(new WinConditionRegistry()).evaluate(
        bindVictoryQueries(world),
        WinCondition.SlaughterSide,
      )!.reason,
    ).toBe("slaughter_side_completed");
    const checkpoint = captureCheckpoint(
      world,
      { day: 1, phase: Phase.Night, gameOver: false, result: null },
      0,
      true,
      0,
    );
    expect(checkpoint.players[4].victory).toEqual({
      affiliations: [{ kind: "faction", faction: "wolf" }],
    });
  });

for (const locale of ["zh-CN", "en"] as const)
  test(`${locale}: individual, relationship and additional faction wins explicitly declare a deduplicated winner union`, () => {
    const { world } = fixture(locale);
    world.addComponent(
      5,
      COMPONENT.Victory,
      createVictoryComponent([{ kind: "individual", goalId: "scenario_solo" }]),
    );
    for (const id of [4, 6])
      world.addComponent(
        id,
        COMPONENT.Victory,
        createVictoryComponent([
          { kind: "faction", faction: "good" },
          { kind: "relationship", groupId: "scenario_pair" },
        ]),
      );
    dead(world, [4]);
    const result = victoryDecision(
      world,
      { kind: "individual", playerId: 5, goalId: "scenario_solo" },
      "scenario_multi",
      [
        { kind: "faction", faction: "good" },
        { kind: "relationship", groupId: "scenario_pair" },
      ],
    );
    expect(result).toEqual({
      winner: null,
      reason: "scenario_multi",
      outcome: {
        kind: "victory",
        primary: {
          kind: "individual",
          playerId: 5,
          goalId: "scenario_solo",
          winningPlayerIds: [5],
        },
        additional: [
          { kind: "faction", faction: "good", winningPlayerIds: [3, 4, 6] },
          { kind: "relationship", groupId: "scenario_pair", winningPlayerIds: [4, 6] },
        ],
        winningPlayerIds: [3, 4, 5, 6],
      },
    });
    expect(() =>
      victoryDecision(world, { kind: "relationship", groupId: "missing" }, "scenario_invalid"),
    ).toThrow("victory_target_has_no_members");
    expect(() =>
      victoryDecision(world, { kind: "faction", faction: "good" }, "scenario_invalid", [
        { kind: "faction", faction: "good" },
      ]),
    ).toThrow();
  });

test("strict shared outcome readers reject malformed facts and never invoke foreign accessors", () => {
  const valid: Extract<ReturnType<typeof readGameOutcome>, { kind: "victory" }> = {
    kind: "victory",
    primary: { kind: "faction", faction: "good", winningPlayerIds: [1, 3] },
    additional: [],
    winningPlayerIds: [1, 3],
  };
  expect(readGameOutcome(valid, [1, 2, 3])).toEqual(valid);
  const malformed = [
    { ...valid, winningPlayerIds: [1] },
    { ...valid, winningPlayerIds: [3, 1] },
    { ...valid, additional: [valid.primary] },
    {
      ...valid,
      primary: { kind: "individual", playerId: 2, goalId: "scenario_solo", winningPlayerIds: [1] },
    },
    { kind: "no_winner", winningPlayerIds: [] },
    { ...valid, primary: { ...valid.primary, faction: "other" } },
  ];
  for (const value of malformed) expect(() => readGameOutcome(value)).toThrow();
  expect(() => readGameOutcome(valid, [1, 2])).toThrow();
  let reads = 0;
  const accessor = { ...valid };
  Object.defineProperty(accessor, "primary", {
    get() {
      reads++;
      return valid.primary;
    },
    enumerable: true,
  });
  expect(() => readGameOutcome(accessor)).toThrow();
  expect(reads).toBe(0);
  expect(() => readGameOutcome(Object.create(valid))).toThrow();
  const copy = readGameOutcome(valid);
  if (copy.kind === "victory") copy.primary.winningPlayerIds.length = 0;
  expect(valid.primary.winningPlayerIds).toEqual([1, 3]);
  expect(readVictoryPoint({ day: 2, phase: "voting", checkpoint: "exile_settled" })).toEqual({
    day: 2,
    phase: "voting",
    checkpoint: "exile_settled",
  });
  expect(() =>
    readVictoryPoint({ day: 2, phase: Phase.Day, checkpoint: "exile_settled" }),
  ).toThrow();
});
