/**
 * 单元测试通过纯 runtime 配置解析，以原传输类别矩阵和字面错误 persona 字符串核对 SDK／ACP profile 提示及身份／座位选择优先级。精确 profile 文本、继承 spawn 参数及诊断路径为预期；不加载配置文件、传输或模型。
 */
import { expect, test } from "bun:test";
import {
  resolveAgentProfileByName,
  resolveGameSetup,
  resolvePlayerProfile,
} from "../../../src/app/config/resolve-game-setup";
import { Role } from "../../../src/domain/identity";
import { parseRuntimeConfig } from "../../../src/app/config/parse-config";

for (const kind of ["llm", "acp"] as const) {
  test(`${kind} preserves agent prompts and supports role/seat prompt overrides`, () => {
    const runtime = parseRuntimeConfig({
      backends: {
        schemaVersion: 2,
        items: {
          test_provider: {
            kind,
            config:
              kind === "llm"
                ? { type: "openai", apiKey: "test-key" }
                : { transport: "stdio", command: "test-acp" },
          },
        },
      },
      agents: {
        schemaVersion: 2,
        default: "test_agent",
        items: {
          test_agent: {
            backend: "test_provider",
            customInstructions: { mode: "replace", text: "默认风格" },
            options: kind === "llm" ? { model: "test-model" } : { spawnArgs: ["--base"] },
          },
        },
      },
      game: {
        agent: "test_agent",
        roles: {
          wolf: { agent: "test_agent", customInstructions: { mode: "replace", text: "狼人风格" } },
        },
        players: {
          "1": {
            agent: "test_agent",
            customInstructions: { mode: "replace", text: "一号风格" },
            ...(kind === "acp" ? { spawnArgs: ["--seat"] } : {}),
          },
          "2": { agent: "test_agent" },
          "3": { agent: "test_agent" },
        },
      },
    });
    const setup = resolveGameSetup(runtime);
    expect(setup.defaultProfile.customInstructions).toBe("默认风格");
    expect(resolvePlayerProfile(setup, 6, Role.Wolf).customInstructions).toBe("狼人风格");
    expect(resolvePlayerProfile(setup, 1).customInstructions).toBe("一号风格");
    expect(resolvePlayerProfile(setup, 2).customInstructions).toBe("默认风格");
    expect(resolvePlayerProfile(setup, 3).customInstructions).toBe("默认风格");
    expect(resolveAgentProfileByName(runtime).customInstructions).toBe("默认风格");
    if (kind === "acp")
      expect(resolvePlayerProfile(setup, 1).spawnArgs).toEqual(["--base", "--seat"]);
  });
}

test("validates ACP prompt strings at agent and selection boundaries", () => {
  const input = {
    backends: {
      schemaVersion: 2,
      items: { acp: { kind: "acp", config: { transport: "stdio", command: "test-acp" } } },
    },
    agents: { schemaVersion: 2, default: "acp", items: { acp: { backend: "acp", options: {} } } },
    game: { agent: "acp" },
  };
  expect(() =>
    parseRuntimeConfig({
      ...input,
      agents: {
        ...input.agents,
        items: { acp: { ...input.agents.items.acp, customInstructions: 123 } },
      },
    }),
  ).toThrow("runtime_config_custom_instructions_invalid: agents.items.acp.customInstructions");
  expect(() =>
    parseRuntimeConfig({
      ...input,
      game: {
        ...input.game,
        players: { "1": { agent: "acp", customInstructions: { mode: "replace", text: " " } } },
      },
    }),
  ).toThrow("runtime_config_required_string_invalid: game.players.1.customInstructions.text");
});
