import { describe, expect, test } from "bun:test";
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
});
