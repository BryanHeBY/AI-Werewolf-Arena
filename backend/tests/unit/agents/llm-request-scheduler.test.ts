/**
 * 单元测试验证 llm-request-scheduler 的既有传输、回合与显式特权回退边界。输入为原假客户端、请求、取消／期限和回调控制；预期来自原手写动作、引用、记录与拒绝断言。特权 provider 保留原请求及测试状态控制，不进入默认生产观察策略。
 */
import { describe, expect, test } from "bun:test";
import { bootstrapGame } from "../../../src/app/bootstrap";
import { Phase } from "../../../src/domain/model";
import { sixPlayerMvpConfig } from "../../../src/runtime/scenarios/six_player_mvp";
import { LlmActionProvider } from "../../../src/ai/agents/llm/llm_action_provider";
import { ActionRequest } from "../../../src/domain/model";
import { ScopedRequestScheduler } from "../../../src/ai/runtime/request_scheduler";

const request = { actorId: 1, phase: "day" } as ActionRequest;

describe("ScopedRequestScheduler", () => {
  test("serializes requests within a limited scope and hands the lease to the next waiter", async () => {
    const waits: number[] = [];
    const scheduler = new ScopedRequestScheduler({
      defaultMaxConcurrentRequests: 1,
      onWait: ({ queueDepth }) => waits.push(queueDepth),
    });
    const releaseFirst = await scheduler.acquire(request);
    let secondAcquired = false;
    const second = scheduler.acquire(request).then((release) => {
      secondAcquired = true;
      return release;
    });
    await Promise.resolve();
    expect(secondAcquired).toBe(false);
    expect(waits).toEqual([1]);

    releaseFirst();
    const releaseSecond = await second;
    expect(secondAcquired).toBe(true);
    releaseSecond();
  });

  test("keeps different scopes independent and makes lease release idempotent", async () => {
    const scheduler = new ScopedRequestScheduler({
      defaultMaxConcurrentRequests: 1,
      scopeResolver: (input) => `player-${input.actorId}`,
    });
    const releaseOne = await scheduler.acquire(request);
    const releaseTwo = await scheduler.acquire({ ...request, actorId: 2 });
    releaseOne();
    releaseOne();
    releaseTwo();
  });

  test("reserves a released slot for the queued waiter before a new acquire", async () => {
    const scheduler = new ScopedRequestScheduler({ defaultMaxConcurrentRequests: 1 });
    const releaseFirst = await scheduler.acquire(request);
    const second = scheduler.acquire(request);
    releaseFirst();
    let thirdAcquired = false;
    const third = scheduler.acquire(request).then((release) => {
      thirdAcquired = true;
      return release;
    });
    const releaseSecond = await second;
    expect(thirdAcquired).toBe(false);
    releaseFirst(); // Releasing the old lease twice must not free the new owner's slot.
    await Promise.resolve();
    expect(thirdAcquired).toBe(false);
    releaseSecond();
    const releaseThird = await third;
    expect(thirdAcquired).toBe(true);
    releaseThird();
  });
  test("holds provider concurrency slots until model turns have completed", async () => {
    const context = bootstrapGame(sixPlayerMvpConfig);
    let started = 0;
    let active = 0;
    let peak = 0;
    let unblock!: () => void;
    let signalTwoStarted!: () => void;
    const blocked = new Promise<void>((resolve) => {
      unblock = resolve;
    });
    const twoStarted = new Promise<void>((resolve) => {
      signalTwoStarted = resolve;
    });
    const client = {
      chat: async () => "",
      async runToolLoop<T>(messages: Array<{ content: string }>, _tools: unknown, callbacks: any) {
        started++;
        peak = Math.max(peak, ++active);
        if (started === 2) signalTwoStarted();
        await blocked;
        try {
          const turnId = messages.at(-1)!.content.match(/turn_id 必须为 (t\d+)/)![1];
          const handled = await callbacks.onToolCall({
            id: `call-${started}`,
            name: "submit_action",
            args: { turn_id: turnId, action: "speak", arguments: { text: "模型发言" } },
            rawArgs: "{}",
          });
          return { finalAction: handled.finalAction as T, assistantText: "" };
        } finally {
          active--;
        }
      },
    };
    const provider = new LlmActionProvider(context.world, client, {
      llmTimeoutMs: 5000,
      requestConcurrencyScopeResolver: () => "zhipu_coding",
      maxConcurrentRequestsResolver: () => 2,
      privilegedFallbackProvider: { getAction: async () => null },
    });
    const pending = [1, 2, 3, 4].map((actorId) =>
      provider.getAction({
        phase: Phase.Day,
        actorId,
        allowedTools: ["speak"],
        context: {
          day: 1,
          stage: "day_speech",
          visible_events: [],
          turn_constraints: { min_valid_actions: 1, max_valid_actions: 1 },
        },
      }),
    );
    try {
      await twoStarted;
      await Bun.sleep(0);
      expect(started).toBe(2);
      expect(peak).toBe(2);
    } finally {
      unblock();
    }
    const actions = await Promise.all(pending);
    expect(started).toBe(4);
    expect(peak).toBe(2);
    expect(actions.every((action) => action?.name === "speak")).toBe(true);
  });
});

test("queued cancellation removes its waiter; expired requests never receive a released lease", async () => {
  const scheduler = new ScopedRequestScheduler({ defaultMaxConcurrentRequests: 1 });
  const first = await scheduler.acquire(request);
  const cancelled = new AbortController();
  const aborted = scheduler.acquire(request, undefined, cancelled.signal);
  cancelled.abort(new Error("cancelled-by-owner"));
  await expect(aborted).rejects.toThrow("cancelled-by-owner");
  expect(scheduler.snapshot).toEqual({ closed: false, active: 1, queued: 0 });
  const elapsed = scheduler.acquire({ ...request, deadlineAtMs: Date.now() + 30 });
  await expect(elapsed).rejects.toThrow("request_deadline_elapsed");
  expect(scheduler.snapshot).toEqual({ closed: false, active: 1, queued: 0 });
  first();
  expect(scheduler.snapshot).toEqual({ closed: false, active: 0, queued: 0 });
  const next = await scheduler.acquire(request);
  next();
  expect(scheduler.snapshot.active).toBe(0);
});

test("closed scheduler rejects queued and future work, retaining active lease ownership until release", async () => {
  const scheduler = new ScopedRequestScheduler({ defaultMaxConcurrentRequests: 1 });
  const first = await scheduler.acquire(request);
  const queued = scheduler.acquire(request);
  scheduler.close();
  await expect(queued).rejects.toThrow("request_scheduler_closed");
  expect(scheduler.snapshot).toEqual({ closed: true, active: 1, queued: 0 });
  await expect(scheduler.acquire(request)).rejects.toThrow("request_scheduler_closed");
  first();
  first();
  scheduler.close();
  expect(scheduler.snapshot).toEqual({ closed: true, active: 0, queued: 0 });
});

test("abort after grant cannot free another lease, and a throwing queue observer leaves no orphan waiter", async () => {
  const scheduler = new ScopedRequestScheduler({ defaultMaxConcurrentRequests: 1 });
  const first = await scheduler.acquire(request),
    control = new AbortController();
  const pending = scheduler.acquire(request, undefined, control.signal);
  first();
  const granted = await pending;
  control.abort();
  expect(scheduler.snapshot).toEqual({ closed: false, active: 1, queued: 0 });
  granted();
  expect(scheduler.snapshot.active).toBe(0);
  const failure = new Error("observer-error");
  const other = new ScopedRequestScheduler({
    defaultMaxConcurrentRequests: 1,
    onWait() {
      throw failure;
    },
  });
  const held = await other.acquire(request);
  await expect(other.acquire(request)).rejects.toBe(failure);
  expect(other.snapshot.queued).toBe(0);
  held();
  expect(other.snapshot.active).toBe(0);
});
