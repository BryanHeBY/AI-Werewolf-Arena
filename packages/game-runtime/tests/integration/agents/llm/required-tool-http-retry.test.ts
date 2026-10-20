/**
 * 集成测试验证 required-tool-http-retry 的既有传输、回合与显式特权回退边界。输入为原假客户端、请求、取消／期限和回调控制；预期来自原手写动作、引用、记录与拒绝断言。特权 provider 保留原请求及测试状态控制，不进入默认生产观察策略。
 */
import { describe, expect, test } from "bun:test";
import { PotionType } from "../../../../src/domain";
import { bootstrapGame } from "../../../../src/app/bootstrap";
import { COMPONENT } from "../../../../src/domain/components/names";
import { RoleComponent } from "../../../../src/domain/components/role";
import { Phase } from "../../../../src/domain/model";
import { twelvePlayerStandardConfig } from "../../../../src/rulesets/presets/twelve-player-standard";
import { LlmActionProvider } from "../../../../src/agents/llm/llm-action-provider";
import { AiSdkClient } from "../../../../src/adapters/llm/ai-sdk-client";
import {
  REQUIRED_ACTION_CONSTRAINTS,
  FallbackProvider,
} from "../../../support/drivers/agents/llm-clients";

describe("LlmActionProvider protocol", () => {
  test("retries a text-only required-tool response and completes the witch turn", async () => {
    const context = bootstrapGame(twelvePlayerStandardConfig);
    const witchId = context.world
      .entityIds()
      .find((id) => context.world.getComponent(id, COMPONENT.Role)?.role === "witch")!;
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
        { llmTimeoutMs: 5000, privilegedFallbackProvider: new FallbackProvider(null) },
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
