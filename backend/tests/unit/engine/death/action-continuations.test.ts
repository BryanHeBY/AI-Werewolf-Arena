/**
 * 单元测试验证具名死亡动作继续点的真实引擎顺序与失败前缀。
 * 输入为独立内存生命、手写死亡提案与可信／公开回调；字面轨迹和生命布尔值是人工预期。
 * 不推进完整对局、不运行模型；继续项不允许携带 World 或取得引擎提交函数。
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
import {
  HookRegistry,
  type DeathHook,
  type DeathHookResult,
} from "../../../../src/engine/hooks/registry";
import { ownDeathHook, type OwnedDeathCommands } from "../../../../src/engine/hooks/owned-bindings";
import { setHunterState } from "../../../../src/features/hunter/ports";
import type { ActionProvider } from "../../../../src/domain/actions";
import {
  createDeathActionContinuation,
  hasDeathActionContinuation,
  queueDeathActionContinuations,
  resumeDeathActionContinuation,
  type DeathActionContinuation,
} from "../../../../src/engine/hooks/death-action-continuation";

function result(
  ids: number[] = [],
  continuations?: readonly DeathActionContinuation[],
): DeathHookResult {
  return {
    extraDeaths: ids,
    extraDeathSources: Object.fromEntries(ids.map((id) => [id, [DeathCause.Shot]])),
    ...(continuations ? { deathActionContinuations: continuations } : {}),
  };
}

function fixture(hook: DeathHook, provider?: ActionProvider) {
  const world = new World("en"),
    events: GameEvent[] = [];
  const lives = Array.from({ length: 6 }, () => {
    const id = world.createEntity(),
      life = createAliveComponent();
    world.addComponent(id, COMPONENT.Alive, life);
    world.addComponent(id, COMPONENT.Role, createRoleComponent(Role.Villager));
    world.addComponent(id, COMPONENT.Camp, { camp: Camp.Good });
    return life;
  });
  const resolver = new DeathResolution(
    world,
    events,
    new ToolGateway(),
    new EventRegistry(new HookRegistry([], [hook])),
    { day: 2, phase: Phase.Day, gameOver: false, result: null },
  );
  return {
    world,
    lives,
    events,
    resolve: (ids = [1], originPhase = Phase.Day) =>
      resolver.resolve(
        ids,
        Object.fromEntries(ids.map((id) => [id, [DeathCause.Exile]])),
        provider ?? {
          async getAction() {
            return { name: "speak", args: { text: "literal words" } };
          },
        },
        Phase.Day,
        Phase.Day,
        Object.fromEntries(ids.map((id) => [id, originPhase])),
      ),
  };
}

test("death continuation token is opaque, queued once, consumed before a failed program and cannot be replayed", async () => {
  const failure = new Error("literal_continue_failed");
  let calls = 0;
  const token = createDeathActionContinuation(async () => {
    calls++;
    throw failure;
  });
  expect(Object.keys(token)).toEqual(["kind"]);
  expect(Object.isFrozen(token)).toBe(true);
  expect(hasDeathActionContinuation({ ...token })).toBe(false);
  expect(() => queueDeathActionContinuations([token, token])).toThrow(
    "death_action_continuation_invalid",
  );
  expect(hasDeathActionContinuation(token)).toBe(true);
  expect(queueDeathActionContinuations([token])).toEqual([token]);
  expect(() => queueDeathActionContinuations([token])).toThrow("death_action_continuation_invalid");
  expect(await resumeDeathActionContinuation(token).catch((error) => error)).toBe(failure);
  expect(await resumeDeathActionContinuation(token).catch((error) => error)).toEqual(
    new Error("death_action_continuation_invalid"),
  );
  expect(calls).toBe(1);
});

test.each([false, true])(
  "real chooser closes first permit before resume; second failure=%s retains source phase and closes its new permit",
  async (failSecond) => {
    let f: ReturnType<typeof fixture>;
    const ids: number[] = [],
      failure = new Error("literal_real_second_provider_failed");
    const hook = ownDeathHook<OwnedDeathCommands>(
      (runtime, dead, sources, _choose, context) => runtime.ports.resolve(dead, sources, context),
      (source) => ({
        async resolve(dead) {
          if (dead[0] !== 1) return result();
          const first = await source.chooseDeathShot(1);
          expect(first.kind).toBe("shot");
          if (first.kind !== "shot") throw new Error("literal_expected_first_shot");
          expect(source.world.hasDeathAction(1, "shoot", Phase.Day, 2, first.deathActionId)).toBe(
            true,
          );
          return result(
            [first.targetId],
            [
              createDeathActionContinuation(async () => {
                expect(source.world.activeDeathActionCount).toBe(0);
                expect(
                  source.world.hasDeathAction(1, "shoot", Phase.Day, 2, first.deathActionId),
                ).toBe(false);
                expect(f.lives[1]!.alive).toBe(false);
                const second = await source.chooseDeathShot(1);
                if (second.kind !== "shot") throw new Error("literal_expected_second_shot");
                return result([second.targetId]);
              }),
            ],
          );
        },
      }),
    );
    f = fixture(hook, {
      async getAction(request) {
        if (!request.allowedTools.includes("shoot"))
          return { name: "speak", args: { text: "literal words" } };
        expect(request.phase).toBe(Phase.Day);
        expect(request.context.day).toBe(2);
        expect(request.context.death_phase).toBe(Phase.Night);
        expect(request.context.death_sources).toEqual([DeathCause.Exile]);
        ids.push(request.context.death_action_id!);
        expect(f.world.activeDeathActionCount).toBe(1);
        if (ids.length === 2 && failSecond) throw failure;
        return { name: "shoot", args: { target_id: ids.length === 1 ? 2 : 3 } };
      },
    });
    const actor = createRoleComponent(Role.Hunter);
    // 同一原生库存只用来驱动真实 collector；此引擎时序测试不复制或添加第二库存。
    setHunterState(actor, { canShoot: true });
    f.world.addComponent(1, COMPONENT.Role, actor);
    const failed = await f.resolve([1], Phase.Night).then(
      () => undefined,
      (error) => error,
    );
    expect(failed).toBe(failSecond ? failure : undefined);
    expect(ids).toHaveLength(2);
    expect(ids[1]).not.toBe(ids[0]);
    expect(f.lives[1]!.alive).toBe(false);
    expect(f.lives[2]!.alive).toBe(failSecond);
    expect(f.world.activeDeathActionCount).toBe(0);
  },
);

test("real death waves finish descendants before parent continuation and retain sibling actor order", async () => {
  const trace: string[] = [];
  let f: ReturnType<typeof fixture>;
  const hook = ownDeathHook(
    async (_runtime, ids) => {
      const id = ids[0]!;
      trace.push(`hook:${id}`);
      if (id === 1)
        return result(
          [2],
          [
            createDeathActionContinuation(async () => {
              trace.push("resume:1");
              expect(f.lives[1]!.alive).toBe(false);
              expect(f.lives[2]!.alive).toBe(false);
              return result(
                [4],
                [
                  createDeathActionContinuation(async () => {
                    trace.push("resume:1b");
                    return result();
                  }),
                ],
              );
            }),
          ],
        );
      if (id === 2)
        return result(
          [3],
          [
            createDeathActionContinuation(async () => {
              trace.push("resume:2");
              return result();
            }),
          ],
        );
      if (id === 5)
        return result(
          [],
          [
            createDeathActionContinuation(async () => {
              trace.push("resume:5");
              return result();
            }),
          ],
        );
      return result();
    },
    () => ({}),
  );
  f = fixture(hook);
  await f.resolve([1, 5]);
  expect(trace).toEqual([
    "hook:1",
    "hook:5",
    "hook:2",
    "hook:3",
    "resume:2",
    "resume:1",
    "hook:4",
    "resume:1b",
    "resume:5",
  ]);
  expect(f.lives.map((life) => life.alive)).toEqual([false, false, false, false, false, true]);
  expect(f.world.activeDeathActionCount).toBe(0);
});

test("second-action error preserves the first true death and complete first death hook prefix", async () => {
  const trace: number[] = [],
    failure = new Error("literal_second_request_failed");
  const hook = ownDeathHook(
    async (_runtime, ids) => {
      trace.push(ids[0]!);
      return ids[0] === 1
        ? result(
            [2],
            [
              createDeathActionContinuation(async () => {
                throw failure;
              }),
            ],
          )
        : result();
    },
    () => ({}),
  );
  const f = fixture(hook);
  expect(await f.resolve().catch((error) => error)).toBe(failure);
  expect(trace).toEqual([1, 2]);
  expect(f.lives.map((life) => life.alive)).toEqual([false, false, true, true, true, true]);
});

test.each(["duplicate", "forged"] as const)(
  "bad %s continued token rejects before that result writes target life",
  async (mode) => {
    const good = createDeathActionContinuation(async () => result());
    const bad =
      mode === "duplicate"
        ? [good, good]
        : [{ kind: "death_action_continuation" } as DeathActionContinuation];
    const hook = ownDeathHook(
      async (_runtime, ids) =>
        ids[0] === 1
          ? result([2], [createDeathActionContinuation(async () => result([3], bad))])
          : result(),
      () => ({}),
    );
    const f = fixture(hook);
    expect(await f.resolve().catch((error) => error)).toEqual(
      new Error("death_action_continuation_invalid"),
    );
    expect(f.lives.map((life) => life.alive)).toEqual([false, false, true, true, true, true]);
  },
);

test("duplicate initial token and public hook token both reject before their proposed death", async () => {
  const token = createDeathActionContinuation(async () => result());
  for (const trusted of [true, false]) {
    const callback: DeathHook = async () => result([2], trusted ? [token, token] : [token]);
    const f = fixture(trusted ? ownDeathHook(callback, () => ({})) : callback);
    expect(await f.resolve().catch((error) => error)).toEqual(
      new Error(
        trusted ? "death_action_continuation_invalid" : "death_action_continuation_unowned_hook",
      ),
    );
    expect(f.lives[0]!.alive).toBe(false);
    expect(f.lives[1]!.alive).toBe(true);
  }
});

test("ordinary hook result retains prototype getters, original identity and commit-before-aggregation reads", async () => {
  const trace: string[] = [];
  class Proposal {
    get extraDeaths() {
      expect<Proposal>(this).toBe(proposal);
      trace.push("deaths");
      return [2];
    }
    get extraDeathSources() {
      expect<Proposal>(this).toBe(proposal);
      trace.push("sources");
      return { 2: [DeathCause.Shot] };
    }
  }
  const proposal = new Proposal(),
    hook: DeathHook = async () => proposal;
  const f = fixture(hook);
  await new HookRegistry([], [hook]).onDeath(
    f.world,
    [1],
    { 1: [DeathCause.Exile] },
    async () => ({ kind: "invalid" }),
    f.events,
    (received) => {
      expect(received).toBe(proposal);
      trace.push("commit");
      expect(received.extraDeaths).toEqual([2]);
    },
  );
  expect(trace).toEqual(["commit", "deaths", "deaths", "sources"]);
});
