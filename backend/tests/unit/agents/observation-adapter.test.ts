/**
 * 单元测试验证应用观察适配器的构造与缺失策略边界。输入为固定六席 World 和手写空策略表；
 * 输出以独立计数与错误字面断言核对构造无状态读取、缺失策略先于观察捕获。
 * 不调用模型、运行整局或用生产投影生成预期；资源和玩法验证由既有观察测试负责。
 */
import { expect, test } from "bun:test";
import { bootstrapGame } from "../../../src/app/bootstrap";
import { ObservedPlayersActionProvider } from "../../../src/app/observed-players-action-provider";
import { GameActionRequestFactory } from "../../../src/game/engine/action_request_factory";
import { createRandom } from "../../../src/core/domain/random";
import { Phase, Role } from "@ai-werewolf-arena/game-contract";
import { sixPlayerMvpConfig } from "../../../src/runtime/scenarios/six_player_mvp";

const fixedRoles = [Role.Villager, Role.Wolf, Role.Guard, Role.Wolf, Role.Seer, Role.Villager];

test("observation adapter construction does not inspect World or initialize prompt counts", () => {
  const { world } = bootstrapGame(sixPlayerMvpConfig, {
    fixedRoles,
    random: createRandom("observation-adapter-constructor"),
  });
  let reads = 0;
  // 初始化已完成后才安装拒绝读取的探针；断言独立于实际观察输出。
  Object.defineProperty(world, "entityIds", { value: () => { reads++; throw Error("unexpected_world_read"); } });
  Object.defineProperty(world, "getComponent", { value: () => { reads++; throw Error("unexpected_world_read"); } });
  expect(() => new ObservedPlayersActionProvider(world, new Map())).not.toThrow();
  expect(reads).toBe(0);
});

test("missing observed strategy rejects before any World query", async () => {
  const { world, phaseManager } = bootstrapGame(sixPlayerMvpConfig, {
    fixedRoles,
    random: createRandom("observation-adapter-missing"),
  });
  const request = new GameActionRequestFactory(world, phaseManager.getEvents(), 1).create({
    actorId: 1,
    phase: Phase.Voting,
    allowedTools: ["vote"],
    stage: "voting",
    requiresAction: true,
    summary: "Vote",
  });
  const provider = new ObservedPlayersActionProvider(world, new Map());
  let reads = 0;
  Object.defineProperty(world, "getComponent", { value: () => { reads++; throw Error("unexpected_world_read"); } });
  await expect(provider.getAction(request)).rejects.toThrow("observed_player_strategy_missing");
  expect(reads).toBe(0);
});
