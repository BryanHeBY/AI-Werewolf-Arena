import { describe, expect, test } from "bun:test";
import { bootstrapGame } from "../../../src/app/bootstrap";
import { Phase } from "../../../src/core/domain/model";
import { sixPlayerMvpConfig } from "../../../src/runtime/scenarios/six_player_mvp";
import { LlmActionProvider } from "../../../src/ai/agents/llm/llm_action_provider";
import { ActionRequest } from "../../../src/core/domain/model";
import { ScopedRequestScheduler } from "../../../src/ai/agents/llm/request_scheduler";

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
    const third = scheduler.acquire(request).then(release => {
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
    const blocked = new Promise<void>(resolve => { unblock = resolve; });
    const twoStarted = new Promise<void>(resolve => { signalTwoStarted = resolve; });
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
            id: `call-${started}`, name: "submit_action",
            args: { turn_id: turnId, action: "speak", arguments: { text: "模型发言" } }, rawArgs: "{}",
          });
          return { finalAction: handled.finalAction as T, assistantText: "" };
        } finally { active--; }
      },
    };
    const provider = new LlmActionProvider(context.world, client, {
      llmTimeoutMs: 5000,
      requestConcurrencyScopeResolver: () => "zhipu_coding",
      maxConcurrentRequestsResolver: () => 2,
      fallbackProvider: { getAction: async () => null },
    });
    const pending = [1, 2, 3, 4].map(actorId => provider.getAction({
      phase: Phase.Day, actorId, allowedTools: ["speak"],
      context: { turn_constraints: { min_valid_actions: 1, max_valid_actions: 1 } },
    }));
    try {
      await twoStarted;
      await Bun.sleep(0);
      expect(started).toBe(2);
      expect(peak).toBe(2);
    } finally { unblock(); }
    const actions = await Promise.all(pending);
    expect(started).toBe(4);
    expect(peak).toBe(2);
    expect(actions.every(action => action?.name === "speak")).toBe(true);
  });

});
