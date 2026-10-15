/**
 * 单元测试验证 acp-session-ownership 的既有传输、回合与显式特权回退边界。输入为原假客户端、请求、取消／期限和回调控制；预期来自原手写动作、引用、记录与拒绝断言。特权 provider 保留原请求及测试状态控制，不进入默认生产观察策略。
 */
import { expect, test, spyOn } from "bun:test";
import { AcpSessionPool } from "../../../src/agents/acp/session-pool";
import { closeAcpSession } from "../../../src/adapters/acp/session-lifecycle";
import { TurnDeadlineElapsed } from "../../../src/agents/runtime/turn-deadline";
import { AcpActionProvider } from "../../../src/agents/acp/acp-action-provider";
import { AcpTurnRegistry } from "../../../src/adapters/acp/acp-turn-registry";
import type { AcpSession, AcpSessionCreateInput } from "../../../src/adapters/acp/session";
import { bootstrapGame } from "../../../src/app/bootstrap";
import { sixPlayerMvpConfig } from "../../../src/rulesets/presets/six-player-mvp";
import { Phase, type ActionRequest, type ToolCall } from "../../../src/domain";

function request(): ActionRequest {
  return {
    actorId: 1,
    phase: Phase.Day,
    allowedTools: ["speak"],
    context: {
      day: 1,
      stage: "day_speech",
      visible_events: [],
      turn_constraints: { min_valid_actions: 1, max_valid_actions: 1 },
    },
  };
}
function session(close: AcpSession["close"]): AcpSession {
  return { sessionId: "synthetic", async prompt() {}, async cancel() {}, close };
}
const world = () => bootstrapGame(sixPlayerMvpConfig, { locale: "en" }).world;

test("graceful and forced close errors retain their identities; force still runs after timeout", async () => {
  const first = new Error("first-close"),
    second = new Error("forced-close"),
    calls: boolean[] = [];
  const broken = session(async (options) => {
    calls.push(options?.force ?? false);
    throw options?.force ? second : first;
  });
  const failure = await closeAcpSession(broken, false, 30).then(
    () => null,
    (error) => error,
  );
  expect(failure).toBeInstanceOf(AggregateError);
  expect(failure.errors).toEqual([first, second]);
  expect(calls).toEqual([false, true]);
  let forced = false;
  const hung = session(async (options) => {
    if (options?.force) {
      forced = true;
      return;
    }
    await new Promise<never>(() => {});
  });
  await expect(closeAcpSession(hung, false, 20)).rejects.toBeInstanceOf(TurnDeadlineElapsed);
  expect(forced).toBe(true);
});

test("pool owns discarded close failures and late sessions, and cannot reopen after close", async () => {
  const pool = new AcpSessionPool(() => {}, 50),
    registry = new AcpTurnRegistry(world());
  let resolve!: (value: AcpSession) => void,
    closed = 0;
  const created = new Promise<AcpSession>((done) => {
    resolve = done;
  });
  const pending = pool.getOrCreate(1, Date.now() + 20, () => ({
    factory: { createSession: () => created },
    input: { actorId: 1, registry },
  }));
  await expect(pending).rejects.toThrow("acp_initialize_timeout");
  resolve(
    session(async () => {
      closed++;
    }),
  );
  await pool.close();
  expect(closed).toBe(1);
  expect(pool.snapshot).toEqual({ closed: true, sessions: 0, creating: 0, retiring: 0 });
  await expect(
    pool.getOrCreate(1, Date.now() + 100, () => {
      throw new Error("must_not_prepare");
    }),
  ).rejects.toThrow("acp_provider_closed");
  const original = new Error("discarded-close-failed"),
    discarded = new AcpSessionPool(() => {}, 50);
  await discarded.getOrCreate(1, Date.now() + 100, () => ({
    factory: {
      async createSession() {
        return session(async () => {
          throw original;
        });
      },
    },
    input: { actorId: 1, registry },
  }));
  discarded.discard(1);
  const failed = await discarded.close().then(
    () => null,
    (error) => error,
  );
  expect(failed.errors).toEqual([original]);
  expect(discarded.snapshot.retiring).toBe(0);
  registry.close();
});

test("a non-cooperative creation is reported as incomplete cleanup, and its eventual session is reclaimed", async () => {
  const pool = new AcpSessionPool(() => {}, 20),
    registry = new AcpTurnRegistry(world());
  let resolve!: (value: AcpSession) => void,
    forced = 0,
    ready!: () => void;
  const began = new Promise<void>((done) => {
    ready = done;
  });
  const created = new Promise<AcpSession>((done) => {
    resolve = done;
  });
  const turn = pool
    .getOrCreate(1, Date.now() + 1000, () => ({
      factory: {
        createSession() {
          ready();
          return created;
        },
      },
      input: { actorId: 1, registry },
    }))
    .then(
      () => null,
      (error) => error,
    );
  await began;
  const failed = await pool.close().then(
    () => null,
    (error) => error,
  );
  expect(failed).toBeInstanceOf(AggregateError);
  expect(failed.errors[0]).toBeInstanceOf(TurnDeadlineElapsed);
  expect(pool.snapshot.creating).toBe(1);
  expect((await turn).message).toBe("acp_provider_closed");
  resolve(
    session(async (options) => {
      if (options?.force) forced++;
    }),
  );
  await pool.close();
  expect(forced).toBe(1);
  expect(pool.snapshot.creating).toBe(0);
  registry.close();
});

test("ACP close cancels open prompt without fallback and permanently seals its registry", async () => {
  let input!: AcpSessionCreateInput,
    ready!: () => void,
    fallbacks = 0;
  const started = new Promise<void>((done) => {
    ready = done;
  });
  const provider = new AcpActionProvider(world(), {
    turnTimeoutMs: 1000,
    sessionFactory: {
      async createSession(value) {
        input = value;
        return {
          ...session(async () => {}),
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
  const pending = provider.getAction(request());
  await started;
  await provider.close();
  expect(await pending).toBeNull();
  expect(fallbacks).toBe(0);
  expect(provider.runtimeState).toEqual({
    closed: true,
    turns: 0,
    registry: { closed: true, pending: 0 },
    pool: { closed: true, sessions: 0, creating: 0, retiring: 0 },
    scheduler: { closed: true, active: 0, queued: 0 },
  });
  expect(
    input.registry.submitAction("synthetic", {
      turn_id: "t1",
      action: "speak",
      arguments: { text: "late" },
    }),
  ).toMatchObject({ ok: false, error: "turn_not_open_or_session_invalid" });
  expect(() => input.registry.openTurn(request(), "synthetic")).toThrow("acp_registry_closed");
  await expect(provider.getAction(request())).rejects.toThrow("acp_provider_closed");
});

for (const late of ["resolve", "reject"] as const)
  test(`ACP close cancels hung fallback and ignores late ${late}`, async () => {
    let ready!: () => void,
      resolve!: (value: ToolCall | null) => void,
      reject!: (error: unknown) => void;
    const began = new Promise<void>((done) => {
      ready = done;
    });
    const fallback = new Promise<ToolCall | null>((done, fail) => {
      resolve = done;
      reject = fail;
    });
    let calls = 0;
    const provider = new AcpActionProvider(world(), {
      turnTimeoutMs: 1000,
      sessionFactory: {
        async createSession() {
          throw new Error("model-failed");
        },
      },
      privilegedFallbackProvider: {
        getAction() {
          calls++;
          ready();
          return fallback;
        },
      },
    });
    const log = spyOn(console, "log").mockImplementation(() => {});
    try {
      const pending = provider.getAction(request());
      await began;
      await provider.close();
      expect(await pending).toBeNull();
      expect(calls).toBe(1);
      if (late === "resolve") resolve({ name: "speak", args: { text: "late" } });
      else reject(new Error("late-fallback"));
      await Bun.sleep(0);
      expect(provider.runtimeState.turns).toBe(0);
      expect(log.mock.calls).toHaveLength(0);
    } finally {
      log.mockRestore();
      await provider.close();
    }
  });

test("accepted ACP action survives cancellation failure, while final close retains the original cleanup error", async () => {
  const original = new Error("cancel-failed");
  let forced = false;
  const provider = new AcpActionProvider(world(), {
    turnTimeoutMs: 1000,
    sessionFactory: {
      async createSession(input) {
        return {
          ...session(async (options) => {
            forced = options?.force ?? false;
          }),
          async cancel() {
            throw original;
          },
          async prompt(text) {
            const turn = /Current turn ID: (t\d+)/.exec(text)![1];
            input.registry.submitAction("synthetic", {
              turn_id: turn,
              action: "speak",
              arguments: { text: "selected" },
            });
          },
        };
      },
    },
    privilegedFallbackProvider: {
      async getAction() {
        throw new Error("unexpected_fallback");
      },
    },
  });
  expect(await provider.getAction(request())).toEqual({
    name: "speak",
    args: { text: "selected" },
  });
  const failed = await provider.close().then(
    () => null,
    (error) => error,
  );
  expect(forced).toBe(true);
  expect(failed.errors[0].errors).toEqual([original]);
  expect(provider.runtimeState.pool.retiring).toBe(0);
});

test("takeAuditTrace closing the provider suppresses private recording of the selected action", async () => {
  const { PlayerRoundRecorder } = await import("../../../src/app/player-round-recorder");
  const record = spyOn(PlayerRoundRecorder.prototype, "record").mockImplementation(() => {});
  let closing: Promise<void> | undefined;
  const provider = new AcpActionProvider(world(), {
    turnTimeoutMs: 1000,
    sessionFactory: {
      async createSession(input) {
        return {
          ...session(async () => {}),
          async prompt(text) {
            const turn = /Current turn ID: (t\d+)/.exec(text)![1];
            input.registry.submitAction("synthetic", {
              turn_id: turn,
              action: "speak",
              arguments: { text: "selected" },
            });
          },
          takeAuditTrace() {
            closing ??= provider.close();
            return { thoughts: [], messages: [] };
          },
        };
      },
    },
  });
  try {
    expect(await provider.getAction(request())).toBeNull();
    await closing;
    expect(record).not.toHaveBeenCalled();
    expect(provider.runtimeState.turns).toBe(0);
  } finally {
    record.mockRestore();
    await provider.close();
  }
});

test("reentrant close during initial prompt preparation starts no factory and waits for the registered turn", async () => {
  let created = 0,
    closing: Promise<void> | undefined;
  const provider = new AcpActionProvider(world(), {
    turnTimeoutMs: 1000,
    personalityPromptResolver() {
      closing ??= provider.close();
      return "synthetic";
    },
    sessionFactory: {
      async createSession() {
        created++;
        return session(async () => {});
      },
    },
  });
  expect(await provider.getAction(request())).toBeNull();
  await closing;
  expect(created).toBe(0);
  expect(provider.runtimeState.turns).toBe(0);
});

test("whole-turn and cancellation deadline expiry both force retirement without inventing cleanup failures", async () => {
  for (const budget of [...Array(12).fill(30), 1000]) {
    let forced = 0;
    const provider = new AcpActionProvider(world(), {
      turnTimeoutMs: budget,
      sessionFactory: {
        async createSession(input) {
          return {
            ...session(async (options) => {
              if (options?.force) forced++;
            }),
            async cancel() {
              await new Promise<never>(() => {});
            },
            async prompt(text) {
              const turn = /Current turn ID: (t\d+)/.exec(text)![1];
              input.registry.submitAction("synthetic", {
                turn_id: turn,
                action: "speak",
                arguments: { text: "selected" },
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
    const action = await provider.getAction(request());
    expect(action).toEqual(budget === 1000 ? { name: "speak", args: { text: "selected" } } : null);
    await provider.close();
    expect(forced).toBe(1);
    expect(provider.runtimeState).toEqual({
      closed: true,
      turns: 0,
      registry: { closed: true, pending: 0 },
      pool: { closed: true, sessions: 0, creating: 0, retiring: 0 },
      scheduler: { closed: true, active: 0, queued: 0 },
    });
  }
});
