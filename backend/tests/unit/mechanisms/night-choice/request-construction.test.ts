/**
 * 单元测试负责炼金魔女蛇选择／河豚反噬的原独立构造点与 scope 失败边界。
 * 输入为原公开板子或既有 raw roster fixture、真实 frame／authority 和明确构造器／Provider 失败；
 * 原字面轨迹、参数引用、窗口／scope、库存／历史与异常是预期，不以测试依赖授予资格。
 * 只装配本职输入／窗口，不运行完整对局、模型或传输；蛇无 finally 与河豚已进 try 的关闭分别断言。
 */
import { expect, test } from "bun:test";
import type { ActionRequest } from "@ai-werewolf-arena/game-contract/requests";
import type { GameEvent } from "@ai-werewolf-arena/game-contract/events";
import type { World } from "../../../../src/core/domain/world";
import type { ActionRequestConstructionInput } from "../../../../src/core/domain/actions";
import { COMPONENT } from "../../../../src/core/domain/components/names";
import { GameActionRequestFactory } from "../../../../src/game/engine/action_request_factory";
import { ToolGateway } from "../../../../src/game/gateway/tool_gateway";
import { bootstrapGame } from "../../../../src/app/bootstrap";
import { mistBoard, MIST_ROLES } from "../../../support/features/mist-raven/builders/board";
import { DreamNightFrame } from "../../../../src/game/mechanisms/roles/dreamer/night_frame";
import { MistPendingNight } from "../../../../src/game/mechanisms/roles/mist_raven/pending_night";
import { beginMistNight, commitMistChoice, handOffMistNight, snakeWindowTargets, openSnakeWindow, abortMistNight } from "../../../../src/game/mechanisms/roles/mist_raven/night_frame";
import { readAlchemistState } from "../../../../src/game/mechanisms/roles/mist_raven/state";
import { decideSnake } from "../../../../src/game/mechanisms/roles/mist_raven/choice-ports";
import { runAnimalPufferChoice } from "../../../../src/game/mechanisms/roles/animal_dream/choice-ports";
import { animalRosterFixture } from "../../../support/features/animal-dream/builders/roster";
import { installAnimalAuthority, beginAnimalNight, closeAnimalNight, beginAnimalExileUnit, animalAuthoritySnapshot } from "../../../../src/game/mechanisms/roles/animal_dream/authority";
import { recordAnimalBallotRound, sealAnimalBallots } from "../../../../src/game/mechanisms/roles/animal_dream/accepted-ballots";
import { animalRequestScope } from "../../../../src/game/mechanisms/roles/animal_dream/requests";
import { DeathCause } from "@ai-werewolf-arena/game-contract";

async function snakeFixture(claimed = true) {
  const game = bootstrapGame((await mistBoard()).config, { fixedRoles: [...MIST_ROLES] });
  beginMistNight(game.world, 1);
  commitMistChoice(game.world, 1, null);
  handOffMistNight(game.world, 1, 5);
  const pending = new MistPendingNight(game.world, 1, 5, {
    deaths: [5], deathSources: { 5: [DeathCause.WolfKill] },
  }, new DreamNightFrame([]));
  if (claimed) pending.claim(() => true);
  return { ...game, pending, events: [] as GameEvent[], toolGateway: new ToolGateway() };
}
function pufferFixture(vote = true) {
  const f = animalRosterFixture(undefined, installAnimalAuthority);
  beginAnimalNight(f.world, 1, () => true);
  closeAnimalNight(f.world, 1, "normal");
  const unit = beginAnimalExileUnit(f.world, 1, "exile", () => true);
  recordAnimalBallotRound(f.world, unit, 1, f.world.getAliveEntityIds().map(actorId => ({
    actorId, targetId: vote && actorId === 2 ? 12 : null,
    abstain: !(vote && actorId === 2), weight: vote && actorId === 2 ? 1 : 0,
  })));
  sealAnimalBallots(f.world, unit);
  return { ...f, unit, events: [] as GameEvent[] };
}

test("蛇尚未claim与河豚无候选均在原拒绝／返回点停止，不读构造器", async () => {
  let reads = 0;
  const construction = { get requestFactory(): never { reads++; throw new Error("unneeded_ctor"); } };
  const provider = { async getAction(): Promise<never> { throw new Error("unneeded_provider"); } };
  const snake = await snakeFixture(false);
  try {
    await expect(decideSnake(snake.world, snake.events, snake.toolGateway, provider, snake.pending, () => true, construction)).rejects.toThrow("snake_window_stale");
    const puffer = pufferFixture(false);
    expect(await runAnimalPufferChoice(puffer.world, puffer.events, provider, new ToolGateway(), 1, puffer.unit, construction)).toEqual([]);
    expect(reads).toBe(0);
  } finally { snake.pending.abort(); abortMistNight(snake.world); }
});

test("蛇构造失败保原已开窗口，尚未付款或发表事实；关闭仍归外层", async () => {
  const f = await snakeFixture(), trace: string[] = [], failure = new Error("snake_ctor_failed");
  class FailingRequests {
    constructor(world: World, events: readonly GameEvent[], day: number) {
      trace.push("new");
      expect(world).toBe(f.world); expect(events).toBe(f.events); expect(day).toBe(1);
      expect(snakeWindowTargets(world, day, 1)).toEqual([5]);
      throw failure;
    }
    create(): never { throw new Error("unreachable_create"); }
  }
  try {
    await expect(decideSnake(f.world, f.events, f.toolGateway, { async getAction(): Promise<never> { throw new Error("unreachable_provider"); } }, f.pending, () => true, { get requestFactory() { trace.push("factory"); return FailingRequests; } })).rejects.toBe(failure);
    expect(trace).toEqual(["factory", "new"]);
    expect(snakeWindowTargets(f.world, 1, 1)).toEqual([5]);
    expect(() => openSnakeWindow(f.world, 1, [5], () => true)).toThrow("snake_window_unavailable");
    expect(f.pending.status).toBe("committing");
    expect(readAlchemistState((f.world.getComponent(1, COMPONENT.Role)!.privateState as { alchemist?: unknown }).alchemist)!.healRemaining).toBe(1);
    expect(f.events).toEqual([]);
  } finally { f.pending.abort(); abortMistNight(f.world); }
});

test("河豚构造失败先于scope；真实create后Provider拒绝才由原finally关闭", async () => {
  const early = pufferFixture(), failure = new Error("puffer_ctor_failed"), earlyTrace: string[] = [];
  class FailingRequests {
    constructor(world: World, events: readonly GameEvent[], day: number) {
      earlyTrace.push("new");
      expect(world).toBe(early.world); expect(events).toBe(early.events); expect(day).toBe(1);
      expect(animalAuthoritySnapshot(world)!.unit!.puffer!.closed).toBe(false);
      throw failure;
    }
    create(): never { throw new Error("unreachable_create"); }
  }
  await expect(runAnimalPufferChoice(early.world, early.events, { async getAction(): Promise<never> { throw new Error("unreachable_provider"); } }, new ToolGateway(), 1, early.unit, { get requestFactory() { earlyTrace.push("factory"); return FailingRequests; } })).rejects.toBe(failure);
  expect(earlyTrace).toEqual(["factory", "new"]);
  expect(animalAuthoritySnapshot(early.world)!.unit!.puffer!.closed).toBe(false);
  expect(early.events).toEqual([]);

  const late = pufferFixture(), trace: string[] = [], providerFailure = new Error("puffer_provider_failed");
  let saved: ActionRequest | undefined;
  class TrackingRequests extends GameActionRequestFactory {
    constructor(world: World, events: readonly GameEvent[], day: number) {
      trace.push("new"); super(world, events, day);
      expect(world).toBe(late.world); expect(events).toBe(late.events); expect(day).toBe(1);
    }
    override create(input: ActionRequestConstructionInput) {
      saved = super.create(input); trace.push("create");
      expect(animalRequestScope(late.world, saved)).toBeUndefined();
      return saved;
    }
  }
  await expect(runAnimalPufferChoice(late.world, late.events, { async getAction(request) {
    trace.push("provider"); expect(request).toBe(saved!);
    expect(animalRequestScope(late.world, request)).toBeDefined();
    throw providerFailure;
  } }, new ToolGateway(), 1, late.unit, { get requestFactory() { trace.push("factory"); return TrackingRequests; } })).rejects.toBe(providerFailure);
  expect(trace).toEqual(["factory", "new", "create", "provider"]);
  expect(animalRequestScope(late.world, saved!)).toBeUndefined();
  expect(animalAuthoritySnapshot(late.world)!.unit!.puffer!.closed).toBe(true);
  expect(animalAuthoritySnapshot(late.world)!.puffer).toMatchObject({ usedDay: null, history: [] });
  expect(late.events).toEqual([]);
});
