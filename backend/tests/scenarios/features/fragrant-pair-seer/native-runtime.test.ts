/**
 * 寻香原生运行场景测试：验证实际绑定、来源死亡、继承狼刀、次序及终局。输入为原受控角色与真实周期；既有字面预期和不可变 fixture 保留因果链，不生成新动作或 oracle。
 */
import { expect, test } from "bun:test";
import { createRandom, type RandomSource } from "../../../../src/domain/random";
import { Camp, Phase } from "../../../../src/domain/identity";
import { COMPONENT } from "../../../../src/domain/components/names";
import type { AliveComponent } from "../../../../src/domain/components/alive";
import type { ActionRequest } from "../../../../src/domain/actions";
import { fragrantAuthoritySnapshot } from "../../../../src/features/fragrant-pair-seer/authority";
import { fragrantRuntimeGame as game } from "../../../support/features/fragrant-pair-seer/builders/runtime-game";
import { fragrantRuntimeAction as act } from "../../../support/features/fragrant-pair-seer/drivers/actions";
import { type FragrantRuntimePlan as Plan } from "../../../support/features/fragrant-pair-seer/contracts";

async function cycle(g: ReturnType<typeof game>, plan: Plan, seen: ActionRequest[] = []) {
  return await g.phaseManager.runSingleCycle(
    {
      async getAction(r) {
        seen.push(r);
        return act(r, plan);
      },
    },
    8,
  );
}

function dead(g: ReturnType<typeof game>) {
  return g.world
    .entityIds()
    .filter((id) => !g.world.getComponent(id, COMPONENT.Alive)!.alive);
}

test("literal seed golden uses one reserved draw across three actual nights regardless of unrelated streams", async () => {
  let reservedDraws = 0;
  const wrap = (source: RandomSource): RandomSource => ({
    metadata: source.metadata,
    next() {
      if (JSON.stringify(source.metadata.path) === '["night","fragrant-known-wolf"]')
        reservedDraws++;
      return source.next();
    },
    fork(name) {
      return wrap(source.fork(name));
    },
  });
  const random = wrap(createRandom("fragrant-handwritten-runtime"));
  for (let i = 0; i < 17; i++) random.fork("unrelated-draws").next();
  const g = game("en", random);
  for (let day = 1; day <= 3; day++) await cycle(g, {});
  // 独立 FNV/Mulberry 计算：uint32 输出 4063160788，排序狼名单为 [2,3,4]。
  expect(fragrantAuthoritySnapshot(g.world).fragrant.knownWolfId).toBe(4);
  expect(fragrantAuthoritySnapshot(g.world).known.knifeNotices).toEqual([
    { day: 1, eligible: false },
    { day: 2, eligible: false },
    { day: 3, eligible: false },
  ]);
  expect(reservedDraws).toBe(1);
});

test("N1 real knife adds linked death, both actual last words precede badge and any gun", async () => {
  const g = game(),
    seen: ActionRequest[] = [];
  await cycle(g, { bind: [5, 6], knife: 5, sheriff: 6, badge: 7 }, seen);
  expect(dead(g)).toEqual([5, 6]);
  expect(seen.filter((r) => r.context.stage === "last_words").map((r) => r.actorId)).toEqual([
    5, 6,
  ]);
  const words = seen.findLastIndex((r) => r.context.stage === "last_words"),
    badge = seen.findIndex((r) => r.context.stage === "sheriff_badge_choice");
  expect(badge).toBeGreaterThan(words);
  expect(fragrantAuthoritySnapshot(g.world).fragrant.trigger).toEqual({
    bindingId: "fragrant:night:1",
    day: 1,
    rootId: 5,
    addedTargetId: 6,
  });
  expect(fragrantAuthoritySnapshot(g.world).known.used).toBe(true);
  expect(
    g.phaseManager
      .getEvents()
      .filter((e) => e.type === "additional_deaths")
      .map((e) => e.payload.deaths),
  ).toEqual([[6]]);
});

test("N2 real link has no night words, while N1 pass never extends a relation", async () => {
  const g = game(),
    seen: ActionRequest[] = [];
  await cycle(g, { bind: [7, 8] });
  await cycle(g, { bind: [5, 6], knife: 5 }, seen);
  expect(dead(g)).toEqual([5, 6]);
  expect(seen.filter((r) => r.context.stage === "last_words")).toEqual([]);
  const owned = fragrantAuthoritySnapshot(g.world);
  expect(owned.fragrant.bindings.map((b) => b.status)).toEqual([
    { kind: "expired", day: 2 },
    { kind: "triggered", day: 2 },
  ]);
  expect(owned.pairSeer.history).toEqual([
    { day: 1, targetIds: [2, 9], containsWerewolf: true },
    { day: 2, targetIds: [2, 9], containsWerewolf: true },
  ]);
});

test("D1 exile gives only root words; link-only Hunter receives no gun", async () => {
  const g = game(),
    seen: ActionRequest[] = [];
  await cycle(g, { bind: [2, 11], exile: 2 }, seen);
  expect(dead(g)).toEqual([2, 11]);
  expect(seen.filter((r) => r.context.stage === "last_words").map((r) => r.actorId)).toEqual([2]);
  expect(seen.some((r) => r.allowedTools.includes("shoot"))).toBe(false);
  expect(
    g.phaseManager
      .getEvents()
      .filter((e) => e.type === "fragrant_link_triggered")
      .map((e) => e.payload.rootPhase),
  ).toEqual([Phase.Voting]);
});

test("both independent knife/poison deaths consume once without removing Hunter's original gun", async () => {
  const g = game(),
    seen: ActionRequest[] = [];
  await cycle(g, { bind: [5, 11], knife: 11, poison: 5, shoot: null }, seen);
  expect(dead(g)).toEqual([5, 11]);
  expect(seen.filter((r) => r.allowedTools.includes("shoot")).map((r) => r.actorId)).toEqual([11]);
  expect(fragrantAuthoritySnapshot(g.world).fragrant.trigger?.addedTargetId).toBeNull();
  expect(g.phaseManager.getEvents().filter((e) => e.type === "additional_deaths")).toEqual([]);
  expect(fragrantAuthoritySnapshot(g.world).known.used).toBe(true);
});

test("dead original Phantom's paid pair still links a later actual Hunter gun; no extra words", async () => {
  const g = game(),
    seen: ActionRequest[] = [];
  await cycle(g, { bind: [5, 6], knife: 11, poison: 1, shoot: 5, sheriff: 6, badge: 7 }, seen);
  expect(dead(g)).toEqual([1, 5, 6, 11]);
  expect(seen.filter((r) => r.context.stage === "last_words").map((r) => r.actorId)).toEqual([
    1, 11,
  ]);
  expect(seen.filter((r) => r.allowedTools.includes("shoot")).map((r) => r.actorId)).toEqual([11]);
  expect(seen.findIndex((r) => r.context.stage === "sheriff_badge_choice")).toBeGreaterThan(
    seen.findIndex((r) => r.allowedTools.includes("shoot")),
  );
  expect(
    g.phaseManager
      .getEvents()
      .filter((e) => e.type === "fragrant_link_triggered")
      .map((e) => e.payload),
  ).toEqual([
    {
      policy: "awa_fragrant_pair_seer_v1",
      actorId: 1,
      day: 1,
      bindingId: "fragrant:night:1",
      pairIds: [5, 6],
      rootId: 5,
      addedTargetId: 6,
      rootPhase: Phase.Day,
      initialWave: false,
    },
  ]);
  expect(g.phaseManager.getEvents().filter((e) => e.type === "game_over")).toHaveLength(0);
});

test("three real nights inherit one knife, then last wolf and last god die in one gun chain before unique Good victory", async () => {
  const g = game(),
    seen: ActionRequest[] = [];
  const result = await g.phaseManager.runUntilGameOver(
    {
      async getAction(r) {
        seen.push(r);
        return act(
          r,
          r.context.day === 1
            ? { knife: 9, poison: 2, exile: 3 }
            : r.context.day === 2
              ? { knife: 10, exile: 4 }
              : { bind: [1, 12], knife: 11, shoot: 1 },
        );
      },
    },
    8,
  );
  expect(result.result?.winner).toBe(Camp.Good);
  expect(result.result?.reason).toBe("all_wolves_eliminated");
  expect(result.result?.outcome).toEqual({
    kind: "victory",
    primary: { kind: "faction", faction: "good", winningPlayerIds: [5, 6, 7, 8, 9, 10, 11, 12] },
    additional: [],
    winningPlayerIds: [5, 6, 7, 8, 9, 10, 11, 12],
  });
  expect(g.phaseManager.getEvents().filter((e) => e.type === "game_over")).toHaveLength(1);
  expect(dead(g)).toEqual([1, 2, 3, 4, 9, 10, 11, 12]);
  expect(
    seen
      .filter((r) => r.context.day === 3 && r.allowedTools.includes("kill_vote"))
      .map((r) => r.actorId),
  ).toEqual([1]);
  expect(seen.some((r) => r.actorId === 1 && r.allowedTools.includes("speak_to_wolves"))).toBe(
    false,
  );
  expect(seen.filter((r) => r.context.day === 3 && r.context.stage === "last_words")).toEqual([]);
});

test("N1 knife and pre-election blast overlap keeps explicit Day origin for the link and grants neither words", async () => {
  const g = game(),
    seen: ActionRequest[] = [];
  await g.phaseManager.runSingleCycle(
    {
      async getAction(r) {
        seen.push(r);
        if (
          r.actorId === 2 &&
          r.context.stage === "on_pre_election" &&
          r.allowedTools.includes("self_destruct")
        )
          return { name: "self_destruct", args: { reason: "literal overlap", confirm: true } };
        return act(r, { bind: [2, 5], knife: 2 });
      },
    },
    8,
  );
  expect(dead(g)).toEqual([2, 5]);
  expect(seen.filter((r) => r.context.stage === "last_words")).toEqual([]);
  expect(
    g.phaseManager
      .getEvents()
      .filter((e) => e.type === "fragrant_link_triggered")
      .map((e) => e.payload.rootPhase),
  ).toEqual([Phase.Day]);
  expect(fragrantAuthoritySnapshot(g.world).known.used).toBe(true);
});
