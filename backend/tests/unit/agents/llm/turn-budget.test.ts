/**
 * 单元测试验证 turn-budget 的既有传输、回合与显式特权回退边界。输入为原假客户端、请求、取消／期限和回调控制；预期来自原手写动作、引用、记录与拒绝断言。特权 provider 保留原请求及测试状态控制，不进入默认生产观察策略。
 */
import { expect, spyOn, test } from "bun:test";
import { bootstrapGame } from "../../../../src/app/bootstrap";
import { sixPlayerMvpConfig } from "../../../../src/rulesets/presets/six-player-mvp";
import { LlmActionProvider } from "../../../../src/agents/llm/llm-action-provider";
import { Phase, type ActionRequest, type ToolCall } from "../../../../src/domain";

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

function submission(messages: Array<{ content: string }>, text = "accepted") {
  return {
    id: "synthetic",
    name: "submit_action",
    rawArgs: "{}",
    args: {
      turn_id: messages.at(-1)!.content.match(/turn_id must be (t\d+)/)![1],
      action: "speak",
      arguments: { text },
    },
  };
}

test("queue time belongs to the turn deadline: expired waiter is removed and never starts a model request", async () => {
  const game = bootstrapGame(sixPlayerMvpConfig, { locale: "en" });
  let started = 0,
    ready!: () => void,
    release!: () => void;
  const began = new Promise<void>((resolve) => {
    ready = resolve;
  });
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  const fallback: number[] = [];
  const client = {
    chat: async () => "",
    async runToolLoop<T>(messages: any, _tools: any, callbacks: any) {
      started++;
      ready();
      await held;
      const action = await callbacks.onToolCall(submission(messages));
      return { finalAction: action.finalAction as T, assistantText: "" };
    },
  };
  const provider = new LlmActionProvider(game.world, client, {
    llmTimeoutMs: 1000,
    maxConcurrentRequests: 1,
    privilegedFallbackProvider: {
      async getAction(req) {
        fallback.push(req.actorId);
        return null;
      },
    },
  });
  const first = provider.getAction(request(1));
  await began;
  try {
    const second = await provider.getAction(request(2, Date.now() + 30));
    expect(second).toBeNull();
    expect(started).toBe(1);
    expect(fallback).toEqual([]);
    expect(provider.runtimeState.scheduler).toEqual({ closed: false, active: 1, queued: 0 });
  } finally {
    release();
  }
  expect(await first).toEqual({ name: "speak", args: { text: "accepted" } });
  await provider.close();
  expect(provider.runtimeState).toEqual({
    closed: true,
    turns: 0,
    scheduler: { closed: true, active: 0, queued: 0 },
  });
});

test("required-action retries share one budget instead of resetting timeout for each attempt", async () => {
  const game = bootstrapGame(sixPlayerMvpConfig, { locale: "en" });
  let attempts = 0,
    fallbacks = 0;
  const client = {
    chat: async () => "",
    async runToolLoop<T>() {
      attempts++;
      await Bun.sleep(40);
      return { finalAction: null as T | null, assistantText: "no action" };
    },
  };
  const provider = new LlmActionProvider(game.world, client, {
    llmTimeoutMs: 70,
    privilegedFallbackProvider: {
      async getAction() {
        fallbacks++;
        return null;
      },
    },
  });
  expect(await provider.getAction(request(1))).toBeNull();
  expect(attempts).toBeGreaterThanOrEqual(1);
  expect(attempts).toBeLessThanOrEqual(2);
  expect(fallbacks).toBe(0);
  expect(provider.runtimeState.turns).toBe(0);
  await provider.close();
});

test("provider close aborts active and queued turns without fallback, waits for owners, and rejects future work", async () => {
  const game = bootstrapGame(sixPlayerMvpConfig, { locale: "en" });
  let began!: () => void,
    lateCallback: any,
    started = 0,
    fallbacks = 0;
  const ready = new Promise<void>((resolve) => {
    began = resolve;
  });
  const client = {
    chat: async () => "",
    async runToolLoop<T>(_messages: any, _tools: any, callbacks: any) {
      started++;
      lateCallback = callbacks.onToolCall;
      began();
      return new Promise<never>(() => {});
    },
  };
  const provider = new LlmActionProvider(game.world, client, {
    llmTimeoutMs: 5000,
    maxConcurrentRequests: 1,
    privilegedFallbackProvider: {
      async getAction() {
        fallbacks++;
        return null;
      },
    },
  });
  const first = provider.getAction(request(1));
  await ready;
  const second = provider.getAction(request(2));
  await Promise.resolve();
  expect(provider.runtimeState.scheduler.queued).toBe(1);
  await provider.close();
  expect(await Promise.all([first, second])).toEqual([null, null]);
  expect(fallbacks).toBe(0);
  expect(started).toBe(1);
  expect(provider.runtimeState).toEqual({
    closed: true,
    turns: 0,
    scheduler: { closed: true, active: 0, queued: 0 },
  });
  await expect(provider.getAction(request(3))).rejects.toThrow("llm_provider_closed");
  expect(
    (
      await lateCallback({
        id: "late",
        name: "submit_action",
        rawArgs: "{}",
        args: { turn_id: "t1", action: "speak", arguments: { text: "late" } },
      })
    ).toolResult,
  ).toMatchObject({ ok: false, error: "turn_not_open_or_session_invalid" });
  await provider.close();
});

for (const outcome of ["resolve", "reject"] as const)
  test(`close cancels hung fallback; late ${outcome} has no action or fallback logs`, async () => {
    const game = bootstrapGame(sixPlayerMvpConfig, { locale: "en" });
    let ready!: () => void,
      resolve!: (action: ToolCall | null) => void,
      reject!: (error: unknown) => void;
    const begun = new Promise<void>((done) => {
      ready = done;
    });
    const delayed = new Promise<ToolCall | null>((done, fail) => {
      resolve = done;
      reject = fail;
    });
    let calls = 0;
    const client = {
      chat: async () => "",
      async runToolLoop<T>(): Promise<{ finalAction: T | null; assistantText: string }> {
        throw new Error("synthetic_model_error");
      },
    };
    const provider = new LlmActionProvider(game.world, client, {
      llmTimeoutMs: 5000,
      privilegedFallbackProvider: {
        getAction() {
          calls++;
          ready();
          return delayed;
        },
      },
    });
    const log = spyOn(console, "log").mockImplementation(() => {});
    try {
      const action = provider.getAction(request(1));
      await begun;
      await provider.close();
      expect(await action).toBeNull();
      expect(calls).toBe(1);
      expect(provider.runtimeState).toEqual({
        closed: true,
        turns: 0,
        scheduler: { closed: true, active: 0, queued: 0 },
      });
      if (outcome === "resolve") resolve({ name: "speak", args: { text: "late fallback" } });
      else reject(new Error("late fallback rejection"));
      await Bun.sleep(0);
      expect(log.mock.calls.some((args) => String(args[0]).startsWith("[LLM_FALLBACK]"))).toBe(
        false,
      );
    } finally {
      log.mockRestore();
      await provider.close();
    }
  });

test("hanging asynchronous fallback uses the remaining turn deadline and a real fallback failure propagates once", async () => {
  const game = bootstrapGame(sixPlayerMvpConfig, { locale: "en" });
  const client = {
    chat: async () => "",
    async runToolLoop<T>(): Promise<{ finalAction: T | null; assistantText: string }> {
      throw new Error("synthetic_model_error");
    },
  };
  let calls = 0;
  const provider = new LlmActionProvider(game.world, client, {
    llmTimeoutMs: 30,
    privilegedFallbackProvider: {
      getAction() {
        calls++;
        return new Promise<never>(() => {});
      },
    },
  });
  expect(await provider.getAction(request(1))).toBeNull();
  expect(calls).toBe(1);
  expect(provider.runtimeState.scheduler).toEqual({ closed: false, active: 0, queued: 0 });
  await provider.close();
  const original = new Error("synthetic_fallback_failure");
  let failedCalls = 0;
  const failure = new LlmActionProvider(game.world, client, {
    llmTimeoutMs: 1000,
    privilegedFallbackProvider: {
      async getAction() {
        failedCalls++;
        throw original;
      },
    },
  });
  await expect(failure.getAction(request(1))).rejects.toBe(original);
  expect(failedCalls).toBe(1);
  expect(failure.runtimeState.scheduler.active).toBe(0);
  await failure.close();
});

for (const kind of ["TimeoutError", "AbortError"] as const)
  test(`an injected fallback ${kind} remains the original failure, not the owner's cancellation`, async () => {
    const game = bootstrapGame(sixPlayerMvpConfig, { locale: "en" });
    const original = new DOMException("synthetic_original_fallback_failure", kind);
    let calls = 0;
    const client = {
      chat: async () => "",
      async runToolLoop<T>(): Promise<{ finalAction: T | null; assistantText: string }> {
        throw new Error("synthetic_model_error");
      },
    };
    const provider = new LlmActionProvider(game.world, client, {
      llmTimeoutMs: 1000,
      privilegedFallbackProvider: {
        async getAction() {
          calls++;
          throw original;
        },
      },
    });
    await expect(provider.getAction(request(1))).rejects.toBe(original);
    expect(calls).toBe(1);
    expect(provider.runtimeState.scheduler.active).toBe(0);
    await provider.close();
  });

test("close preserves an already rejected turn error while releasing all logical owners", async () => {
  const game = bootstrapGame(sixPlayerMvpConfig, { locale: "en" }),
    original = new Error("synthetic_resolver_failure");
  const client = {
    chat: async () => "",
    async runToolLoop<T>() {
      return { finalAction: null as T | null, assistantText: "" };
    },
  };
  const provider = new LlmActionProvider(game.world, client, {
    llmTimeoutMs: 1000,
    clientResolver() {
      throw original;
    },
  });
  const turn = provider.getAction(request(1)).then(
    () => null,
    (error) => error,
  );
  const closing = provider.close().then(
    () => null,
    (error) => error,
  );
  expect(await turn).toBe(original);
  const cleanup = await closing;
  expect(cleanup).toBeInstanceOf(AggregateError);
  expect(cleanup.errors).toEqual([original]);
  expect(provider.runtimeState).toEqual({
    closed: true,
    turns: 0,
    scheduler: { closed: true, active: 0, queued: 0 },
  });
  await provider.close();
});

test("closing during successful action finalization cannot return the selected action", async () => {
  const game = bootstrapGame(sixPlayerMvpConfig, { locale: "en" });
  const client = {
    chat: async () => "",
    async runToolLoop<T>(messages: any, _tools: any, callbacks: any) {
      const accepted = await callbacks.onToolCall(submission(messages));
      return { finalAction: accepted.finalAction as T, assistantText: "" };
    },
  };
  let fallback = 0;
  const provider = new LlmActionProvider(game.world, client, {
    trace: true,
    colorizeLogs: false,
    llmTimeoutMs: 1000,
    privilegedFallbackProvider: {
      async getAction() {
        fallback++;
        return null;
      },
    },
  });
  let closing: Promise<void> | undefined;
  const log = spyOn(console, "log").mockImplementation((line: unknown) => {
    if (String(line).includes("request_ok") && !closing) closing = provider.close();
  });
  try {
    expect(await provider.getAction(request(1))).toBeNull();
    expect(closing).toBeDefined();
    await closing;
    expect(fallback).toBe(0);
    expect(provider.runtimeState).toEqual({
      closed: true,
      turns: 0,
      scheduler: { closed: true, active: 0, queued: 0 },
    });
  } finally {
    log.mockRestore();
    await provider.close();
  }
});
