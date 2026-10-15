/**
 * 单元测试负责定序王子重收票组合的等待、晚读取及已付款失败前缀。输入为真实本族板子和受控 Promise；
 * 输出为手写字面预期的读取顺序、原异常身份和原历史／事实；不镜像组合算法或以玩家角色标签替代权威。
 * 无配置时不读取运行依赖，已付款后名单或复收票失败不退款；原窗口 Provider 和关闭由真实实现执行。
 */
import { expect, test } from "bun:test";
import { bootstrapGame } from "../../../src/app/bootstrap";
import { GameActionRequestFactory } from "../../../src/engine/actions/action-request-factory";
import { ToolGateway } from "../../../src/engine/actions/tool-gateway";
import { getOrderPrinceState } from "../../../src/features/order-prince/ports";
import { recollectOrderPrinceVotes, type OrderPrinceRevoteRuntime } from "../../../src/rulesets/order-prince-revote";
import { COMPONENT } from "../../../src/domain/components/names";
import { Role, WinCondition, type BoardConfig, type GameEvent, type ToolCall } from "@ai-werewolf-arena/game-contract";
import type { VotingPipelineOptions } from "../../../src/engine/phases/voting-pipeline";
import type { World } from "../../../src/domain/world";
import type { ActionProvider, ActionRequestConstructionPort } from "../../../src/domain/actions";

function fixture() {
  const roles = [Role.Wolf, Role.Wolf, Role.Wolf, Role.Wolf, Role.Villager, Role.Villager,
    Role.Villager, Role.Villager, Role.Seer, Role.Witch, Role.Hunter, Role.OrderPrince];
  const config: BoardConfig = {
    boardSize: 12,
    winConditions: [WinCondition.SlaughterSide],
    enableSheriff: false,
    hooks: { onDaybreak: false, onPreElection: false, onPreVote: false, onPerSpeechGap: false },
    roleSetups: [...new Set(roles)].map(role => ({ role, count: roles.filter(r => r === role).length })),
    voting: { exilePolicy: "awa_one_pk_v1" },
  };
  const game = bootstrapGame(config, { fixedRoles: roles });
  const events: GameEvent[] = [];
  const requests = new GameActionRequestFactory(game.world, events, 1);
  const actionProvider: ActionProvider = {
    async getAction(request): Promise<ToolCall> {
      if (request.context.stage === "order_prince_choice")
        return { name: "reset_exile_vote", args: { activate: true } };
      if (request.context.stage === "order_prince_speech")
        return { name: "speak", args: { text: "重收票。" } };
      throw new Error("unexpected_test_action");
    },
  };
  return { ...game, config, events, requests, actionProvider, toolGateway: new ToolGateway() };
}

test("order prince revote: unconfigured branch completes synchronously without live queries", () => {
  const trace: string[] = [];
  const failure = new Error("unexpected_live_query");
  const runtime: OrderPrinceRevoteRuntime<number[]> = {
    get config() { trace.push("config"); return { roleSetups: [] }; },
    get world(): World { throw failure; },
    get requests(): ActionRequestConstructionPort { throw failure; },
    get actionProvider(): ActionProvider { throw failure; },
    get toolGateway(): ToolGateway { throw failure; },
    get events(): GameEvent[] { throw failure; },
    get options(): VotingPipelineOptions { throw failure; },
    set options(_next) { throw failure; },
    collectVotes() { throw failure; },
    recordVotes() { throw failure; },
  };
  expect(recollectOrderPrinceVotes(runtime).next()).toEqual({ done: true, value: undefined });
  expect(trace).toEqual(["config"]);
});

test("order prince revote: roster failure retains paid choice and strict replacement order", async () => {
  const f = fixture();
  const trace: string[] = [];
  const failure = new Error("roster_read_failed");
  let failWorld = false;
  let options: VotingPipelineOptions = {
    get day() { trace.push("day"); return 1; },
    get isCurrent() { trace.push("previousCurrent"); return () => true; },
  };
  const runtime: OrderPrinceRevoteRuntime<number[]> = {
    ...f,
    get world() { trace.push("world"); if (failWorld) throw failure; return f.world; },
    get options() { return options; },
    set options(next) { trace.push("replace"); options = next; },
    collectVotes() { trace.push("collect"); return Promise.resolve([]); },
    recordVotes() { trace.push("record"); return { tally: {}, publicVotes: [] }; },
  };
  const sequence = recollectOrderPrinceVotes(runtime);
  const choice = sequence.next();
  expect(choice.done).toBe(false);
  if (choice.done) throw new Error("test_choice_missing");
  const restarted = await choice.value;
  expect(restarted).toBe(true);
  trace.length = 0;
  failWorld = true;
  expect(() => sequence.next(restarted)).toThrow(failure);
  expect(trace).toEqual(["previousCurrent", "day", "previousCurrent", "replace", "world"]);
  expect(options.strictRequired).toBe(true);
  expect(options.orderPrinceRevote).toBe(true);
  expect(getOrderPrinceState(f.world.getComponent(12, COMPONENT.Role), () => f.world.getComponent(12, COMPONENT.Camp))?.history)
    .toEqual([{ day: 1, activate: true }]);
  expect(f.events.map(event => event.type)).toEqual([
    "order_prince_choice_committed", "order_prince_revote_started", "day_speech",
  ]);
});

test("order prince revote: collection rejection preserves paid prefix without opening ballots", async () => {
  const f = fixture();
  const failure = new Error("collection_failed");
  const trace: string[] = [];
  let options: VotingPipelineOptions = { day: 1, isCurrent: () => true };
  const runtime: OrderPrinceRevoteRuntime<number[]> = {
    ...f,
    get options() { return options; },
    set options(next) { options = next; },
    collectVotes(voters) {
      trace.push("collect");
      expect(voters).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
      expect(options.strictRequired).toBe(true);
      return Promise.reject(failure);
    },
    recordVotes() { trace.push("record"); return { tally: {}, publicVotes: [] }; },
  };
  const sequence = recollectOrderPrinceVotes(runtime);
  const choice = sequence.next();
  if (choice.done) throw new Error("test_choice_missing");
  const collected = sequence.next(await choice.value);
  expect(collected.done).toBe(false);
  if (collected.done) throw new Error("test_collection_missing");
  await expect(collected.value).rejects.toBe(failure);
  expect(trace).toEqual(["collect"]);
  expect(getOrderPrinceState(f.world.getComponent(12, COMPONENT.Role), () => f.world.getComponent(12, COMPONENT.Camp))?.history)
    .toEqual([{ day: 1, activate: true }]);
  expect(f.events.map(event => event.type)).toEqual([
    "order_prince_choice_committed", "order_prince_revote_started", "day_speech",
  ]);
});
