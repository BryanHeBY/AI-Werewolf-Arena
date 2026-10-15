/**
 * 单元测试通过纯 runtime 配置解析，以原传输类别矩阵和字面错误 persona 字符串核对 SDK／ACP profile 提示及身份／座位选择优先级。精确 profile 文本、继承 spawn 参数及诊断路径为预期；不加载配置文件、传输或模型。
 */
import { expect, test } from "bun:test";
import {
  resolveAgentProfileByName,
  resolveGameSetup,
} from "../../../src/app/config/resolve-game-setup";
import { parseRuntimeConfig } from "../../../src/app/config/parse-config";

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
