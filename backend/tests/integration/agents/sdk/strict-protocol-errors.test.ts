/**
 * SDK integration tests check production client/tool-loop parsing with injected serialized response bodies. Inputs are malformed action/helper envelopes returned by an inert fetch; literal request counts, optional-wait and unchanged guard stock are the oracle. No real HTTP server, network service or billed model is used.
 */
import { expect, test } from "bun:test";
import { bootstrapGame } from "../../../../src/app/bootstrap";
import {
  COMPONENT,
  Phase,
  Role,
  type ActionRequest,
  type RoleComponent,
} from "../../../../src/core";
import { getGuardState } from "../../../../src/game/mechanisms/roles/guard/ports";
import { LlmActionProvider } from "../../../../src/ai/agents/llm/llm_action_provider";
import { AiSdkClient } from "../../../../src/ai/integrations/llm/ai_sdk_client";
import { sixPlayerMvpConfig } from "../../../../src/runtime/scenarios/six_player_mvp";
import { describeError } from "../../../../src/utils/error_diagnostic";

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
          fallbackProvider: {
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
        expect(
          getGuardState(world.getComponent<RoleComponent>(5, COMPONENT.Role)!)!.lastTarget,
        ).toBeNull();
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
        expect(
          getGuardState(world.getComponent<RoleComponent>(5, COMPONENT.Role)!)!.lastTarget,
        ).toBeNull();
      } finally {
        await provider.close();
      }
    });
