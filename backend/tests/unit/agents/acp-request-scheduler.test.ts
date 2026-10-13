/**
 * 单元测试验证 acp-request-scheduler 的既有传输、回合与显式特权回退边界。输入为原假客户端、请求、取消／期限和回调控制；预期来自原手写动作、引用、记录与拒绝断言。特权 provider 保留原请求及测试状态控制，不进入默认生产观察策略。
 */
import { expect, test } from "bun:test";
import { bootstrapGame } from "../../../src/app/bootstrap";
import { sixPlayerMvpConfig } from "../../../src/runtime/scenarios/six_player_mvp";
import { AcpActionProvider } from "../../../src/ai/agents/acp/acp_action_provider";
import { Phase, type ActionRequest } from "../../../src/core";

function request(actorId: number, deadlineAtMs?: number): ActionRequest {
  return {
    actorId,
    phase: Phase.Day,
    allowedTools: ["speak"],
    deadlineAtMs,
    context: {
      day: 1,
      stage: "day_speech",
      visible_events: [],
      turn_constraints: { min_valid_actions: 1, max_valid_actions: 1 },
    },
  };
}

test("ACP provider queue limits initialization and prompts together, and expired waiters start no factory", async () => {
  const game = bootstrapGame(sixPlayerMvpConfig, { locale: "en" });
  let release!: () => void,
    ready!: () => void,
    factories = 0;
  const held = new Promise<void>((done) => {
      release = done;
    }),
    begun = new Promise<void>((done) => {
      ready = done;
    });
  const provider = new AcpActionProvider(game.world, {
    maxConcurrentRequests: 1,
    turnTimeoutMs: 1000,
    sessionFactory: {
      async createSession(input) {
        factories++;
        const key = `actor-${input.actorId}`;
        return {
          sessionId: key,
          async cancel() {},
          async close() {},
          async prompt(text) {
            ready();
            await held;
            const turn = /Current turn ID: (t\d+)/.exec(text)![1];
            input.registry.submitAction(key, {
              turn_id: turn,
              action: "speak",
              arguments: { text: key },
            });
          },
        };
      },
    },
    privilegedFallbackProvider: {
      async getAction() {
        return null;
      },
    },
  });
  const first = provider.getAction(request(1));
  await begun;
  const expired = await provider.getAction(request(2, Date.now() + 30));
  expect(expired).toBeNull();
  expect(factories).toBe(1);
  expect(provider.runtimeState.scheduler).toEqual({ closed: false, active: 1, queued: 0 });
  const next = provider.getAction(request(3));
  await Promise.resolve();
  expect(factories).toBe(1);
  expect(provider.runtimeState.scheduler.queued).toBe(1);
  release();
  expect(await first).toEqual({ name: "speak", args: { text: "actor-1" } });
  expect(await next).toEqual({ name: "speak", args: { text: "actor-3" } });
  expect(factories).toBe(2);
  await provider.close();
  expect(provider.runtimeState.scheduler).toEqual({ closed: true, active: 0, queued: 0 });
});

test("ACP lease stays occupied until forced retirement actually settles", async () => {
  const game = bootstrapGame(sixPlayerMvpConfig, { locale: "en" });
  let forced!: () => void,
    releaseForce!: () => void,
    factories = 0;
  const began = new Promise<void>((done) => {
      forced = done;
    }),
    cleanup = new Promise<void>((done) => {
      releaseForce = done;
    });
  const provider = new AcpActionProvider(game.world, {
    maxConcurrentRequests: 1,
    turnTimeoutMs: 2000,
    sessionFactory: {
      async createSession(input) {
        factories++;
        const key = `actor-${input.actorId}`;
        return {
          sessionId: key,
          async cancel() {},
          async close(options) {
            if (input.actorId === 1 && options?.force) {
              forced();
              await cleanup;
            }
          },
          async prompt(text) {
            const turn = /Current turn ID: (t\d+)/.exec(text)![1];
            input.registry.submitAction(key, {
              turn_id: turn,
              action: "speak",
              arguments: { text: key },
            });
            if (input.actorId === 1) await new Promise<never>(() => {});
          },
        };
      },
    },
    privilegedFallbackProvider: {
      async getAction() {
        return null;
      },
    },
  });
  const first = provider.getAction(request(1, Date.now() + 60)),
    second = provider.getAction(request(2));
  await began;
  expect(factories).toBe(1);
  expect(provider.runtimeState.scheduler).toEqual({ closed: false, active: 1, queued: 1 });
  releaseForce();
  expect(await first).toBeNull();
  expect(await second).toEqual({ name: "speak", args: { text: "actor-2" } });
  expect(factories).toBe(2);
  await provider.close();
  expect(provider.runtimeState.scheduler.active).toBe(0);
});

test("ACP close removes provider waiters without starting them or choosing fallback", async () => {
  const game = bootstrapGame(sixPlayerMvpConfig, { locale: "en" });
  let ready!: () => void,
    factories = 0,
    fallbacks = 0;
  const begun = new Promise<void>((done) => {
    ready = done;
  });
  const provider = new AcpActionProvider(game.world, {
    maxConcurrentRequests: 1,
    turnTimeoutMs: 1000,
    sessionFactory: {
      async createSession(input) {
        factories++;
        return {
          sessionId: `actor-${input.actorId}`,
          async cancel() {},
          async close() {},
          async prompt() {
            ready();
            await new Promise<never>(() => {});
          },
        };
      },
    },
    privilegedFallbackProvider: {
      async getAction() {
        fallbacks++;
        return null;
      },
    },
  });
  const first = provider.getAction(request(1));
  await begun;
  const second = provider.getAction(request(2));
  await Promise.resolve();
  await provider.close();
  expect(await Promise.all([first, second])).toEqual([null, null]);
  expect(factories).toBe(1);
  expect(fallbacks).toBe(0);
  expect(provider.runtimeState.scheduler).toEqual({ closed: true, active: 0, queued: 0 });
});

test("unproven initialization reclamation blocks this provider's waiting factories", async () => {
  const game = bootstrapGame(sixPlayerMvpConfig, { locale: "en" });
  let resolve!: (value: any) => void,
    ready!: () => void,
    factories = 0;
  const created = new Promise<any>((done) => {
      resolve = done;
    }),
    began = new Promise<void>((done) => {
      ready = done;
    });
  const provider = new AcpActionProvider(game.world, {
    maxConcurrentRequests: 1,
    turnTimeoutMs: 10000,
    sessionFactory: {
      createSession() {
        factories++;
        ready();
        return created;
      },
    },
    privilegedFallbackProvider: {
      async getAction() {
        return null;
      },
    },
  });
  const first = provider.getAction(request(1, Date.now() + 20));
  await began;
  const second = provider.getAction(request(2)).then(
    (value) => value,
    (error) => error,
  );
  expect(await first).toBeNull();
  expect((await second).message).toBe("acp_resource_reclamation_failed");
  expect(factories).toBe(1);
  expect(provider.runtimeState.pool.creating).toBe(1);
  expect(provider.runtimeState.scheduler.closed).toBe(true);
  await expect(provider.getAction(request(3))).rejects.toThrow("acp_resource_reclamation_failed");
  resolve({ sessionId: "late", async prompt() {}, async cancel() {}, async close() {} });
  const failed = await provider.close().then(
    () => null,
    (error) => error,
  );
  expect(failed).toBeInstanceOf(AggregateError);
  expect(provider.runtimeState.pool.creating).toBe(0);
}, 15000);
