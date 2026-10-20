/**
 * 单元测试验证真实死亡计划、原生命提交凭证及发布边界。输入为内存 World、字面死因、
 * 原体引用和受控 hook；手写生命状态、来源身份、事件对象及失败前缀是独立预期。
 * 静态坏 proposal 必须在本 proposal 的角色事实前拒绝；先前合法死亡不回滚。
 * 不推进完整对局、不访问模型或归档文件；只读负例不执行，也不授予运行时死亡权限。
 */
import { createAliveComponent } from "../../../../src/agents/observation/component-presentation";
import { expect, test } from "bun:test";
import { World } from "../../../../src/domain/world";
import { aliveLifeVersion } from "../../../../src/domain/components/alive";
import { createRoleComponent } from "../../../../src/agents/observation/role-presentation";
import type { ComponentName } from "../../../../src/domain/components/names";
import type { DeathHookResult } from "../../../../src/engine/hooks/registry";
import { COMPONENT } from "../../../../src/domain/components/names";
import {
  Camp,
  DeathCause,
  Phase,
  Role,
  type DeathSources,
  type GameEvent,
  type RuntimeSnapshot,
} from "../../../../src/domain/model";
import type { NightIntentOrigin, NightPoisonRoute } from "../../../../src/domain/night-effects";
import { captureNightLife, originalPoisonIntent } from "../../../../src/domain/night-effects";
import { damagePoisonRoutes } from "../../../../src/domain/damage-evidence";
import { DamageResolutionSystem } from "../../../../src/domain/systems/damage-resolution-system";
import { StatusMarksComponent } from "../../../../src/domain/components/status-marks";
import { StatusMark } from "@ai-werewolf-arena/game-contract";
import { DeathCommitter } from "../../../../src/engine/death-committer";
import { DeathResolution } from "../../../../src/engine/death-resolution";
import {
  DeathCommitReceipt,
  openDeathWave,
  planDeathWave,
  preflightDeathWaveData,
} from "../../../../src/engine/death-wave";
import { ToolGateway } from "../../../../src/engine/actions/tool-gateway";
import { EventRegistry } from "../../../../src/engine/events/event-registry";
import { HookRegistry } from "../../../../src/engine/hooks/registry";

function fixture() {
  const world = new World("en"),
    events: GameEvent[] = [],
    state: RuntimeSnapshot = { day: 2, phase: Phase.Day, gameOver: false, result: null };
  const lives = [1, 2, 3].map(() => {
    const id = world.createEntity(),
      life = createAliveComponent();
    world.addComponent(id, COMPONENT.Alive, life);
    world.addComponent(id, COMPONENT.Role, createRoleComponent(Role.Villager));
    world.addComponent(id, COMPONENT.Camp, { camp: Camp.Good });
    return life;
  });
  const committer = new DeathCommitter({ world, events, state });
  const resolver = (hooks = new HookRegistry([], [])) =>
    new DeathResolution(world, events, new ToolGateway(), new EventRegistry(hooks), state);
  return { world, events, state, lives, committer, resolver };
}
const actionProvider = {
  async getAction() {
    return { name: "speak" as const, args: { text: "Raw words" } };
  },
};

function poison(f: ReturnType<typeof fixture>, route: NightPoisonRoute["route"]): NightPoisonRoute {
  const source = f.lives[0]!,
    target = f.lives[1]!;
  const origin: NightIntentOrigin = Object.freeze({
    family: "witch",
    day: 2,
    stage: "witch",
    actorId: 1,
    actorLife: { id: 1, life: source, version: 0 },
    requestedTargetId: 2,
    effectiveTargetId: 2,
    abilityId: "native:potion",
    sourceVersion: 0,
    targetVersion: 0,
    sourceBody: source,
    targetBody: target,
    causeId: Symbol("test_poison"),
  });
  return {
    route,
    origin,
    targetId: route === "direct" ? 2 : 1,
    target: {
      id: route === "direct" ? 2 : 1,
      life: route === "direct" ? target : source,
      version: 0,
    },
  };
}

test("accepted direct and reflected causes bind the original ledger body without consulting a replaceable route scope", () => {
  const f = fixture(),
    direct = poison(f, "direct"),
    reflected = poison(f, "reflected"),
    ids = [2, 1],
    sources: DeathSources = { 2: [DeathCause.Poison], 1: [DeathCause.Poison] },
    unit = openDeathWave("initial", 2, Phase.Day);
  // 路由 target 是可变查询视图；原 origin 的锁定 body/version 才是诊断依据。
  (direct as { target: NightPoisonRoute["target"] }).target = {
    id: 2,
    life: createAliveComponent(),
    version: 999,
  };
  const plan = planDeathWave(
    ids,
    sources,
    "initial",
    new Map([
      [2, Phase.Night],
      [1, Phase.Night],
    ]),
    undefined,
    [direct, reflected],
    [unit],
  );
  const receipt = f.committer.markPlayersDead(ids, false, [], false, sources, undefined, plan);
  expect(receipt.wave.ids).toBe(ids);
  expect(receipt.wave.sources).toBe(sources);
  expect(
    receipt.entries.map((entry) => [entry.id, entry.firstSettlement, entry.settled.version]),
  ).toEqual([
    [2, true, 1],
    [1, true, 1],
  ]);
  expect(receipt.committed(2)!.settled.component).toBe(f.lives[1]);
  expect(receipt.poisonRoutesFor(2)).toEqual([direct]);
  expect(receipt.poisonRoutesFor(1)).toEqual([reflected]);
  expect(receipt.committed(1)!.units).toEqual([unit]);
  expect(Object.isFrozen(receipt.committed(2)!.settled)).toBe(true);
});

test("replacement, stale versions and removed Poison remain committed but carry unknown causal evidence", () => {
  const f = fixture(),
    route = poison(f, "direct"),
    replacement = createAliveComponent(),
    ids = [2],
    sources: DeathSources = { 2: [DeathCause.Poison] };
  f.world.addComponent(2, COMPONENT.Alive, replacement);
  const first = f.committer.markPlayersDead(
    ids,
    false,
    [],
    false,
    sources,
    undefined,
    planDeathWave(ids, sources, "initial", undefined, undefined, [route]),
  );
  expect(replacement.alive).toBe(false);
  expect(first.committed(2)!.settled.component).toBe(replacement);
  expect(first.poisonRoutesFor(2)).toEqual([]);
  f.world.addComponent(2, COMPONENT.Alive, f.lives[1]!);
  f.lives[1]!.alive = false;
  f.lives[1]!.alive = true;
  const stale = f.committer.markPlayersDead(
    ids,
    false,
    [],
    false,
    sources,
    undefined,
    planDeathWave(ids, sources, "initial", undefined, undefined, [route]),
  );
  expect(stale.committed(2)!.settled.version).toBe(3);
  expect(stale.poisonRoutesFor(2)).toEqual([]);
  sources[2] = [DeathCause.Ability];
  const removed = f.committer.markPlayersDead(
    ids,
    false,
    [],
    false,
    sources,
    undefined,
    planDeathWave(ids, sources, "revisit", undefined, undefined, [route]),
  );
  expect(removed.committed(2)!.firstSettlement).toBe(false);
  expect(removed.poisonRoutesFor(2)).toEqual([]);
});

test("one actual additional wave shares identity across individual commits and the combined revisit retains those identities", () => {
  const f = fixture(),
    sources: DeathSources = { 1: [DeathCause.Ability], 2: [DeathCause.Ability] },
    unit = openDeathWave("additional", 2, Phase.Day),
    previous: DeathCommitReceipt[] = [];
  for (const id of [1, 2]) {
    const ids = [id],
      plan = planDeathWave(ids, sources, "additional", undefined, undefined, [], [unit]);
    previous.push(f.committer.markPlayersDead(ids, false, [], false, sources, undefined, plan));
  }
  const ids = [1, 2],
    revisit = f.committer.markPlayersDead(
      ids,
      false,
      [],
      false,
      sources,
      undefined,
      planDeathWave(ids, sources, "revisit", undefined, undefined, [], [unit], previous),
    );
  expect(previous[0]!.wave.units[0]).toBe(previous[1]!.wave.units[0]);
  expect(
    revisit.entries.map((entry) => [entry.id, entry.firstSettlement, entry.units[0] === unit]),
  ).toEqual([
    [1, false, true],
    [2, false, true],
  ]);
  expect(unit.day).toBe(2);
  expect(unit.actionPhase).toBe(Phase.Day);
});

test("the real initial callback receives committed bodies and publication links keep frozen events completely unchanged", async () => {
  const f = fixture(),
    route = poison(f, "direct"),
    event: GameEvent = Object.freeze({
      timestamp: 7,
      type: "night_resolved",
      payload: { deaths: [2] },
    });
  let receipt: DeathCommitReceipt | undefined;
  const originalLives = new Map([[2, { life: f.lives[1]!, version: 0 }]]);
  await f.resolver().resolve(
    [2],
    { 2: [DeathCause.Poison] },
    actionProvider,
    Phase.Night,
    Phase.Day,
    {},
    {
      originalLives,
      poisonRoutes: [route],
      onInitialWaveCommitted(ids, sources, committed) {
        expect(ids).toEqual([2]);
        expect(sources).toEqual({ 2: [DeathCause.Poison] });
        expect(f.lives[1]!.alive).toBe(false);
        expect(committed.committed(2)!.settled.component).toBe(f.lives[1]);
        expect(committed.poisonRoutesFor(2)).toEqual([route]);
        expect(committed.wave.originalLives).toBe(originalLives);
        receipt = committed;
        return event;
      },
    },
  );
  expect(receipt!.publicationLinks()).toEqual([{ event, ids: [2] }]);
  expect(receipt!.publicationLinks()[0]!.event).toBe(event);
  expect(Reflect.ownKeys(event)).toEqual(["timestamp", "type", "payload"]);
  expect(JSON.stringify(event)).toBe(
    '{"timestamp":7,"type":"night_resolved","payload":{"deaths":[2]}}',
  );
});

test("data-only malformed initial tails are rejected before any death, callback or hook fact", async () => {
  for (const malformed of ["id", "cause", "phase"] as const) {
    const f = fixture();
    const ids = malformed === "id" ? [1, Number.NaN] : [1];
    const sources =
      malformed === "cause"
        ? ({ 1: [DeathCause.Ability], 3: ["unknown_cause"] } as unknown as DeathSources)
        : { 1: [DeathCause.Ability] };
    const phases =
      malformed === "phase" ? ({ 3: "future_phase" } as unknown as Record<number, Phase>) : {};
    await expect(
      f.resolver().resolve(ids, sources, actionProvider, Phase.Day, Phase.Day, phases),
    ).rejects.toThrow("death_wave_input_invalid");
    expect(f.lives.map((life) => life.alive)).toEqual([true, true, true]);
    expect(f.events).toEqual([]);
  }
});

test("a malformed additional proposal preserves the prior legal wave while preventing partial proposed deaths", async () => {
  const f = fixture(),
    hooks = new HookRegistry(
      [],
      [
        async (_world, ids): Promise<DeathHookResult> =>
          ids.includes(1)
            ? { extraDeaths: [2, Number.NaN], extraDeathSources: { 2: [DeathCause.Ability] } }
            : { extraDeaths: [], extraDeathSources: {} },
      ],
    );
  let committed: DeathCommitReceipt | undefined;
  await expect(
    f.resolver(hooks).resolve(
      [1],
      { 1: [DeathCause.Ability] },
      actionProvider,
      Phase.Day,
      Phase.Day,
      {},
      {
        onInitialWaveCommitted(_ids, _sources, receipt) {
          committed = receipt;
          return { timestamp: 1, type: "additional_deaths", payload: { deaths: [1] } };
        },
      },
    ),
  ).rejects.toThrow("death_wave_input_invalid: ids");
  expect(f.lives.map((life) => life.alive)).toEqual([false, true, true]);
  expect(committed!.committed(1)!.settled.version).toBe(1);
  expect(committed!.publicationLinks()).toHaveLength(1);
});

test("opaque legacy reads are not executed by static preflight and a later target failure keeps the first death prefix", async () => {
  let reads = 0;
  const opaqueIds = new Proxy([1], {
    get(target, key, receiver) {
      reads++;
      return Reflect.get(target, key, receiver);
    },
  });
  const phases = {
    get 1() {
      reads++;
      return Phase.Night;
    },
  };
  preflightDeathWaveData(opaqueIds, { 1: [DeathCause.Ability] }, phases);
  expect(reads).toBe(0);
  const f = fixture(),
    original = f.world.getComponent.bind(f.world);
  f.world.getComponent = ((id: number, component: ComponentName) => {
    if (id === 2 && component === COMPONENT.Alive && f.lives[0]!.alive === false)
      throw Error("test_second_target_failed");
    return original(id, component);
  }) as typeof f.world.getComponent;
  expect(() => f.committer.markPlayersDead([1, 2], false)).toThrow("test_second_target_failed");
  expect(f.lives.map((life) => life.alive)).toEqual([false, true, true]);
  expect(f.committer.isSettledLife(1)).toBe(true);
  expect(aliveLifeVersion(f.lives[0]!)).toBe(1);
});

test("a real poison producer, damage acceptance and resolver commit retain the same cause and original life evidence", async () => {
  const f = fixture(),
    source = captureNightLife(f.world, 1)!,
    target = captureNightLife(f.world, 2)!;
  const claim = originalPoisonIntent(
    { source, target },
    {
      family: "witch",
      stage: "witch",
      day: 2,
      actorLife: source,
      requestedTargetId: 2,
      abilityId: "native:potion",
    },
  );
  const marks = new StatusMarksComponent();
  marks.add(StatusMark.PoisonMark);
  f.world.addComponent(2, COMPONENT.StatusMarks, marks);
  const damage = new DamageResolutionSystem().resolve(f.world, {
    intentNight: 2,
    poisonClaims: [claim],
  });
  expect(damage.deaths).toEqual([2]);
  expect(damage.deathSources).toEqual({ 2: [DeathCause.Poison] });
  expect(f.lives[1]!.alive).toBe(true);
  const routes = damagePoisonRoutes(damage);
  expect(routes).toHaveLength(1);
  expect(routes[0]!.origin).toBe(claim.origin);
  let receipt: DeathCommitReceipt | undefined;
  await f.resolver().resolve(
    damage.deaths,
    damage.deathSources,
    actionProvider,
    Phase.Night,
    Phase.Day,
    {},
    {
      originalLives: new Map([[2, target]]),
      poisonRoutes: routes,
      onInitialWaveCommitted(_ids, _sources, committed) {
        receipt = committed;
        return { timestamp: 3, type: "night_resolved", payload: { deaths: [2] } };
      },
    },
  );
  const entry = receipt!.committed(2)!;
  expect(f.lives[1]!.alive).toBe(false);
  expect(entry.settled.component).toBe(target.life);
  expect(entry.settled.version).toBe(1);
  expect(entry.originalLife).toBe(target);
  expect(entry.originPhase).toBe(Phase.Night);
  expect(entry.poisonRoutes[0]).toBe(routes[0]);
  expect(entry.poisonRoutes[0]!.origin.causeId).toBe(claim.origin.causeId);
  expect(entry.poisonRoutes[0]!.origin.targetBody).toBe(target.life);
  expect(entry.poisonRoutes[0]!.origin.targetVersion).toBe(0);
  expect(receipt!.publicationLinks()[0]!.event.payload).toEqual({ deaths: [2] });
  expect(Object.keys(damage)).toEqual(["deaths", "deathSources"]);
});

test("old same-name metadata getters and effects Proxies are untouched in empty and nonempty real resolver waves", async () => {
  for (const ids of [[], [1]])
    for (const proxy of [false, true]) {
      const f = fixture();
      let reads = 0,
        callbacks = 0;
      const options = {
        get originalLives(): ReadonlyMap<
          number,
          { life: (typeof f.lives)[number]; version: number }
        > {
          reads++;
          throw Error("legacy_unused_original_lives");
        },
        get poisonRoutes(): readonly NightPoisonRoute[] {
          reads++;
          throw Error("legacy_unused_poison_routes");
        },
        onInitialWaveCommitted(
          _ids: readonly number[],
          _sources: DeathSources | undefined,
          receipt: DeathCommitReceipt,
        ): GameEvent {
          callbacks++;
          expect(receipt.wave.originalLives).toBeUndefined();
          expect(receipt.wave.poisonRoutes).toEqual([]);
          return { timestamp: 1, type: "additional_deaths", payload: { deaths: [...ids] } };
        },
      };
      const input = proxy
        ? new Proxy(options, {
            get(target, key, receiver) {
              if (key === "originalLives" || key === "poisonRoutes") {
                reads++;
                throw Error("legacy_unused_effects_metadata");
              }
              return Reflect.get(target, key, receiver);
            },
            getOwnPropertyDescriptor() {
              reads++;
              throw Error("legacy_unused_effects_reflection");
            },
          })
        : options;
      await f
        .resolver()
        .resolve(ids, { 1: [DeathCause.Ability] }, actionProvider, Phase.Day, Phase.Day, {}, input);
      expect(reads).toBe(0);
      expect(callbacks).toBe(1);
      expect(f.lives[0]!.alive).toBe(ids.length === 0);
    }
});

test("custom Map get accessors are not called after ledger writes and opaque map diagnostics remain unknown", () => {
  const f = fixture(),
    captured = { life: f.lives[0]!, version: 0 },
    lives = new Map([[1, captured]]),
    origins = new Map([[1, Phase.Night]]);
  let reads = 0;
  for (const map of [lives, origins])
    Object.defineProperty(map, "get", {
      get() {
        reads++;
        throw Error("legacy_unused_map_get");
      },
    });
  const ids = [1],
    sources: DeathSources = { 1: [DeathCause.Ability] };
  const receipt = f.committer.markPlayersDead(
    ids,
    false,
    [],
    false,
    sources,
    undefined,
    planDeathWave(ids, sources, "initial", origins, lives),
  );
  expect(reads).toBe(0);
  expect(receipt.committed(1)!.originalLife).toBe(captured);
  expect(receipt.committed(1)!.originPhase).toBe(Phase.Night);
  expect(receipt.committed(1)!.settled.version).toBe(1);
  const opaque = new Proxy(lives, {
    get() {
      reads++;
      throw Error("opaque_map_unused");
    },
  });
  const repeated = f.committer.markPlayersDead(
    ids,
    false,
    [],
    false,
    sources,
    undefined,
    planDeathWave(ids, sources, "revisit", undefined, opaque),
  );
  expect(repeated.committed(1)!.originalLife).toBeUndefined();
  expect(repeated.committed(1)!.firstSettlement).toBe(false);
  expect(reads).toBe(0);
});

function readonlyQueries(receipt: DeathCommitReceipt): void {
  const entry = receipt.entries[0]!;
  // @ts-expect-error 查询凭证不开放原 Alive 修改权限。
  entry.settled.component.alive = true;
  // @ts-expect-error 接受路由列表不授予追加库存／因果权。
  entry.poisonRoutes.push({});
  // @ts-expect-error 原生命捕获也是只读，不能借凭证改 World。
  receipt.wave.originalLives!.get(1)!.life.alive = true;
}
void readonlyQueries;
