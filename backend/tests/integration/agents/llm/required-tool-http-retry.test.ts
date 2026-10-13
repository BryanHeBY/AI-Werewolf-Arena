/**
 * SDK integration test verifies a real localhost text-only required-tool reply is retried and completes the Witch turn.
 * Input: The original installed SDK client, test-owned HTTP response sequence and fresh Witch request.
 * Output and oracle: Explicit tool_choice, retry prompt, request count and final action preserve response-to-tool semantics; the server is local and no external model is called.
 */
import { describe, expect, test } from "bun:test";
import { PotionType } from "../../../../src/core";
import { bootstrapGame } from "../../../../src/app/bootstrap";
import { COMPONENT } from "../../../../src/core/domain/components/names";
import { RoleComponent } from "../../../../src/core/domain/components/role";
import { Phase } from "../../../../src/core/domain/model";
import { twelvePlayerStandardConfig } from "../../../../src/runtime/scenarios/twelve_player_standard";
import { LlmActionProvider } from "../../../../src/ai/agents/llm/llm_action_provider";
import { AiSdkClient } from "../../../../src/ai/integrations/llm/ai_sdk_client";
import { REQUIRED_ACTION_CONSTRAINTS, FallbackProvider } from "../../../support/drivers/agents/llm-clients";

describe("LlmActionProvider protocol", () => {

  test("retries a text-only required-tool response and completes the witch turn", async () => {
    const context = bootstrapGame(twelvePlayerStandardConfig);
    const witchId = context.world
      .entityIds()
      .find(
        (id) => context.world.getComponent<RoleComponent>(id, COMPONENT.Role)?.role === "witch",
      )!;
    let requests = 0;
    const server = Bun.serve({
      hostname: "127.0.0.1",
      port: 0,
      async fetch(request) {
        const body = (await request.json()) as any;
        requests++;
        expect(body.tool_choice).toBe("required");
        let message: Record<string, unknown> = { role: "assistant", content: "我未能提交行动" };
        if (requests > 1) {
          const prompt = body.messages.findLast((item: any) =>
            item.content?.includes("turn_id 必须为"),
          );
          const turnId = prompt.content.match(/turn_id 必须为 (t\d+)/)[1];
          expect(body.messages.at(-1).content).toContain("重试 1/3");
          message = {
            role: "assistant",
            content: null,
            tool_calls: [
              {
                id: "corrected-action",
                type: "function",
                function: {
                  name: "submit_action",
                  arguments: JSON.stringify({
                    turn_id: turnId,
                    action: "use_potion",
                    arguments: { target_id: witchId, potion_type: PotionType.None },
                  }),
                },
              },
            ],
          };
        }
        return Response.json({
          id: "chatcmpl-witch",
          object: "chat.completion",
          created: 1,
          model: "test-model",
          choices: [{ index: 0, message, finish_reason: requests === 1 ? "stop" : "tool_calls" }],
          usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
        });
      },
    });
    try {
      const provider = new LlmActionProvider(
        context.world,
        new AiSdkClient({
          apiKey: "test-key",
          baseURL: `${server.url.origin}/v1`,
          model: "test-model",
        }),
        { llmTimeoutMs: 5000, fallbackProvider: new FallbackProvider(null) },
      );
      await expect(
        provider.getAction({
          phase: Phase.Night,
          actorId: witchId,
          allowedTools: ["use_potion"],
          context: {
            visible_events: [],
            day: 1,
            stage: "witch",
            turn_constraints: REQUIRED_ACTION_CONSTRAINTS,
          },
        }),
      ).resolves.toEqual({
        name: "use_potion",
        args: { target_id: witchId, potion_type: PotionType.None },
      });
      expect(requests).toBe(2);
    } finally {
      server.stop(true);
    }
  });
});
