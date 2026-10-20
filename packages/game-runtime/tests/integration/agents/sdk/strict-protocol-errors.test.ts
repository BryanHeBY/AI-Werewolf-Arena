/**
 * 集成测试验证 strict-protocol-errors 的既有传输、回合与显式特权回退边界。输入为原假客户端、请求、取消／期限和回调控制；预期来自原手写动作、引用、记录与拒绝断言。特权 provider 保留原请求及测试状态控制，不进入默认生产观察策略。
 */
import { expect, test } from "bun:test";
import { bootstrapGame } from "../../../../src/app/bootstrap";
import {
  COMPONENT,
  Phase,
  Role,
  type ActionRequest,
  type RoleComponent,
} from "../../../../src/domain";
import { getGuardState } from "../../../../src/features/guard/ports";
import { LlmActionProvider } from "../../../../src/agents/llm/llm-action-provider";
import { AiSdkClient } from "../../../../src/adapters/llm/ai-sdk-client";
import { sixPlayerMvpConfig } from "../../../../src/rulesets/presets/six-player-mvp";
import { describeError } from "../../../../src/utils/error-diagnostic";

const roles = [Role.Wolf, Role.Seer, Role.Villager, Role.Wolf, Role.Guard, Role.Villager];

const request = (strict: boolean): ActionRequest => ({
  actorId: 5,
  phase: Phase.Night,
  allowedTools: ["guard"],
  context: {
    day: 1,
    stage: "guard",
    visible_events: [],
    turn_constraints: { min_valid_actions: 0, max_valid_actions: 1 },
    ...(strict ? { action_failure_policy: "error" } : {}),
  },
});

for (const locale of ["zh-CN", "en"] as const)
  for (const malformed of ["json", "wrong_turn"] as const)
    test(`${locale}/${malformed}: production AiSdkClient parse/protocol failure cannot become a clean optional wait`, async () => {
      const { world } = bootstrapGame(sixPlayerMvpConfig, { fixedRoles: roles, locale });
      let requests = 0,
        fallbacks = 0;
      const syntheticFetch = Object.assign(
        async () => {
          requests++;
          const bad = requests <= 3,
            args =
              malformed === "json"
                ? "{bad_json"
                : JSON.stringify({
                    turn_id: "wrong-turn",
                    action: "guard",
                    arguments: { target_id: 6, abstain: false },
                  });
          return Response.json({
            id: "synthetic",
            object: "chat.completion",
            created: 1,
            model: "synthetic",
            choices: [
              {
                index: 0,
                finish_reason: bad ? "tool_calls" : "stop",
                message: bad
                  ? {
                      role: "assistant",
                      content: null,
                      tool_calls: [
                        {
                          id: `invalid-${requests}`,
                          type: "function",
                          function: { name: "submit_action", arguments: args },
                        },
                      ],
                    }
                  : { role: "assistant", content: "End" },
              },
            ],
            usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
          });
        },
        { preconnect: fetch.preconnect },
      );
      const provider = new LlmActionProvider(
        world,
        new AiSdkClient({
          apiKey: "synthetic",
          baseURL: "https://synthetic.invalid/v1",
          model: "synthetic",
          fetch: syntheticFetch,
        }),
        {
          llmTimeoutMs: 1500,
          privilegedFallbackProvider: {
            async getAction() {
              fallbacks++;
              return null;
            },
          },
        },
      );
      try {
        await expect(provider.getAction(request(true))).rejects.toThrow("action_turn_failed");
        expect(requests).toBe(4);
        expect(fallbacks).toBe(0);
        expect(describeError(new Error("action_turn_failed"))).toEqual({ code: "action_failed" });
        expect(getGuardState(world.getComponent(5, COMPONENT.Role)!)!.lastTarget).toBeNull();
      } finally {
        await provider.close();
      }
    });

for (const locale of ["zh-CN", "en"] as const)
  for (const helper of ["report_bug", "get_game_schema"] as const)
    test(`${locale}/${helper}: SDK helper parse errors do not become action attempts or forbid optional waiting`, async () => {
      const { world } = bootstrapGame(sixPlayerMvpConfig, { fixedRoles: roles, locale });
      let requests = 0;
      const syntheticFetch = Object.assign(
        async () => {
          requests++;
          const bad = requests <= 3;
          return Response.json({
            id: "synthetic",
            object: "chat.completion",
            created: 1,
            model: "synthetic",
            choices: [
              {
                index: 0,
                finish_reason: bad ? "tool_calls" : "stop",
                message: bad
                  ? {
                      role: "assistant",
                      content: null,
                      tool_calls: [
                        {
                          id: `helper-${requests}`,
                          type: "function",
                          function: { name: helper, arguments: "{bad_json" },
                        },
                      ],
                    }
                  : { role: "assistant", content: "Wait" },
              },
            ],
            usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
          });
        },
        { preconnect: fetch.preconnect },
      );
      const provider = new LlmActionProvider(
        world,
        new AiSdkClient({
          apiKey: "synthetic",
          baseURL: "https://synthetic.invalid/v1",
          model: "synthetic",
          fetch: syntheticFetch,
        }),
        { llmTimeoutMs: 1500 },
      );
      try {
        expect(await provider.getAction(request(true))).toBeNull();
        expect(requests).toBe(4);
        expect(getGuardState(world.getComponent(5, COMPONENT.Role)!)!.lastTarget).toBeNull();
      } finally {
        await provider.close();
      }
    });
