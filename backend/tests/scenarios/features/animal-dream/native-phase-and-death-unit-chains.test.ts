/**
 * 场景测试验证真实动物梦境阶段／死亡单元、白猫到期及狐狸／河豚／狼美人交互。输入为固定
 * 原名单、字面选择和外来原生命替换；手写死亡／警徽／库存顺序及拒绝是预期，不调用模型或生成替代 fixture。
 */
import { createAliveComponent } from "../../../../src/agents/observation/component-presentation";
import { expect, test } from "bun:test";
import { bootstrapGame } from "../../../../src/app/bootstrap";
import { animalInternalConfig } from "../../../support/features/animal-dream/builders/roster";
import {
  Role,
  Camp,
  Phase,
  ActionWindow,
  COMPONENT,
  type BoardConfig,
  type ActionRequest,
  type ToolCall,
  type ActionProvider,
  type AliveComponent,
} from "../../../../src/domain";

import { ToolGateway } from "../../../../src/engine/actions/tool-gateway";
import { aliveLifeVersion } from "../../../../src/domain/components/alive";
import { animalAuthoritySnapshot } from "../../../../src/features/animal-dream/authority";
import { getWolfBeautyState } from "../../../../src/features/wolf-beauty/ports";
import { activeCharm } from "../../../../src/features/wolf-beauty/relation";

const fixed = [
  Role.WolfBeauty,
  Role.Wolf,
  Role.Wolf,
  Role.Wolf,
  Role.Villager,
  Role.Villager,
  Role.Villager,
  Role.Villager,
  Role.WhiteCat,
  Role.FoxCub,
  Role.Bear,
  Role.Pufferfish,
];

const game = (skip = false) =>
  bootstrapGame(
    {
      ...animalInternalConfig(),
      whiteCat: {
        skippedVotePolicy: skip ? "awa_expire_on_skipped_day_v1" : "awa_wait_for_actual_exile_v1",
      },
    } as unknown as BoardConfig,
    { fixedRoles: fixed },
  );

function actor(plan: (r: ActionRequest) => ToolCall | null | undefined) {
  const requests: ActionRequest[] = [],
    provider: ActionProvider = {
      getAction: async (r) => {
        requests.push(r);
        const planned = plan(r);
        if (planned !== undefined) return planned;
        if (r.allowedTools.includes("speak_to_wolves"))
          return { name: "speak_to_wolves", args: { text: "wait", end_chat: true } };
        if (r.allowedTools.includes("kill_vote"))
          return { name: "kill_vote", args: { target_id: null, abstain: true } };
        if (r.allowedTools.includes("charm")) return { name: "charm", args: { target_id: null } };
        if (r.allowedTools.includes("run_for_sheriff"))
          return { name: "run_for_sheriff", args: { run: false } };
        if (r.allowedTools.includes("vote_for_sheriff"))
          return { name: "vote_for_sheriff", args: { target_id: 9, abstain: false } };
        if (r.allowedTools.includes("choose_direction"))
          return { name: "choose_direction", args: { direction: "clockwise" } };
        if (r.allowedTools.includes("choose_badge_successor"))
          return { name: "choose_badge_successor", args: { target_id: null } };
        if (r.allowedTools.includes("speak")) return { name: "speak", args: { text: "wait" } };
        if (r.allowedTools.includes("vote"))
          return { name: "vote", args: { target_id: null, abstain: true } };
        if (r.allowedTools.includes("fox_distract"))
          return { name: "fox_distract", args: { target_id: null } };
        if (r.allowedTools.includes("puffer_retaliate"))
          return { name: "puffer_retaliate", args: { activate: false } };
        return null;
      },
    };
  return { provider, requests };
}

test("real first-night Cat knife stays alive through election, announces no night death, then expires after all-abstain exile", async () => {
  const g = game(),
    life = g.world.getComponent(9, COMPONENT.Alive)!,
    initial = aliveLifeVersion(life),
    a = actor((r) =>
      r.allowedTools.includes("kill_vote")
        ? { name: "kill_vote", args: { target_id: 9, abstain: false } }
        : undefined,
    );
  await g.phaseManager.runSingleCycle(a.provider);
  const events = g.phaseManager.getEvents();
  expect(events.filter((e) => e.type === "night_resolved").map((e) => e.payload)).toEqual([
    { deaths: [] },
  ]);
  expect(events.filter((e) => e.type === "animal_cat_revealed").map((e) => e.payload)).toEqual([
    { policy: "awa_animal_dream_v1", day: 1, actorId: 9 },
  ]);
  expect(life.alive).toBe(false);
  expect(aliveLifeVersion(life)).toBe(initial! + 1);
  expect(a.requests.filter((r) => r.actorId === 9 && r.context.stage === "last_words")).toEqual([]);
  expect(
    a.requests
      .filter((r) => r.context.stage === "sheriff_nomination")
      .every((r) => !r.context.visible_events.some((e) => e.type === "animal_cat_revealed")),
  ).toBe(true);
  expect(animalAuthoritySnapshot(g.world)!.cat.form.kind).toBe("expired");
});

test("real current-unit Cat exile preserves life and badge until next unit Exile plus expiry settles once", async () => {
  const g = game(),
    life = g.world.getComponent(9, COMPONENT.Alive)!,
    a = actor((r) => {
      if (r.allowedTools.includes("run_for_sheriff") && r.actorId === 9)
        return { name: "run_for_sheriff", args: { run: true } };
      if (r.allowedTools.includes("vote"))
        return { name: "vote", args: { target_id: 9, abstain: false } };
      return undefined;
    });
  await g.phaseManager.runSingleCycle(a.provider);
  expect(life.alive).toBe(true);
  expect(aliveLifeVersion(life)).toBe(0);
  expect(g.world.getComponent(9, COMPONENT.Badge)?.isSheriff).toBe(true);
  expect(g.phaseManager.getEvents().filter((e) => e.type === "voted_out")).toEqual([]);
  await g.phaseManager.runSingleCycle(a.provider);
  expect(life.alive).toBe(false);
  expect(aliveLifeVersion(life)).toBe(1);
  expect(
    g.phaseManager
      .getEvents()
      .filter((e) => e.type === "voted_out")
      .map((e) => e.payload),
  ).toEqual([{ target: 9 }]);
  expect(
    a.requests.filter((r) => r.actorId === 9 && r.context.stage === "last_words"),
  ).toHaveLength(1);
  expect(
    a.requests.filter((r) => r.actorId === 9 && r.allowedTools.includes("choose_badge_successor")),
  ).toHaveLength(1);
});

test("real Fox N2 Beauty hit skips pack knife and Beauty action, clears old relation, and breaks consecutive restriction", async () => {
  const g = game(),
    a = actor((r) => {
      if (r.allowedTools.includes("charm")) return { name: "charm", args: { target_id: 5 } };
      if (r.allowedTools.includes("fox_distract"))
        return { name: "fox_distract", args: { target_id: 1 } };
      return undefined;
    });
  await g.phaseManager.runSingleCycle(a.provider);
  expect(activeCharm(g.world, 1)?.targetId).toBe(5);
  await g.phaseManager.runSingleCycle(a.provider);
  expect(activeCharm(g.world, 1)).toBeNull();
  expect(
    a.requests.filter((r) => r.context.day === 2 && r.allowedTools.includes("kill_vote")),
  ).toEqual([]);
  expect(a.requests.filter((r) => r.context.day === 2 && r.allowedTools.includes("charm"))).toEqual(
    [],
  );
  const state = getWolfBeautyState(g.world.getComponent(1, COMPONENT.Role)!)!;
  expect(state.history).toEqual([{ day: 1, targetId: 5 }]);
  await g.phaseManager.runSingleCycle(a.provider);
  expect(state.history).toEqual([
    { day: 1, targetId: 5 },
    { day: 3, targetId: 5 },
  ]);
  expect(
    a.requests.filter((r) => r.context.day === 3 && r.allowedTools.includes("fox_distract")),
  ).toEqual([]);
  expect(
    a.requests.filter((r) => r.context.day === 3 && r.allowedTools.includes("kill_vote")),
  ).toHaveLength(4);
});

test("real Puffer exile and full retaliation drain all targets including Cat deferral before wolf-priority judgment", async () => {
  const g = game(),
    a = actor((r) => {
      if (r.allowedTools.includes("vote"))
        return { name: "vote", args: { target_id: 12, abstain: false } };
      if (r.allowedTools.includes("puffer_retaliate"))
        return { name: "puffer_retaliate", args: { activate: true } };
      return undefined;
    });
  await g.phaseManager.runSingleCycle(a.provider);
  expect(g.world.getAliveEntityIds()).toEqual([9]);
  expect(g.phaseManager.getSnapshot().result?.winner).toBe(Camp.Wolf);
  const outcome = g.phaseManager.getSnapshot().result?.outcome;
  expect(outcome?.kind).toBe("victory");
  expect(outcome?.kind === "victory" ? outcome.winningPlayerIds : []).toEqual([1, 2, 3, 4]);
  expect(g.phaseManager.getEvents().filter((e) => e.type === "game_over")).toHaveLength(1);
  expect(animalAuthoritySnapshot(g.world)!.puffer.history).toEqual([
    { day: 1, activate: true, targetIds: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] },
  ]);
  expect(a.requests.filter((r) => r.context.stage === "last_words").map((r) => r.actorId)).toEqual([
    12,
  ]);
});

for (const skip of [false, true])
  test(`real N1 combined pre-election blast follows ${skip ? "expire" : "wait"} Cat skip policy without false night death`, async () => {
    const g = game(skip),
      a = actor((r) => {
        if (r.allowedTools.includes("kill_vote"))
          return { name: "kill_vote", args: { target_id: 9, abstain: false } };
        if (r.actionWindow === ActionWindow.OnPreElection && r.actorId === 2)
          return { name: "self_destruct", args: { confirm: true, reason: "literal blast" } };
        return undefined;
      });
    await g.phaseManager.runSingleCycle(a.provider);
    expect(g.world.getComponent(9, COMPONENT.Alive)!.alive).toBe(!skip);
    expect(
      g.phaseManager
        .getEvents()
        .filter((e) => e.type === "night_resolved")
        .map((e) => e.payload),
    ).toEqual([{ deaths: [] }]);
    expect(animalAuthoritySnapshot(g.world)!.completedUnits).toBe(skip ? 1 : 0);
    expect(a.requests.some((r) => r.allowedTools.includes("vote"))).toBe(false);
    expect(g.phaseManager.getSnapshot().phase).toBe(Phase.Night);
  });

test("A original phase cancellation closes already acquired actual exile unit", async () => {
  const g = game();
  let jumped = false;
  const a = actor((r) => {
    if (r.allowedTools.includes("vote") && !jumped) {
      jumped = true;
      g.phaseManager.jumpTo(Phase.Night);
    }
    return undefined;
  });
  await g.phaseManager.runSingleCycle(a.provider);
  expect(jumped).toBe(true);
  const snapshot = animalAuthoritySnapshot(g.world, false)!;

  expect(snapshot.stopped).toBe(true);
  expect(snapshot.unit?.status).toBe("aborted");
});

test("A native night stops before any successor request after original Fox body is replaced", async () => {
  const g = game();
  let changed = false,
    after = 0;
  const a = actor((r) => {
    if (changed) after++;
    if (!changed && r.allowedTools.includes("speak_to_wolves")) {
      changed = true;
      g.world.addComponent(10, COMPONENT.Alive, createAliveComponent());
    }
    return undefined;
  });
  await expect(g.phaseManager.runSingleCycle(a.provider)).rejects.toThrow();
  expect(changed).toBe(true);
  expect(after).toBe(0);
});

for (const kind of ["fox", "puffer"] as const)
  test(`A ${kind} postgateway target replacement cannot pay resource`, async () => {
    const g = game();
    const original = ToolGateway.prototype.validateAndSanitize;
    let mutated = false;
    ToolGateway.prototype.validateAndSanitize = function (this: ToolGateway, ...args: any[]) {
      const result = original.apply(this, args as any);
      const tool = args[2]?.name;
      if (result.ok && tool === (kind === "fox" ? "fox_distract" : "puffer_retaliate")) {
        mutated = true;
        g.world.addComponent(5, COMPONENT.Alive, createAliveComponent());
      }
      return result;
    } as any;
    const a = actor((r) => {
      if (kind === "puffer" && r.allowedTools.includes("vote") && r.actorId === 5)
        return { name: "vote", args: { target_id: 12, abstain: false } };
      if (r.allowedTools.includes("fox_distract"))
        return { name: "fox_distract", args: { target_id: 5 } };
      if (r.allowedTools.includes("puffer_retaliate"))
        return { name: "puffer_retaliate", args: { activate: true } };
    });
    try {
      if (kind === "fox") await g.phaseManager.runSingleCycle(a.provider);
      await expect(g.phaseManager.runSingleCycle(a.provider)).rejects.toThrow();
      expect(mutated).toBe(true);
      const s = animalAuthoritySnapshot(g.world, false)!;
      expect(kind === "fox" ? s.fox.usedNight : s.puffer.usedDay).toBeNull();
      expect(kind === "fox" ? s.fox.history : s.puffer.history).toEqual([]);
    } finally {
      ToolGateway.prototype.validateAndSanitize = original;
    }
  });

for (const skip of [false, true])
  test(`preVote Cat skip actual PM skip=${skip}`, async () => {
    const g = game(skip);
    const a = actor((r) => {
      if (r.allowedTools.includes("kill_vote") && r.context.day === 1)
        return { name: "kill_vote", args: { target_id: 9, abstain: false } };
      if (r.actionWindow === ActionWindow.OnPreVote && r.actorId === 2 && r.context.day === 1)
        return { name: "self_destruct", args: { confirm: true, reason: "literal preVote" } };
    });
    await g.phaseManager.runSingleCycle(a.provider);
    expect(g.world.getComponent(9, COMPONENT.Alive)!.alive).toBe(!skip);
    expect(animalAuthoritySnapshot(g.world)!.completedUnits).toBe(skip ? 1 : 0);
    expect(a.requests.some((r) => r.context.day === 1 && r.allowedTools.includes("vote"))).toBe(
      false,
    );
    if (!skip) {
      await g.phaseManager.runSingleCycle(a.provider);
      expect(g.world.getComponent(9, COMPONENT.Alive)!.alive).toBe(false);
    }
    expect(a.requests.filter((r) => r.actorId === 9 && r.context.stage === "last_words")).toEqual(
      [],
    );
  });

test("Beauty exile linked Cat is deferred in added wave, no false charm death, expires next unit", async () => {
  const g = game();
  const a = actor((r) => {
    if (r.allowedTools.includes("charm")) return { name: "charm", args: { target_id: 9 } };
    if (r.allowedTools.includes("vote") && r.context.day === 1)
      return { name: "vote", args: { target_id: 1, abstain: false } };
  });
  await g.phaseManager.runSingleCycle(a.provider);
  expect(g.world.getComponent(9, COMPONENT.Alive)!.alive).toBe(true);
  expect(g.phaseManager.getEvents().filter((e) => e.type === "charm_death")).toEqual([]);
  expect(a.requests.filter((r) => r.actorId === 9 && r.context.stage === "last_words")).toEqual([]);
  await g.phaseManager.runSingleCycle(a.provider);
  expect(g.world.getComponent(9, COMPONENT.Alive)!.alive).toBe(false);
  expect(a.requests.filter((r) => r.actorId === 9 && r.context.stage === "last_words")).toEqual([]);
});

for (const policy of ["awa_first_ballot_v1", "awa_final_ballot_v1"])
  test(`PK all abstain keeps ${policy} targets`, async () => {
    const g = bootstrapGame(
      { ...animalInternalConfig(), pufferfish: { ballotPolicy: policy } } as unknown as BoardConfig,
      { fixedRoles: fixed },
    );
    const a = actor((r) => {
      if (r.allowedTools.includes("vote")) {
        if (r.context.round === 2)
          return { name: "vote", args: { target_id: null, abstain: true } };
        const target = [2, 3].includes(r.actorId) ? 12 : [4, 5].includes(r.actorId) ? 6 : null;
        return { name: "vote", args: { target_id: target, abstain: target === null } };
      }
      if (r.allowedTools.includes("puffer_retaliate"))
        return { name: "puffer_retaliate", args: { activate: true } };
    });
    await g.phaseManager.runSingleCycle(a.provider);
    expect(a.requests.filter((r) => r.allowedTools.includes("puffer_retaliate")).length).toBe(
      policy === "awa_first_ballot_v1" ? 1 : 0,
    );
    expect(g.world.getAliveEntityIds()).toEqual(
      policy === "awa_first_ballot_v1"
        ? [1, 4, 5, 6, 7, 8, 9, 10, 11, 12]
        : [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
    );
    expect(a.requests.filter((r) => r.context.stage === "last_words")).toEqual([]);
  });

test("paid Puffer later real knife still blocks Beauty exile link that day", async () => {
  const g = game();
  const a = actor((r) => {
    if (r.allowedTools.includes("kill_vote") && r.context.day === 2)
      return { name: "kill_vote", args: { target_id: 12, abstain: false } };
    if (r.allowedTools.includes("charm"))
      return { name: "charm", args: { target_id: r.context.day === 1 ? 7 : 6 } };
    if (r.allowedTools.includes("vote")) {
      if (r.context.day === 2) return { name: "vote", args: { target_id: 1, abstain: false } };
      const target = [2, 3].includes(r.actorId) ? 12 : [1, 4, 6].includes(r.actorId) ? 5 : null;
      return { name: "vote", args: { target_id: target, abstain: target === null } };
    }
    if (r.allowedTools.includes("puffer_retaliate"))
      return { name: "puffer_retaliate", args: { activate: true } };
  });
  await g.phaseManager.runSingleCycle(a.provider);
  expect(g.world.getAliveEntityIds()).toEqual([1, 4, 6, 7, 8, 9, 10, 11, 12]);
  expect(animalAuthoritySnapshot(g.world)!.puffer.usedDay).toBe(1);
  await g.phaseManager.runSingleCycle(a.provider);
  expect(animalAuthoritySnapshot(g.world)!.puffer.knifeDeathDay).toBe(2);
  expect(g.world.getComponent(6, COMPONENT.Alive)!.alive).toBe(true);
  expect(g.phaseManager.getEvents().filter((e) => e.type === "charm_death")).toEqual([]);
  expect(
    a.requests.filter((r) => r.context.day === 2 && r.allowedTools.includes("puffer_retaliate")),
  ).toEqual([]);
});

test("last Wolf initial death and last god linked added death settle completely before unique Wolf victory", async () => {
  const g = game();
  const a = actor((r) => {
    const d = r.context.day;
    if (r.allowedTools.includes("kill_vote"))
      return {
        name: "kill_vote",
        args: { target_id: d === 1 ? 9 : d === 2 ? 10 : d === 3 ? 11 : null, abstain: d === 4 },
      };
    if (r.allowedTools.includes("charm"))
      return { name: "charm", args: { target_id: d === 4 ? 12 : d === 3 ? 6 : d === 2 ? 8 : 7 } };
    if (r.allowedTools.includes("vote"))
      return {
        name: "vote",
        args: {
          target_id: d === 1 ? 2 : d === 2 ? 3 : d === 3 ? 4 : r.actorId === 1 ? 12 : 1,
          abstain: false,
        },
      };
    if (r.allowedTools.includes("puffer_retaliate"))
      return { name: "puffer_retaliate", args: { activate: true } };
  });
  for (let i = 0; i < 4; i++) await g.phaseManager.runSingleCycle(a.provider);
  expect(g.world.getAliveEntityIds()).toEqual([5, 6, 7, 8]);
  expect(g.phaseManager.getSnapshot().result?.winner).toBe(Camp.Wolf);
  const winnerOutcome = g.phaseManager.getSnapshot().result?.outcome;
  expect(winnerOutcome?.kind === "victory" ? winnerOutcome.winningPlayerIds : []).toEqual([
    1, 2, 3, 4,
  ]);
  const events = g.phaseManager.getEvents();
  expect(events.filter((e) => e.type === "game_over")).toHaveLength(1);
  expect(events.findLastIndex((e) => e.type === "game_over")).toBeGreaterThan(
    events.findLastIndex((e) => e.type === "charm_death"),
  );
  expect(events.filter((e) => e.type === "charm_death").map((e) => e.payload)).toEqual([
    { actorId: 1, targetId: 12 },
  ]);
  expect(
    a.requests
      .filter((r) => r.context.day === 4 && r.context.stage === "last_words")
      .map((r) => r.actorId),
  ).toEqual([1]);
});
