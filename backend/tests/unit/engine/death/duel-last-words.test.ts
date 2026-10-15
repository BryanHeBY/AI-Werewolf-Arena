/**
 * 负责连续决斗延期遗言原语的真实引擎单元测试。内存World、原生猎人枪和字面请求驱动真实DR，
 * 人工预期为死亡／钩子先完成、正常链尾才按真实首次死亡顺序逐人授词；失败保留已提交前缀。
 * 不运行模型或全局对局，不把事件、请求或同号新生命当成行动授权。
 */
import { expect, test } from "bun:test";
import { Camp, DeathCause, Phase, Role, type GameEvent } from "@ai-werewolf-arena/game-contract";
import { World } from "../../../../src/domain/world";
import { COMPONENT } from "../../../../src/domain/components/names";
import { createAliveComponent } from "../../../../src/domain/components/alive";
import { createRoleComponent } from "../../../../src/domain/components/role";
import { DeathResolution } from "../../../../src/engine/death-resolution";
import { EventRegistry } from "../../../../src/engine/events/event-registry";
import { ToolGateway } from "../../../../src/engine/actions/tool-gateway";
import { HookRegistry } from "../../../../src/engine/hooks/registry";
import { hunterDeathHook } from "../../../../src/features/hunter/death-hook";
import { setHunterState, getHunterState } from "../../../../src/features/hunter/ports";
import type { ActionProvider } from "../../../../src/domain/actions";
import type { DuelLastWordsScope } from "../../../../src/engine/duel-last-words";

function fixture() {
  const world = new World("en"),
    events: GameEvent[] = [];
  const state = { day: 2, phase: Phase.Day, gameOver: false, result: null };
  const lives = Array.from({ length: 5 }, (_, i) => {
    const id = world.createEntity(),
      life = createAliveComponent();
    const role = createRoleComponent(i === 1 ? Role.Hunter : Role.Villager);
    if (i === 1) setHunterState(role, { canShoot: true });
    world.addComponent(id, COMPONENT.Alive, life);
    world.addComponent(id, COMPONENT.Role, role);
    world.addComponent(id, COMPONENT.Camp, { camp: Camp.Good });
    return life;
  });
  const dr = new DeathResolution(
    world,
    events,
    new ToolGateway(),
    new EventRegistry(new HookRegistry([], [hunterDeathHook])),
    state,
  );
  const words = () =>
    events.filter((e) => e.type === "last_words_granted" || e.type === "last_words_spoken");
  const resolve = (id: number, provider: ActionProvider, scope?: DuelLastWordsScope) =>
    dr.resolve(
      [id],
      { [id]: [DeathCause.Exile] },
      provider,
      Phase.Day,
      Phase.Day,
      { [id]: Phase.Voting },
      scope ? { duelLastWords: scope } : undefined,
    );
  return { world, events, state, lives, dr, words, resolve };
}

test("两次真实提案及首目标原生猎人完整追加链完成后才按2、3、4授词，每次都开真许可", async () => {
  const f = fixture(),
    trace: string[] = [];
  const scope = f.dr.openDuelLastWords(() => true);
  const provider: ActionProvider = {
    async getAction(request) {
      expect(f.world.activeDeathActionCount).toBe(1);
      if (request.allowedTools.includes("shoot")) {
        expect(f.words()).toEqual([]);
        trace.push("shot:2");
        return { name: "shoot", args: { target_id: 3 } };
      }
      expect(f.lives.map((l) => l.alive)).toEqual([true, false, false, false, true]);
      expect(request.context.action_failure_policy).toBe("error");
      expect(request.context.allow_fallback).toBe(false);
      trace.push(`words:${request.actorId}`);
      return { name: "speak", args: { text: `literal ${request.actorId}` } };
    },
  };
  await f.resolve(2, provider, scope);
  expect(f.lives[2]!.alive).toBe(false);
  expect(getHunterState(f.world.getComponent(2, COMPONENT.Role)!)!.canShoot).toBe(false);
  expect(f.world.activeDeathActionCount).toBe(0);
  expect(f.words()).toEqual([]);
  await f.resolve(4, provider, scope);
  await f.dr.flushDuelLastWords(scope, provider);
  expect(trace).toEqual(["shot:2", "words:2", "words:3", "words:4"]);
  expect(f.words().map((e) => [e.type, e.payload.playerId])).toEqual([
    ["last_words_granted", 2],
    ["last_words_spoken", 2],
    ["last_words_granted", 3],
    ["last_words_spoken", 3],
    ["last_words_granted", 4],
    ["last_words_spoken", 4],
  ]);
  expect(f.world.activeDeathActionCount).toBe(0);
  await expect(f.dr.flushDuelLastWords(scope, provider)).rejects.toThrow(
    "duel_last_words_scope_invalid",
  );
});

test("同DR之外的伪造scope及别的DR真实scope都在当前提案首生命写前拒绝", async () => {
  const f = fixture(),
    other = fixture();
  const provider: ActionProvider = {
    async getAction() {
      throw new Error("literal_no_request");
    },
  };
  for (const token of [
    { kind: "duel_last_words_scope" } as DuelLastWordsScope,
    other.dr.openDuelLastWords(() => true),
  ]) {
    await expect(f.resolve(1, provider, token)).rejects.toThrow("duel_last_words_scope_invalid");
    expect(f.lives[0]!.alive).toBe(true);
    expect(f.events).toEqual([]);
  }
});

test("旧metadata getter零执行，原政策仍在角色钩子前立即授词而不走新严格策略", async () => {
  const f = fixture();
  let gets = 0,
    requests = 0;
  await f.dr.resolve(
    [1],
    { 1: [DeathCause.Exile] },
    {
      async getAction(request) {
        requests++;
        expect(request.context.allow_fallback).toBeUndefined();
        return { name: "speak", args: { text: "literal old words" } };
      },
    },
    Phase.Day,
    Phase.Day,
    { 1: Phase.Voting },
    {
      get duelLastWords(): never {
        gets++;
        throw new Error("literal_old_getter");
      },
    },
  );
  expect(gets).toBe(0);
  expect(requests).toBe(1);
  expect(f.words().map((e) => e.type)).toEqual(["last_words_granted", "last_words_spoken"]);
});

test("同一真实原生命重访不重复入队，新身体不能取得已死亡原体的延期词", async () => {
  const f = fixture(),
    scope = f.dr.openDuelLastWords(() => true);
  const provider: ActionProvider = {
    async getAction() {
      return { name: "speak", args: { text: "literal words" } };
    },
  };
  await f.resolve(1, provider, scope);
  await f.resolve(1, provider, scope);
  f.world.addComponent(1, COMPONENT.Alive, createAliveComponent());
  await expect(f.dr.flushDuelLastWords(scope, provider)).rejects.toThrow("duel_last_words_revoked");
  expect(f.words()).toEqual([]);
  expect(f.lives[0]!.alive).toBe(false);
  expect(f.world.getComponent(1, COMPONENT.Alive)!.alive).toBe(true);
  expect(f.world.activeDeathActionCount).toBe(0);
});

test("第二份遗言Provider失败保留全部实际死亡及第一词前缀，不补第三词，开放许可最终清零", async () => {
  const f = fixture(),
    scope = f.dr.openDuelLastWords(() => true),
    failure = new Error("literal_second_word_failed");
  const provider: ActionProvider = {
    async getAction(request) {
      if (request.allowedTools.includes("shoot")) return { name: "shoot", args: { target_id: 3 } };
      if (request.actorId === 3) throw failure;
      return { name: "speak", args: { text: "literal first words" } };
    },
  };
  await f.resolve(2, provider, scope);
  await f.resolve(4, provider, scope);
  expect(await f.dr.flushDuelLastWords(scope, provider).catch((e) => e)).toBe(failure);
  expect(f.lives.map((l) => l.alive)).toEqual([true, false, false, false, true]);
  expect(f.words().map((e) => [e.type, e.payload.playerId])).toEqual([
    ["last_words_granted", 2],
    ["last_words_spoken", 2],
    ["last_words_granted", 3],
  ]);
  expect(f.world.activeDeathActionCount).toBe(0);
});

test("第二次选择失败可直接收权，不发正常链尾遗言；无有效答复也不能作正常完成", async () => {
  const f = fixture(),
    scope = f.dr.openDuelLastWords(() => true);
  const provider: ActionProvider = {
    async getAction() {
      return null;
    },
  };
  await f.resolve(1, provider, scope);
  f.dr.abortDuelLastWords(scope);
  expect(f.words()).toEqual([]);
  expect(f.lives[0]!.alive).toBe(false);
  await expect(f.dr.flushDuelLastWords(scope, provider)).rejects.toThrow(
    "duel_last_words_scope_invalid",
  );
  const next = f.dr.openDuelLastWords(() => true);
  await f.resolve(4, provider, next);
  await expect(f.dr.flushDuelLastWords(next, provider)).rejects.toThrow(
    "duel_last_words_unfinished",
  );
  expect(f.words().map((e) => e.type)).toEqual(["last_words_granted"]);
  expect(f.world.activeDeathActionCount).toBe(0);
});

test("PK的真实Voting阶段授词与发言许可保持Voting，不伪装Day", async () => {
  const f = fixture();
  f.state.phase = Phase.Voting;
  const scope = f.dr.openDuelLastWords(() => true);
  let calls = 0;
  const provider: ActionProvider = {
    async getAction(request) {
      calls++;
      expect(request.phase).toBe(Phase.Voting);
      expect(request.context.death_phase).toBe(Phase.Voting);
      expect(
        f.world.hasDeathAction(1, "speak", Phase.Voting, 2, request.context.death_action_id),
      ).toBe(true);
      expect(
        f.world.hasDeathAction(1, "speak", Phase.Day, 2, request.context.death_action_id),
      ).toBe(false);
      return { name: "speak", args: { text: "literal PK words" } };
    },
  };
  await f.dr.resolve(
    [1],
    { 1: [DeathCause.Exile] },
    provider,
    Phase.Voting,
    Phase.Voting,
    { 1: Phase.Voting },
    { duelLastWords: scope },
  );
  expect(f.words()).toEqual([]);
  await f.dr.flushDuelLastWords(scope, provider);
  expect(calls).toBe(1);
  expect(f.words().map((e) => e.payload.phase)).toEqual([Phase.Voting, Phase.Voting]);
  expect(f.world.activeDeathActionCount).toBe(0);
});
