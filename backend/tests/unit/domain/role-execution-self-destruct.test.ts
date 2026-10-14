/**
 * 单元测试验证身份安装失败的永久执行退休对普通狼、赤月和白狼王自爆的真实边界。
 * 输入为原 Catalog／库存、已关闭的猎魔夜及窗口 Provider 等待点；手写字面知识、资源、事件和同 Error 预期是独立 oracle。
 * 退休不抹角色数据或队友知识；两个新增案例验证直接提交与原捕获／新窗口拒绝，不重跑旧场景或调用模型。
 */
import { expect, test } from "bun:test";
import { bootstrapGame } from "../../../src/app/bootstrap";
import {
  Role,
  Camp,
  Phase,
  ActionWindow,
  WinCondition,
  type GameEvent,
} from "../../../src/core/domain/model";
import { COMPONENT } from "../../../src/core/domain/components/names";
import { retireRoleExecution } from "../../../src/core/domain/role-execution-authority";
import { canRoleSelfDestruct } from "../../../src/game/mechanisms/roles/self_destruct_capability";
import { knownWolfTeammates, wolfTeamPermissions } from "../../../src/game/mechanisms/roles/wolf_team";
import { commitSelfDestructSelection } from "../../../src/game/mechanisms/self_destruct/commit";
import { getRedMoonState } from "../../../src/game/mechanisms/roles/red_moon_apostle/ports";
import {
  beginDemonHunterNight,
  freezeDemonHunt,
  closeDemonHunterNight,
  demonRedMoonCanBlast,
  demonHunterAuditPlayer,
  demonHunterCheckpointPlayers,
} from "../../../src/game/mechanisms/roles/demon_hunter/authority";
import { getWhiteWolfKingState } from "../../../src/game/mechanisms/roles/white_wolf_king/ports";
import { createDefaultRoleRegistry } from "../../../src/game/mechanisms";
import { GameActionRequestFactory } from "../../../src/game/engine/action_request_factory";
import { ToolGateway } from "../../../src/game/gateway/tool_gateway";
import { SelfDestructWindow } from "../../../src/rulesets/self-destruct-window";
import { sixPlayerMvpConfig } from "../../../src/runtime/scenarios/six_player_mvp";
import { redMoonCandidateWorld } from "../../support/features/red-moon/builders/candidate-world";

test("retirement rejects ordinary and Red Moon execution while keeping wolf knowledge and original data", () => {
  const { world, catalog } = redMoonCandidateWorld();
  beginDemonHunterNight(world, 1, () => true);
  freezeDemonHunt(world);
  closeDemonHunterNight(world);
  const wolf = world.getComponent(1, COMPONENT.Role)!,
    teammate = world.getComponent(2, COMPONENT.Role)!,
    moon = world.getComponent(4, COMPONENT.Role)!,
    moonAudit = demonHunterAuditPlayer(world, 4),
    events: GameEvent[] = [];
  expect(canRoleSelfDestruct(wolf, catalog)).toBe(true);
  expect(wolfTeamPermissions(wolf, catalog, world)).toEqual({
    recognizedByPack: true,
    recognizes: "pack",
    canChat: true,
    canVoteForKill: true,
  });
  expect(knownWolfTeammates(world, 1, catalog)).toEqual([2, 3, 4]);
  // 两个身份分别退休；还原普通字段不清除对象终态，目标知识不因此过滤队友。
  retireRoleExecution(teammate);
  retireRoleExecution(wolf);
  wolf.camp = Camp.Good;
  wolf.camp = Camp.Wolf;
  expect(world.getComponent(1, COMPONENT.Role)).toBe(wolf);
  expect(world.getComponent(1, COMPONENT.Camp)!.camp).toBe(Camp.Wolf);
  expect(canRoleSelfDestruct(wolf, catalog)).toBe(false);
  expect(wolfTeamPermissions(wolf, catalog, world)).toEqual({
    recognizedByPack: true,
    recognizes: "pack",
    canChat: false,
    canVoteForKill: false,
  });
  expect(knownWolfTeammates(world, 1, catalog)).toEqual([2, 3, 4]);
  expect(commitSelfDestructSelection(
    world, { kind: "ordinary", actorId: 1, targetId: null },
    ActionWindow.OnPreVote, Phase.Voting, events,
  )).toBeNull();
  // 原赤月权威仍能读当前资格；具体执行入口另拒退休，不能让特殊分支绕过普通能力查询。
  expect(demonRedMoonCanBlast(world, 4)).toBe(true);
  retireRoleExecution(moon);
  expect(commitSelfDestructSelection(
    world, { kind: "ordinary", actorId: 4, targetId: null },
    ActionWindow.OnPreVote, Phase.Voting, events,
  )).toBeNull();
  expect(getRedMoonState(moon)?.blastDay).toBeNull();
  expect(demonHunterAuditPlayer(world, 4)).toEqual(moonAudit);
  expect(events).toEqual([]);
  expect(world.getAliveEntityIds()).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  expect(demonHunterCheckpointPlayers(world, true)).toHaveLength(12);
});

test("White Wolf retirement rejects pending fresh and direct choices while retaining stock read errors", async () => {
  const deck = [Role.WhiteWolfKing, Role.Wolf, Role.Seer, Role.Hunter, Role.Villager, Role.Villager];
  const { world } = bootstrapGame({
    ...sixPlayerMvpConfig,
    enableSheriff: true,
    sheriff: { voteWeight: 2.25 },
    winConditions: [WinCondition.SlaughterSide],
    hooks: { onDaybreak: true, onPreElection: true, onPreVote: true, onPerSpeechGap: true },
    selfDestruct: { enabledWindows: [ActionWindow.OnPreVote] },
    roleSetups: [
      { role: Role.WhiteWolfKing, count: 1 },
      { role: Role.Wolf, count: 1 },
      { role: Role.Seer, count: 1 },
      { role: Role.Hunter, count: 1 },
      { role: Role.Villager, count: 2 },
    ],
  }, { fixedRoles: deck });
  const role = world.getComponent(1, COMPONENT.Role)!,
    stock = getWhiteWolfKingState(role)!,
    events: GameEvent[] = [],
    window = new SelfDestructWindow(world, createDefaultRoleRegistry(), new ToolGateway()),
    requests = new GameActionRequestFactory(world, events, 1);
  let whiteRequests = 0;
  expect(stock.canDetonate).toBe(true);
  const pending = window.execute(requests, {
    async getAction(request) {
      if (request.actorId !== 1) return null;
      whiteRequests++;
      await Promise.resolve();
      retireRoleExecution(role);
      return { name: "self_destruct_with_target", args: { reason: "retired pending", confirm: true, target_id: 3 } };
    },
  }, ActionWindow.OnPreVote, Phase.Voting);
  await expect(pending).resolves.toBeNull();
  expect(whiteRequests).toBe(1);
  await expect(window.execute(requests, {
    async getAction(request) {
      if (request.actorId === 1) whiteRequests++;
      return null;
    },
  }, ActionWindow.OnPreVote, Phase.Voting)).resolves.toBeNull();
  expect(whiteRequests).toBe(1);
  expect(commitSelfDestructSelection(
    world, { kind: "white_wolf_king", actorId: 1, targetId: 3 },
    ActionWindow.OnPreVote, Phase.Voting, events,
  )).toBeNull();
  expect(stock.canDetonate).toBe(true);
  expect(events).toEqual([]);
  expect(world.getAliveEntityIds()).toEqual([1, 2, 3, 4, 5, 6]);
  // 退休拒绝落在原库存读取之后；仍接受旧 getter，并让其同 Error 优先于新拒绝。
  const descriptor = Object.getOwnPropertyDescriptor(role.privateState, "white_wolf_king")!,
    error = new Error("retired_white_stock_read_failed");
  Object.defineProperty(role.privateState, "white_wolf_king", { configurable: true, get() { throw error; } });
  try {
    await expect(window.execute(requests, { async getAction() { return null; } }, ActionWindow.OnPreVote, Phase.Voting)).rejects.toBe(error);
    let thrown: unknown;
    try {
      commitSelfDestructSelection(world, { kind: "white_wolf_king", actorId: 1, targetId: 3 }, ActionWindow.OnPreVote, Phase.Voting, events);
    } catch (cause) { thrown = cause; }
    expect(thrown).toBe(error);
    expect(stock.canDetonate).toBe(true);
    expect(events).toEqual([]);
  } finally {
    Object.defineProperty(role.privateState, "white_wolf_king", descriptor);
  }
});
