/**
 * 单元测试验证终局候选规则的配置引用、晚读取、婚约首拒绝和咒狐成员改写。
 * 输入为真实 World／公开板子及字面候选和 getter 轨迹；预期为手写规则、成员及第一错误。
 * 不运行完整对局，不由生产判胜输出生成 oracle；候选查询不代表已经封盘或获得行动许可。
 */
import { expect, test } from "bun:test";
import { Camp, Phase, Role, WinCondition, type BoardConfig, type WinDecision } from "@ai-werewolf-arena/game-contract";
import { World } from "../../../src/domain/world";
import { COMPONENT } from "../../../src/domain/components/names";
import { createAliveComponent } from "../../../src/domain/components/alive";
import { createVictoryComponent } from "../../../src/domain/components/victory";
import { createRoleComponent } from "../../../src/game/observation/role-presentation";
import { bootstrapGame } from "../../../src/app/bootstrap";
import { ghostBrideBoard, ghostBrideDeck } from "../../support/features/ghost-bride/builders/scenario";
import { foxBoard } from "../../support/features/cursed-fox/builders/scenario";
import { replaceWithFoxVictory } from "../../../src/game/mechanisms/roles/cursed_fox/victory";
import { TERMINAL_VICTORY_POLICY } from "../../../src/rulesets/terminal-victory-policy";

const faction: WinDecision & { outcome: Extract<WinDecision["outcome"], { kind: "victory" }> } = {
  winner: Camp.Wolf,
  reason: "literal_faction_complete",
  outcome: { kind: "victory", primary: { kind: "faction", faction: Camp.Wolf, winningPlayerIds: [2] }, additional: [], winningPlayerIds: [2] },
};

test("条件保多规则原引用、旧单字段与默认，并在原短路位置晚读取配置", () => {
  const world = new World(), config = foxBoard([Role.CursedFox, Role.Wolf, Role.Villager]),
    conditions = [WinCondition.SlaughterSide, WinCondition.SlaughterCity], trace: string[] = [];
  Object.defineProperty(config, "winConditions", { configurable: true, get() { trace.push("conditions"); return conditions; } });
  const runtime = { world() { trace.push("world"); return world; }, config() { trace.push("config"); return config; } };
  expect(TERMINAL_VICTORY_POLICY.conditions(runtime)).toBe(conditions);
  expect(trace).toEqual(["world", "config", "conditions", "config", "conditions", "config", "conditions"]);
  Object.defineProperty(config, "winConditions", { configurable: true, value: [] });
  config.winCondition = WinCondition.SlaughterSide;
  expect(TERMINAL_VICTORY_POLICY.conditions(runtime)).toEqual([WinCondition.SlaughterSide]);
  delete config.winCondition;
  expect(TERMINAL_VICTORY_POLICY.conditions(runtime)).toEqual([WinCondition.SlaughterCity]);
  const failure = new Error("literal_conditions_first_failure");
  Object.defineProperty(config, "winConditions", { configurable: true, get() { throw failure; } });
  expect(() => TERMINAL_VICTORY_POLICY.conditions(runtime)).toThrow(failure);
});

test("真实婚约要求唯一三阵营规则，未完成分配先于候选结构和日期拒绝", () => {
  const board = ghostBrideBoard(), game = bootstrapGame(board, { fixedRoles: ghostBrideDeck }), trace: string[] = [];
  const configured = TERMINAL_VICTORY_POLICY.conditions({ world: () => game.world, config: () => board });
  expect(configured).toEqual([WinCondition.ThreeFactionsElimination]);
  expect(configured).not.toBe(board.winConditions);
  const invalid: BoardConfig = { ...board, winConditions: [WinCondition.SlaughterCity] };
  expect(() => TERMINAL_VICTORY_POLICY.conditions({ world: () => game.world, config: () => invalid })).toThrow("ghost_bride_win_condition_invalid");
  const malformed = { ...faction, reason: "" };
  expect(() => TERMINAL_VICTORY_POLICY.validateCandidate(malformed, "night_settled", Phase.Night,
    () => { trace.push("world"); return game.world; },
    () => { trace.push("day"); throw new Error("literal_day_must_not_read"); },
  )).toThrow("ghost_bride_victory_unavailable");
  expect(trace).toEqual(["world", "world"]);
  expect(game.phaseManager.getSnapshot().gameOver).toBe(false);
  expect(game.phaseManager.getEvents().some(event => event.type === "game_over")).toBe(false);
});

test("狐狸保原函数绑定和不适用引用，个人成员核完才读日期，伪成员失败不封盘", () => {
  const world = new World(), trace: string[] = [];
  const fox = world.createEntity(), wolf = world.createEntity();
  world.addComponent(fox, COMPONENT.Alive, createAliveComponent());
  world.addComponent(fox, COMPONENT.Role, createRoleComponent(Role.CursedFox));
  world.addComponent(fox, COMPONENT.Camp, { camp: Camp.ThirdParty });
  world.addComponent(fox, COMPONENT.Victory, createVictoryComponent([{ kind: "individual", goalId: "netease_cursed_fox_last_faction_v1" }]));
  world.addComponent(wolf, COMPONENT.Alive, createAliveComponent());
  world.addComponent(wolf, COMPONENT.Role, createRoleComponent(Role.Wolf));
  world.addComponent(wolf, COMPONENT.Camp, { camp: Camp.Wolf });
  world.addComponent(wolf, COMPONENT.Victory, createVictoryComponent([{ kind: "faction", faction: Camp.Wolf }]));
  expect(TERMINAL_VICTORY_POLICY.replaceFactionResult).toBe(replaceWithFoxVictory);
  const third: WinDecision = { ...faction, winner: Camp.ThirdParty, outcome: { ...faction.outcome, kind: "victory", primary: { kind: "faction", faction: Camp.ThirdParty, winningPlayerIds: [] } } };
  expect(TERMINAL_VICTORY_POLICY.replaceFactionResult(world, third)).toBe(third);
  const result = TERMINAL_VICTORY_POLICY.replaceFactionResult(world, faction);
  expect(result).toEqual({ winner: null, reason: "cursed_fox_survived_faction_elimination", outcome: { kind: "victory", primary: { kind: "individual", goalId: "netease_cursed_fox_last_faction_v1", playerId: 1, winningPlayerIds: [1] }, additional: [], winningPlayerIds: [1] } });
  const runtime = { world() { trace.push("world"); return world; }, day() { trace.push("day"); return 3; } };
  const validated = TERMINAL_VICTORY_POLICY.validateCandidate(result, "night_settled", Phase.Night, runtime.world, runtime.day);
  expect(trace).toEqual(["world", "world", "world", "day"]);
  expect(validated.decidedAt).toEqual({ day: 3, phase: Phase.Night, checkpoint: "night_settled" });
  trace.length = 0;
  expect(() => TERMINAL_VICTORY_POLICY.validateCandidate(faction, "night_settled", Phase.Night, runtime.world, runtime.day)).not.toThrow();
  const forged: WinDecision = { ...faction, outcome: { kind: "victory", primary: { kind: "faction", faction: Camp.Wolf, winningPlayerIds: [1] }, additional: [], winningPlayerIds: [1] } };
  trace.length = 0;
  expect(() => TERMINAL_VICTORY_POLICY.validateCandidate(forged, "night_settled", Phase.Night, runtime.world, runtime.day)).toThrow("game_result_membership_invalid");
  expect(trace).toEqual(["world", "world", "world"]);
  expect(world.getAliveEntityIds()).toEqual([1, 2]);
});
