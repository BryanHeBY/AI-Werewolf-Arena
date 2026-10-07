import { expect, test } from "bun:test";
import { bootstrapGame } from "../../src/app/bootstrap";
import { COMPONENT, Phase, Role, type RoleComponent, type ActionRequest } from "../../src/core";
import { parseRuntimeConfig } from "../../src/runtime/config/parse_config";
import { resolveGameSetup, resolvePlayerProfile } from "../../src/runtime/config/resolve_game_setup";
import { LlmActionProvider } from "../../src/ai/agents/llm/llm_action_provider";
import { AcpActionProvider } from "../../src/ai/agents/acp/acp_action_provider";
import type { ChatMessage, ChatModelClient, ToolLoopCallbacks, ToolSchema } from "../../src/ai/integrations/llm/transport";
import type { AcpSessionFactory } from "../../src/ai/integrations/acp/session";

for (const kind of ["llm", "acp"] as const) {
  test(`${kind}: seat and role configuration reaches actual identity and personality prompts`, async () => {
    const runtime = parseRuntimeConfig({
      providers: { default: "test", items: { test: kind === "llm" ? { type: "openai", apiKey: "unused" } : { type: "acp", command: "unused" } } },
      agents: { default: "main", items: {
        main: { kind, provider: "test", ...(kind === "llm" ? { model: "unused" } : {}), personalityPrompt: "INHERITED_STYLE" },
        other: { kind, provider: "test", ...(kind === "llm" ? { model: "other" } : {}), personalityPrompt: "OTHER_STYLE" },
      } },
      game: { players: { "1": { name: "Player One", personalityPrompt: "SEAT_STYLE" }, "2": { personalityPrompt: null }, "3": { agent: "other" }, "4": { name: "Player Four" } },
        roleAgents: { wolf: { agent: "main", personalityPrompt: "WOLF_STYLE" } } },
    });
    const setup = resolveGameSetup(runtime);
    const { world } = bootstrapGame(setup.boardConfig, { playerNames: Object.fromEntries(Object.entries(setup.players).flatMap(([id, player]) => player.name ? [[id, player.name]] : [])) });
    // Seat-to-role fixtures exercise selection after assignment, independently of shuffle.
    world.getComponent<RoleComponent>(4, COMPONENT.Role)!.role = Role.Wolf;
    world.getComponent<RoleComponent>(5, COMPONENT.Role)!.role = Role.Villager;
    const profiles = new Map(world.entityIds().map(id => [id, resolvePlayerProfile(setup, id, world.getComponent<RoleComponent>(id, COMPONENT.Role)?.role)]));
    expect(profiles.get(3)?.name).toBe("other");
    const prompts = new Map<number, string>();
    const client: ChatModelClient = {
      async chat() { return ""; },
      async runToolLoop<T>(messages: ChatMessage[], _tools: ToolSchema[], callbacks: ToolLoopCallbacks<T>) {
        const system = messages.find(message => message.role === "system")?.content ?? "";
        const actor = Number(/编号是(\d+)号/.exec(system)?.[1]);
        prompts.set(actor, system);
        const result = await callbacks.onToolCall({ id: "speak", name: "speak", args: { text: "hello" }, rawArgs: '{"text":"hello"}' });
        return { finalAction: result.finalAction ?? null, assistantText: "" };
      },
    };
    const factory: AcpSessionFactory = {
      async createSession(input) {
        const sessionId = `actor-${input.actorId}`;
        prompts.set(input.actorId, input.initialPrompt ?? "");
        return { sessionId,
          async prompt(text) {
            const turnId = /当前回合 ID：(\S+)/.exec(text)?.[1];
            expect(input.registry.submitAction(sessionId, { turn_id: turnId!, action: "speak", arguments: { text: "hello" } })).toEqual({ ok: true, accepted: true });
          }, async cancel() {}, async close() {},
        };
      },
    };
    const personalityPromptResolver = (request: ActionRequest) => profiles.get(request.actorId)?.personalityPrompt;
    const provider = kind === "llm" ? new LlmActionProvider(world, client, { personalityPromptResolver }) : new AcpActionProvider(world, { sessionFactory: factory, personalityPromptResolver });
    try {
      for (const actorId of [1, 2, 3, 4, 5]) {
        const action = await provider.getAction({ actorId, phase: Phase.Day, allowedTools: ["speak"], context: { day: 1, stage: "day_speech", visible_events: [] } });
        expect(action?.name).toBe("speak");
      }
      expect(prompts.get(1)).toContain("Player One");
      expect(prompts.get(1)).toContain("SEAT_STYLE");
      expect(prompts.get(1)).not.toContain("INHERITED_STYLE");
      expect(prompts.get(2)).not.toContain("INHERITED_STYLE");
      expect(prompts.get(2)).not.toContain("WOLF_STYLE");
      expect(prompts.get(3)).toContain("OTHER_STYLE");
      expect(prompts.get(4)).toContain("Player Four");
      expect(prompts.get(4)).toContain("WOLF_STYLE");
      expect(prompts.get(5)).toContain("INHERITED_STYLE");
    } finally { if (provider instanceof AcpActionProvider) await provider.close(); }
  });
}
