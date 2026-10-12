/**
 * Unit tests verify SDK/ACP profile prompts and role/seat selection precedence through pure runtime configuration parsing.
 * Input: Original transport-kind matrix and literal malformed persona strings.
 * Output and oracle: Exact profile text, inherited spawn arguments and diagnostic paths retain original assertions; no config file, transport or model is loaded.
 */
import { expect, test } from "bun:test";
import {
  resolveAgentProfileByName,
  resolveGameSetup,
} from "../../../src/runtime/config/resolve_game_setup";
import { parseRuntimeConfig } from "../../../src/runtime/config/parse_config";

for (const kind of ["llm", "acp"] as const) {
  test(`${kind} preserves agent prompts and supports role/seat prompt overrides`, () => {
    const runtime = parseRuntimeConfig({
      providers: {
        default: "test_provider",
        items: {
          test_provider:
            kind === "llm"
              ? { type: "openai", apiKey: "test-key" }
              : { type: "acp", transport: "stdio", command: "test-acp" },
        },
      },
      agents: {
        default: "test_agent",
        items: {
          test_agent: {
            kind,
            provider: "test_provider",
            personalityPrompt: "默认风格",
            ...(kind === "llm" ? { model: "test-model" } : { spawnArgs: ["--base"] }),
          },
        },
      },
      game: {
        agent: "test_agent",
        roleAgents: { wolf: { agent: "test_agent", personalityPrompt: "狼人风格" } },
        playerAgents: {
          "1": {
            agent: "test_agent",
            personalityPrompt: "一号风格",
            ...(kind === "acp" ? { spawnArgs: ["--seat"] } : {}),
          },
          "2": "test_agent",
          "3": { agent: "test_agent" },
        },
      },
    });
    const setup = resolveGameSetup(runtime);
    expect(setup.defaultProfile.personalityPrompt).toBe("默认风格");
    expect(setup.roleProfiles.wolf.personalityPrompt).toBe("狼人风格");
    expect(setup.playerProfiles["1"].personalityPrompt).toBe("一号风格");
    expect(setup.playerProfiles["2"].personalityPrompt).toBe("默认风格");
    expect(setup.playerProfiles["3"].personalityPrompt).toBe("默认风格");
    expect(resolveAgentProfileByName(runtime).personalityPrompt).toBe("默认风格");
    if (kind === "acp") expect(setup.playerProfiles["1"].spawnArgs).toEqual(["--base", "--seat"]);
  });
}

test("validates ACP prompt strings at agent and selection boundaries", () => {
  const input = {
    providers: {
      default: "acp",
      items: { acp: { type: "acp", transport: "stdio", command: "test-acp" } },
    },
    agents: { default: "acp", items: { acp: { kind: "acp", provider: "acp" } } },
    game: { agent: "acp" },
  };
  expect(() =>
    parseRuntimeConfig({
      ...input,
      agents: {
        ...input.agents,
        items: { acp: { ...input.agents.items.acp, personalityPrompt: 123 } },
      },
    }),
  ).toThrow("runtime_config_required_string_invalid: agents.items.acp.personalityPrompt");
  expect(() =>
    parseRuntimeConfig({
      ...input,
      game: {
        ...input.game,
        playerAgents: { "1": { agent: "acp", personalityPrompt: " " } },
      },
    }),
  ).toThrow("runtime_config_required_string_invalid: game.playerAgents.1.personalityPrompt");
});
