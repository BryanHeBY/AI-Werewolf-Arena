/**
 * Transport integration tests verify bilingual SDK and MCP control refusals expose structured feedback without internal exceptions.
 * Input: Original localhost SDK response sequences, authenticated control listeners and fresh locale-specific request worlds.
 * Output and oracle: Exact stale-turn/potion feedback, unauthorized/malformed status and resource nonmutation retain actual wire boundaries; server/registry cleanup stays in each case.
 */
import { expect, test } from "bun:test";
import { bootstrapGame } from "../../../../src/app/bootstrap";
import { COMPONENT, Phase, PotionType, Role, type RoleComponent } from "../../../../src/core";
import { twelvePlayerStandardConfig } from "../../../../src/runtime/scenarios/twelve_player_standard";
import { getWitchState } from "../../../../src/game/mechanisms/roles/private_state";
import { sixPlayerMvpConfig } from "../../../../src/runtime/scenarios/six_player_mvp";
import { LlmActionProvider } from "../../../../src/ai/agents/llm/llm_action_provider";
import { AiSdkClient } from "../../../../src/ai/integrations/llm/ai_sdk_client";
import { AcpTurnRegistry } from "../../../../src/ai/integrations/acp/acp_turn_registry";
import { WerewolfMcpControlServer } from "../../../../src/ai/integrations/acp/werewolf_mcp_control";

const twelveRoles = [
  Role.Wolf,
  Role.Wolf,
  Role.Wolf,
  Role.Wolf,
  Role.Seer,
  Role.Witch,
  Role.Hunter,
  Role.Idiot,
  Role.Villager,
  Role.Villager,
  Role.Villager,
  Role.Villager,
];

const han = /[\u4e00-\u9fff]/;

for (const locale of ["zh-CN", "en"] as const)
  test(`actual SDK ${locale} corrects stale turn and unavailable potion from structured refusal`, async () => {
    const requests: any[] = [];
    const server = Bun.serve({
      hostname: "127.0.0.1",
      port: 0,
      async fetch(input) {
        requests.push(await input.json());
        const calls =
          requests.length === 1
            ? [
                {
                  turn_id: "t99",
                  action: "use_potion",
                  arguments: { target_id: 6, potion_type: PotionType.None },
                },
                {
                  turn_id: "t1",
                  action: "use_potion",
                  arguments: { target_id: 9, potion_type: PotionType.Heal },
                },
              ]
            : [
                {
                  turn_id: "t1",
                  action: "use_potion",
                  arguments: { target_id: 6, potion_type: PotionType.None },
                },
              ];
        return Response.json({
          id: "rejection-test",
          object: "chat.completion",
          created: 1,
          model: "test",
          choices: [
            {
              index: 0,
              finish_reason: "tool_calls",
              message: {
                role: "assistant",
                content: null,
                tool_calls: calls.map((args, index) => ({
                  id: `call-${requests.length}-${index}`,
                  type: "function",
                  function: { name: "submit_action", arguments: JSON.stringify(args) },
                })),
              },
            },
          ],
          usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
        });
      },
    });
    const game = bootstrapGame(twelvePlayerStandardConfig, { locale, fixedRoles: twelveRoles });
    const witch = getWitchState(game.world.getComponent<RoleComponent>(6, COMPONENT.Role)!)!;
    (witch as { heal: number }).heal = 0;
    const before = structuredClone(witch);
    const provider = new LlmActionProvider(
      game.world,
      new AiSdkClient({ apiKey: "synthetic", baseURL: `${server.url.origin}/v1`, model: "test" }),
      {
        boardConfig: twelvePlayerStandardConfig,
        llmTimeoutMs: 2000,
        fallbackProvider: {
          async getAction() {
            throw new Error("unexpected_fallback");
          },
        },
      },
    );
    try {
      expect(
        await provider.getAction({
          actorId: 6,
          phase: Phase.Night,
          allowedTools: ["use_potion"],
          context: {
            day: 1,
            stage: "witch",
            wolf_target: 9,
            visible_events: [],
            turn_constraints: { min_valid_actions: 1, max_valid_actions: 1 },
          },
        }),
      ).toEqual({ name: "use_potion", args: { target_id: 6, potion_type: PotionType.None } });
      expect(requests.length).toBe(2);
      const replies = requests[1].messages
        .filter((message: any) => message.role === "tool")
        .map((message: any) => JSON.parse(message.content));
      expect(replies.map((reply: any) => reply.error)).toEqual([
        "turn_id_mismatch",
        "heal_unavailable",
      ]);
      expect(replies[0]).toMatchObject({
        ok: false,
        expected_turn_id: "t1",
        received_turn_id: "t99",
      });
      expect(replies[1]).toEqual({
        ok: false,
        error: "heal_unavailable",
        message: locale === "en" ? "Invalid action: antidote unavailable" : "非法操作，解药不可用",
      });
      if (locale === "en") expect(JSON.stringify(replies)).not.toMatch(han);
      expect(witch).toEqual(before);
    } finally {
      server.stop(true);
    }
  });

for (const locale of ["zh-CN", "en"] as const)
  test(`loopback ${locale} rejects unauthorized and malformed requests without returning internal exceptions`, async () => {
    const registry = new AcpTurnRegistry(bootstrapGame(sixPlayerMvpConfig, { locale }).world);
    const control = new WerewolfMcpControlServer(registry);
    const config = await control.start(process.execPath, []);
    const env = Object.fromEntries(config.env.map((entry) => [entry.name, entry.value]));
    try {
      const unauth = await fetch(`${env.WEREWOLF_MCP_CONTROL_URL}/invoke`, {
        method: "POST",
        body: "{}",
      });
      expect(unauth.status).toBe(401);
      const body = await unauth.json();
      expect(body).toEqual({
        ok: false,
        error: "unauthorized",
        message: locale === "en" ? "Control plane authorization failed." : "控制面认证失败。",
      });
      control.bindSession("own-session");
      const malformed = await fetch(`${env.WEREWOLF_MCP_CONTROL_URL}/invoke`, {
        method: "POST",
        headers: { authorization: `Bearer ${env.WEREWOLF_MCP_TOKEN}` },
        body: '{"synthetic-private-value":',
      });
      expect(malformed.status).toBe(400);
      const failure = await malformed.json();
      expect(failure.error).toBe("invalid_mcp_control_request");
      expect(JSON.stringify(failure)).not.toContain("synthetic-private-value");
      if (locale === "en") expect(failure.message).not.toMatch(han);
    } finally {
      registry.close();
      await control.close({ force: true });
    }
  });
