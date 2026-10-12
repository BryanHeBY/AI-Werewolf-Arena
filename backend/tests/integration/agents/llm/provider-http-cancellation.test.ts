/**
 * Integration test owns cancellation of a real installed-SDK localhost response by its LLM
 * provider. A test-owned streaming HTTP server and the original bounded request supply
 * input; literal cancellation/result/active-lease assertions are the oracle. The HTTP
 * resource and close order stay in this case, with no external model request.
 */
import { expect, test } from "bun:test";
import { bootstrapGame } from "../../../../src/app/bootstrap";
import { sixPlayerMvpConfig } from "../../../../src/runtime/scenarios/six_player_mvp";
import { LlmActionProvider } from "../../../../src/ai/agents/llm/llm_action_provider";
import { AiSdkClient } from "../../../../src/ai/integrations/llm/ai_sdk_client";
import { Phase, type ActionRequest } from "../../../../src/core";

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

test("real SDK HTTP response is cancelled when the owning provider closes", async () => {
  const game = bootstrapGame(sixPlayerMvpConfig, { locale: "en" });
  let began!: () => void, cancelled!: () => void;
  const ready = new Promise<void>((resolve) => {
    began = resolve;
  });
  const ended = new Promise<void>((resolve) => {
    cancelled = resolve;
  });
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    async fetch(input) {
      await input.json();
      began();
      return new Response(
        new ReadableStream({
          start(controller) {
            controller.enqueue(new TextEncoder().encode("{"));
          },
          cancel() {
            cancelled();
          },
        }),
        { headers: { "content-type": "application/json" } },
      );
    },
  });
  const provider = new LlmActionProvider(
    game.world,
    new AiSdkClient({
      apiKey: "synthetic-only",
      baseURL: `${server.url.origin}/v1`,
      model: "synthetic",
    }),
    {
      llmTimeoutMs: 5000,
      fallbackProvider: {
        async getAction() {
          throw new Error("unexpected_fallback");
        },
      },
    },
  );
  let timer: NodeJS.Timeout | undefined;
  try {
    const pending = provider.getAction(request(1));
    await ready;
    await provider.close();
    expect(await pending).toBeNull();
    await Promise.race([
      ended,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error("HTTP_response_not_cancelled")), 2000);
      }),
    ]);
    expect(provider.runtimeState.scheduler.active).toBe(0);
  } finally {
    if (timer) clearTimeout(timer);
    await provider.close();
    server.stop(true);
  }
});
