/**
 * 集成测试驱动真实DR、工厂、领域网关与patrol死亡许可，按字面原体／死因／公开死亡顺序断言暗夜星辰结算。
 * 不使用模型、私有配置或生产规则计算预期；覆盖毒刀混源、夜根与投票根、原盾→替死→替身盾三方及失败前缀。
 */
import { expect, test } from "bun:test";
import { Role, Camp, Phase, DeathCause, type GameEvent } from "@ai-werewolf-arena/game-contract";
import { World } from "../../../../src/domain/world";
import { COMPONENT } from "../../../../src/domain/components/names";
import { createAliveComponent } from "../../../../src/domain/components/alive";
import { createRoleComponent } from "../../../../src/domain/components/role";
import { DeathResolution } from "../../../../src/engine/death-resolution";
import { EventRegistry } from "../../../../src/engine/events/event-registry";
import { HookRegistry } from "../../../../src/engine/hooks/registry";
import { ToolGateway } from "../../../../src/engine/actions/tool-gateway";
import {
  initializeAwakenedBeautyState,
  getAwakenedBeautyState,
} from "../../../../src/features/awakened-wolf-beauty/state";
import {
  prepareAwakenedBeautyNight,
  openAwakenedCharm,
  payAwakenedCharm,
} from "../../../../src/features/awakened-wolf-beauty/authority";
import {
  initializeAwakenedPatrolState,
  getAwakenedPatrolState,
} from "../../../../src/features/awakened-hunter/state";
import { bindAwakenedPatrol } from "../../../../src/features/awakened-hunter/authority";
import { AWAKENED_PATROL_DEATH_HOOK } from "../../../../src/features/awakened-hunter/death-hook";
import { initializeAwakenedGuardState } from "../../../../src/features/awakened-guard/state";
import {
  beginGuardCycle,
  openGuardBoundary,
  commitGuardChoice,
  endGuardCycle,
} from "../../../../src/features/awakened-guard/authority";
import type { ActionProvider } from "../../../../src/domain/actions";
import { deferRequestDelivery } from "../../../../src/domain/request-delivery";
import { ActionReception } from "../../../../src/engine/actions/action-reception";
import { prepareAwakenedDeaths } from "../../../../src/rulesets/awakened-death-prevention";
function fixture(shield?: number) {
  const world = new World("en"),
    events: GameEvent[] = [],
    state = { day: 1, phase: Phase.Day, gameOver: false, result: null };
  const roles = Array.from({ length: 6 }, (_, i) => {
    const id = world.createEntity(),
      role = createRoleComponent(
        id === 1
          ? Role.AwakenedWolfBeauty
          : id === 5
            ? Role.AwakenedHunter
            : id === 3
              ? Role.Wolf
              : id === 6
                ? Role.AwakenedGuard
                : Role.Villager,
      );
    world.addComponent(id, COMPONENT.Role, role);
    world.addComponent(id, COMPONENT.Alive, createAliveComponent());
    world.addComponent(id, COMPONENT.Camp, { camp: [1, 3].includes(id) ? Camp.Wolf : Camp.Good });
    return role;
  });
  initializeAwakenedBeautyState(roles[0]!);
  initializeAwakenedPatrolState(roles[4]!);
  bindAwakenedPatrol(world, 5);
  prepareAwakenedBeautyNight(world, 1, 1, () => true);
  openAwakenedCharm(world, 1, 1);
  payAwakenedCharm(world, 1, 1, 2, () => true);
  if (shield !== undefined) {
    initializeAwakenedGuardState(roles[5]!, world);
    beginGuardCycle(world, 6, 1, {}, () => true);
    const b = openGuardBoundary(world, 1, {}, "night")!;
    commitGuardChoice(world, b, { mode: "protect", targetId: shield }, () => true);
  }
  const dr = new DeathResolution(
    world,
    events,
    new ToolGateway(),
    new EventRegistry(new HookRegistry([], [AWAKENED_PATROL_DEATH_HOOK])),
    state,
  );
  const alive = () =>
    Array.from({ length: 6 }, (_, i) => world.getComponent(i + 1, COMPONENT.Alive)!.alive);
  return { world, events, state, roles, dr, alive };
}
const words: ActionProvider = {
  async getAction() {
    return { name: "speak", args: { text: "literal words" } };
  },
};
for (const root of [Phase.Night, Phase.Day, Phase.Voting])
  test(`真实${root}根混合刀毒巡猎只夜源抑制替死，许可及公开死者诚实`, async () => {
    const f = fixture();
    let patrols = 0;
    const provider: ActionProvider = {
      async getAction(r) {
        if (r.allowedTools.includes("patrol")) {
          patrols++;
          expect(r.context.death_origin_phase).toBe(root);
          expect(r.context.death_sources).toEqual([DeathCause.Poison, DeathCause.WolfKill]);
          expect(r.context.patrol_seat_order).toEqual([1, 2, 3, 4, 5, 6]);
          expect(r.context.shoot_candidates).toBeUndefined();
          expect(f.world.hasDeathAction(5, "patrol", Phase.Day, 1, r.context.death_action_id)).toBe(
            true,
          );
          return { name: "patrol", args: { direction: "clockwise" } };
        }
        return { name: "speak", args: { text: "literal words" } };
      },
    };
    await f.dr.resolve(
      [5],
      { 5: [DeathCause.Poison, DeathCause.WolfKill] },
      provider,
      Phase.Day,
      Phase.Day,
      { 5: root },
      { nightOriginIds: root === Phase.Night ? [5] : [] },
    );
    expect(patrols).toBe(1);
    expect(f.world.activeDeathActionCount).toBe(0);
    expect(f.alive()).toEqual(
      root === Phase.Night
        ? [false, true, true, true, false, true]
        : [true, false, true, true, false, true],
    );
    expect(getAwakenedBeautyState(f.roles[0])!.replacement === null).toBe(root === Phase.Night);
    expect(getAwakenedPatrolState(f.roles[4])!.payment).toEqual({
      day: 1,
      rootPhase: root,
      direction: "clockwise",
      targetId: 1,
    });
    expect(
      f.events.filter((e) => e.type === "awakened_patrol_resolved").map((e) => e.payload.targetId),
    ).toEqual([root === Phase.Night ? 1 : 2]);
    expect(
      f.events.filter((e) => e.type === "additional_deaths").map((e) => e.payload.deaths),
    ).toEqual([[root === Phase.Night ? 1 : 2]]);
  });
for (const shield of [undefined, 1, 2])
  test(`初始投票替死与${shield ?? "无"}号全天盾只提交实际名单和词徽资格`, async () => {
    const f = fixture(shield);
    await f.dr.resolve([1], { 1: [DeathCause.Exile] }, words, Phase.Voting, Phase.Day, {
      1: Phase.Voting,
    });
    expect(f.alive()).toEqual(
      shield === undefined
        ? [true, false, true, true, true, true]
        : [true, true, true, true, true, true],
    );
    expect(getAwakenedBeautyState(f.roles[0])!.replacement === null).toBe(shield === 1);
    expect(f.events.some((e) => e.type === "voted_out")).toBe(false);
    expect(
      f.events.filter((e) => e.type === "last_words_granted").map((e) => e.payload.playerId),
    ).toEqual(shield === undefined ? [2] : []);
    expect(
      f.events
        .filter((e) => e.type === "awakened_protection_blocked")
        .map((e) => e.payload.targetId),
    ).toEqual(shield === undefined ? [] : [shield]);
    expect(
      f.events.filter((e) => e.type === "additional_deaths").map((e) => e.payload.deaths),
    ).toEqual(shield === undefined ? [[2]] : []);
  });
test("无原活狼不开Provider或许可；手写AwPatrol来源不能伪造夜根权限", async () => {
  const f = fixture();
  f.state.day = 2;
  for (const id of [1, 3]) f.world.getComponent(id, COMPONENT.Alive)!.alive = false;
  let requests = 0;
  await f.dr.resolve(
    [5],
    { 5: [DeathCause.Poison] },
    {
      async getAction() {
        requests++;
        return null;
      },
    },
    Phase.Day,
    Phase.Day,
    { 5: Phase.Night },
  );
  expect(requests).toBe(0);
  expect(getAwakenedPatrolState(f.roles[4])!.payment).toBeNull();
  expect(f.world.activeDeathActionCount).toBe(0);
  const g = fixture();
  await expect(
    g.dr.resolve([1], { 1: [DeathCause.AwakenedPatrol] }, words, Phase.Day, Phase.Day),
  ).rejects.toThrow("awakened_patrol_proposal_invalid");
  expect(g.alive()).toEqual([true, true, true, true, true, true]);
  expect(getAwakenedBeautyState(g.roles[0])!.replacement).toBeNull();
});
test("真实缺失方向拒绝并false关闭，不耗巡猎或替死且保猎人已死亡", async () => {
  const f = fixture();
  f.state.day = 2;
  await expect(
    f.dr.resolve(
      [5],
      { 5: [DeathCause.Poison] },
      {
        async getAction() {
          return null;
        },
      },
      Phase.Day,
      Phase.Day,
      { 5: Phase.Night },
    ),
  ).rejects.toThrow("awakened_patrol_action_missing");
  expect(f.alive()).toEqual([true, true, true, true, false, true]);
  expect(getAwakenedPatrolState(f.roles[4])!.payment).toBeNull();
  expect(f.world.activeDeathActionCount).toBe(0);
});
test("替死已付God日志抛错不退款、不假标死或补公开事件", async () => {
  const f = fixture(),
    push = f.events.push,
    err = new Error("literal_paid_sink_failure");
  f.events.push = function (...events) {
    if (events.some((e) => e.type === "awakened_beauty_replacement_paid")) throw err;
    return Reflect.apply(push, this, events);
  };
  expect(
    await f.dr
      .resolve([1], { 1: [DeathCause.Exile] }, words, Phase.Voting, Phase.Day, { 1: Phase.Voting })
      .catch((e) => e),
  ).toBe(err);
  expect(f.alive()).toEqual([true, true, true, true, true, true]);
  expect(getAwakenedBeautyState(f.roles[0])!.replacement?.targetId).toBe(2);
  expect(
    f.events.filter(
      (e) =>
        e.type === "additional_deaths" ||
        e.type === "voted_out" ||
        e.type === "awakened_beauty_replaced",
    ),
  ).toEqual([]);
});
test("替死付款后事件回调替换目标不杀新body，保已付一次和原错误", async () => {
  const f = fixture(),
    push = f.events.push;
  f.events.push = function (...events) {
    const result = Reflect.apply(push, this, events);
    if (events.some((e) => e.type === "awakened_beauty_replacement_paid"))
      f.world.addComponent(2, COMPONENT.Alive, createAliveComponent());
    return result;
  };
  await expect(
    f.dr.resolve([1], { 1: [DeathCause.Exile] }, words, Phase.Voting, Phase.Day, {
      1: Phase.Voting,
    }),
  ).rejects.toThrow("awakened_beauty_replacement_target_stale");
  expect(f.alive()).toEqual([true, true, true, true, true, true]);
  expect(getAwakenedBeautyState(f.roles[0])!.replacement?.targetId).toBe(2);
  expect(f.events.filter((e) => e.type === "additional_deaths")).toEqual([]);
});
for (const mode of ["missing", "late", "throw", "direction_getter"] as const)
  test(`真实patrol ${mode}发false并关闭许可，无替死/巡猎新付款`, async () => {
    const f = fixture(),
      notices: boolean[] = [],
      original = new Error("literal_provider_failure");
    f.state.day = 2;
    const provider: ActionProvider = {
      async getAction(r) {
        deferRequestDelivery(r, (accepted) => notices.push(accepted));
        if (mode === "throw") throw original;
        if (mode === "missing") return null;
        if (mode === "late") r.deadlineAtMs = Date.now() - 1;
        return {
          name: "patrol",
          args:
            mode === "direction_getter"
              ? {
                  get direction() {
                    r.deadlineAtMs = Date.now() - 1;
                    return "clockwise" as const;
                  },
                }
              : { direction: "clockwise" },
        };
      },
    };
    const result = await f.dr
      .resolve([5], { 5: [DeathCause.Poison] }, provider, Phase.Day, Phase.Day, { 5: Phase.Night })
      .catch((e) => e);
    expect(result).toBeInstanceOf(Error);
    if (mode === "throw") expect(result).toBe(original);
    expect(notices).toEqual([false]);
    expect(f.world.activeDeathActionCount).toBe(0);
    expect(getAwakenedPatrolState(f.roles[4])!.payment).toBeNull();
    expect(getAwakenedBeautyState(f.roles[0])!.replacement).toBeNull();
    expect(f.alive()).toEqual([true, true, true, true, false, true]);
    expect(
      f.events.some(
        (e) => e.type === "awakened_patrol_paid" || e.type === "awakened_patrol_resolved",
      ),
    ).toBe(false);
  });
test("巡猎付款true后日志失败不退款，Body尚未mark不得补实际死亡", async () => {
  const f = fixture(),
    notices: boolean[] = [],
    push = f.events.push,
    original = new Error("literal_patrol_sink_failure");
  f.state.day = 2;
  f.events.push = function (...events) {
    if (events.some((e) => e.type === "awakened_patrol_paid")) throw original;
    return Reflect.apply(push, this, events);
  };
  const failure = await f.dr
    .resolve(
      [5],
      { 5: [DeathCause.Poison] },
      {
        async getAction(r) {
          deferRequestDelivery(r, (accepted) => notices.push(accepted));
          return { name: "patrol", args: { direction: "clockwise" } };
        },
      },
      Phase.Day,
      Phase.Day,
      { 5: Phase.Night },
    )
    .catch((e) => e);
  expect(failure).toBe(original);
  expect(notices).toEqual([true]);
  expect(getAwakenedPatrolState(f.roles[4])!.payment?.targetId).toBe(1);
  expect(f.world.activeDeathActionCount).toBe(0);
  expect(f.alive()).toEqual([true, true, true, true, false, true]);
  expect(
    f.events.some((e) => e.type === "awakened_patrol_resolved" || e.type === "additional_deaths"),
  ).toBe(false);
});
test("新准备只读真实原生命Map数据，不执行覆写get或scope访问器", async () => {
  const f = fixture();
  let gets = 0;
  const scopes = new Map([[1, { life: f.world.getComponent(1, COMPONENT.Alive)!, version: 0 }]]);
  Object.defineProperty(scopes, "get", {
    get() {
      gets++;
      throw new Error("literal_overridden_map_get");
    },
  });
  await f.dr.resolve(
    [1],
    { 1: [DeathCause.Poison] },
    words,
    Phase.Day,
    Phase.Day,
    { 1: Phase.Night },
    { originalLives: scopes },
  );
  expect(gets).toBe(0);
  expect(f.alive()).toEqual([true, false, true, true, true, true]);
  const g = fixture(),
    malformed = new Map([
      [
        1,
        {
          get life(): import("../../../../src/domain/components/alive").AliveComponent {
            gets++;
            throw new Error("literal_scope_getter");
          },
          version: 0,
        },
      ],
    ]);
  await expect(
    g.dr.resolve(
      [1],
      { 1: [DeathCause.Poison] },
      words,
      Phase.Day,
      Phase.Day,
      { 1: Phase.Night },
      { originalLives: malformed },
    ),
  ).rejects.toThrow("awakened_death_original_lives_invalid");
  expect(gets).toBe(0);
  expect(g.alive()).toEqual([true, true, true, true, true, true]);
});
test("真实统一ActionReception只接受patrol原stage/trigger/许可，关窗后不能提交", async () => {
  const f = fixture(),
    receive = new ActionReception(f.world);
  f.state.day = 2;
  let accepted = 0;
  await f.dr.resolve(
    [5],
    { 5: [DeathCause.Poison] },
    {
      async getAction(r) {
        const args = { direction: "clockwise" };
        expect(
          receive.validate(
            { ...r, context: { ...r.context, death_action_id: undefined } },
            "patrol",
            args,
          ).ok,
        ).toBe(false);
        expect(
          receive.validate({ ...r, context: { ...r.context, stage: "day_speech" } }, "patrol", args)
            .ok,
        ).toBe(false);
        expect(
          receive.validate({ ...r, context: { ...r.context, trigger: undefined } }, "patrol", args)
            .ok,
        ).toBe(false);
        const valid = receive.validate(r, "patrol", args);
        expect(valid.ok).toBe(true);
        if (!valid.ok) throw new Error("literal_patrol_reception_rejected");
        accepted++;
        return valid.action;
      },
    },
    Phase.Day,
    Phase.Day,
    { 5: Phase.Night },
  );
  expect(accepted).toBe(1);
  expect(f.alive()[0]).toBe(false);
  expect(f.world.activeDeathActionCount).toBe(0);
  const g = fixture(),
    other = new ActionReception(g.world);
  g.state.day = 2;
  await expect(
    g.dr.resolve(
      [5],
      { 5: [DeathCause.Poison] },
      {
        async getAction(r) {
          g.world.closeDeathActions();
          expect(other.validate(r, "patrol", { direction: "clockwise" }).ok).toBe(false);
          return { name: "patrol", args: { direction: "clockwise" } };
        },
      },
      Phase.Day,
      Phase.Day,
      { 5: Phase.Night },
    ),
  ).rejects.toThrow("awakened_patrol_action_invalid");
  expect(getAwakenedPatrolState(g.roles[4])!.payment).toBeNull();
  expect(g.world.activeDeathActionCount).toBe(0);
});
for (const boundary of ["current", "sink"] as const)
  test(`阻挡首写前${boundary}使全天盾到期不漏掉真实致死`, () => {
    const f = fixture(2),
      ids = [2],
      sources = { 2: [DeathCause.Poison] },
      roots = new Map([[2, Phase.Night]]);
    let ended = false;
    if (boundary === "sink") {
      const push = f.events.push;
      Object.defineProperty(f.events, "push", {
        get() {
          if (!ended) {
            ended = true;
            endGuardCycle(f.world, 1, true);
          }
          return push;
        },
      });
    }
    prepareAwakenedDeaths(
      {
        world: f.world,
        day: 1,
        phase: Phase.Day,
        events: f.events,
        isCurrent() {
          if (boundary === "current" && !ended) {
            ended = true;
            endGuardCycle(f.world, 1, true);
          }
          return true;
        },
      },
      ids,
      sources,
      roots,
    );
    expect(ids).toEqual([2]);
    expect(sources).toEqual({ 2: [DeathCause.Poison] });
    expect(f.events).toEqual([]);
  });
