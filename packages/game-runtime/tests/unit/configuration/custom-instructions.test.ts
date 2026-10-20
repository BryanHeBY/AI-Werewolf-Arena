/**
 * 单元测试覆盖 Agent／对局／角色／席位指令的语言选择、有序组合和模型选择边界。
 * 输入使用三种传输的合成配置，预期为独立手写正文、诊断路径及拒绝案例；
 * 不从组合器生成 oracle，不读取私人文件或调用模型，摘要只允许出现操作和状态。
 */
import { expect, test } from "bun:test";
import { Role } from "../../../src/domain/identity";
import { parseRuntimeConfig } from "../../../src/app/config/parse-config";
import { resolveGameSetup, resolvePlayerProfile } from "../../../src/app/config/resolve-game-setup";
import { describeResolvedSetup } from "../../../src/app/config/describe-setup";
import { configDiagnostic } from "../../../src/app/config/error-codes";

function input(kind: "llm" | "acp" | "pi" = "llm") {
  return {
    backends: {
      schemaVersion: 2,
      items: {
        test: {
          kind,
          config:
            kind === "llm"
              ? { type: "openai", apiKey: "unused" }
              : kind === "acp"
                ? { command: "unused" }
                : { models: {}, auth: {} },
        },
      },
    },
    agents: {
      schemaVersion: 2,
      default: "main",
      items: {
        main: {
          backend: "test",
          options: kind === "llm" ? { model: "unused" } : {},
          customInstructions: { text: "AGENT_MAIN" },
        },
        other: {
          backend: "test",
          options: kind === "llm" ? { model: "other" } : {},
          customInstructions: { text: "AGENT_OTHER" },
        },
      },
    },
  };
}

for (const kind of ["llm", "acp", "pi"] as const) {
  test(`${kind}: selected Agent → global → role → seat; changing model retains role instructions`, () => {
    const setup = resolveGameSetup(
      parseRuntimeConfig({
        ...input(kind),
        game: {
          customInstructions: { text: "GAME" },
          roles: { wolf: { agent: "main", customInstructions: { text: "ROLE_WOLF" } } },
          players: { "1": { agent: "other", customInstructions: { text: "SEAT_1" } } },
        },
      }),
    );
    const profile = resolvePlayerProfile(setup, 1, Role.Wolf);
    expect(profile.name).toBe("other");
    expect(profile.kind).toBe(kind);
    expect(profile.customInstructions).toBe("AGENT_OTHER\n\nGAME\n\nROLE_WOLF\n\nSEAT_1");
    expect(resolvePlayerProfile(setup, 2, Role.Wolf).customInstructions).toBe(
      "AGENT_MAIN\n\nGAME\n\nROLE_WOLF",
    );
    expect(resolvePlayerProfile(setup, 3, Role.Villager).customInstructions).toBe(
      "AGENT_MAIN\n\nGAME",
    );
    expect(setup.defaultProfile.customInstructions).toBe("AGENT_MAIN");
    expect(setup.audit?.profile.customInstructions).toBe("AGENT_MAIN");
  });
}

for (const [roleInstructions, seatInstructions, expected] of [
  [{ text: "ROLE" }, { text: "SEAT" }, "AGENT_MAIN\n\nGAME\n\nROLE\n\nSEAT"],
  [{ mode: "replace", text: "ROLE" }, { text: "SEAT" }, "ROLE\n\nSEAT"],
  [{ mode: "clear" }, { text: "SEAT" }, "SEAT"],
  [{ text: "ROLE" }, { mode: "replace", text: "SEAT" }, "SEAT"],
  [{ text: "ROLE" }, { mode: "clear" }, undefined],
] as const) {
  test(`role ${"mode" in roleInstructions ? roleInstructions.mode : "append"} / seat ${"mode" in seatInstructions ? seatInstructions.mode : "append"} preserves ordered operations`, () => {
    const setup = resolveGameSetup(
      parseRuntimeConfig({
        ...input(),
        game: {
          customInstructions: { text: "GAME" },
          roles: { wolf: { customInstructions: roleInstructions } },
          players: { "1": { customInstructions: seatInstructions } },
        },
      }),
    );
    expect(setup.roles.wolf.profile).toBeUndefined();
    expect(resolvePlayerProfile(setup, 1, Role.Wolf).customInstructions).toBe(expected);
  });
}

test("global replace and clear operate on Agent defaults; omitted layers inherit", () => {
  for (const [instructions, expected] of [
    [undefined, "AGENT_MAIN"],
    [{ mode: "replace", text: "GLOBAL_ONLY" }, "GLOBAL_ONLY"],
    [{ mode: "clear" }, undefined],
  ] as const) {
    const setup = resolveGameSetup(
      parseRuntimeConfig({ ...input(), game: { customInstructions: instructions } }),
    );
    expect(resolvePlayerProfile(setup, 1).customInstructions).toBe(expected);
  }
});

test("each layer selects locale independently; raw whitespace and template-like text stay literal", () => {
  const runtime = input();
  runtime.agents.items.main.customInstructions = { text: { "zh-CN": "中文默认" } } as any;
  const setup = resolveGameSetup(
    parseRuntimeConfig({
      ...runtime,
      game: {
        locale: "en",
        customInstructions: { text: { en: "GAME_EN", "zh-CN": "GAME_ZH" } },
        roles: { wolf: { agent: "main", customInstructions: { text: { "zh-CN": "角色原文" } } } },
        players: {
          "1": { agent: "main", customInstructions: { text: "  ${NO_INTERPOLATION}\n" } },
        },
      },
    }),
  );
  expect(resolvePlayerProfile(setup, 1, Role.Wolf).customInstructions).toBe(
    "中文默认\n\nGAME_EN\n\n角色原文\n\n  ${NO_INTERPOLATION}\n",
  );
  expect(setup.warnings).toEqual([
    {
      code: "locale_prompt_fallback",
      path: "agents.items.main.customInstructions.text",
      requestedLocale: "en",
      fallbackLocale: "zh-CN",
    },
    {
      code: "locale_prompt_fallback",
      path: "roles.wolf.customInstructions.text",
      requestedLocale: "en",
      fallbackLocale: "zh-CN",
    },
  ]);
});

test("config summary exposes layer modes without text or credential values", () => {
  const setup = resolveGameSetup(
    parseRuntimeConfig({
      ...input(),
      game: {
        customInstructions: { text: "PRIVATE_GLOBAL" },
        roles: { wolf: { customInstructions: { mode: "replace", text: "PRIVATE_ROLE" } } },
        players: {
          "1": { customInstructions: { mode: "clear" } },
          "2": { customInstructions: { text: "PRIVATE_SEAT" } },
        },
      },
    }),
  );
  const summary = describeResolvedSetup(setup);
  expect(summary.customInstructions).toEqual({ mode: "append" });
  expect(summary.roles.wolf.customInstructions).toEqual({ mode: "replace" });
  expect(summary.players["1"].customInstructions).toEqual({ mode: "clear" });
  const output = JSON.stringify(summary);
  for (const secret of ["AGENT_MAIN", "PRIVATE_GLOBAL", "PRIVATE_ROLE", "PRIVATE_SEAT"])
    expect(output).not.toContain(secret);
});

for (const value of [
  null,
  "legacy string",
  {},
  { text: "" },
  { text: "  " },
  { text: {} },
  { text: { fr: "non-supported locale" } },
  { text: { en: "" } },
  { mode: "clear", text: "not allowed" },
  { mode: "replace" },
  { mode: "merge", text: "invalid mode" },
  { mode: null, text: "invalid null" },
  { text: "value", secret: "PRIVATE_ERROR_BODY" },
]) {
  test(`rejects malformed custom instructions ${JSON.stringify(value)}`, () => {
    for (const game of [
      { customInstructions: value },
      { roles: { wolf: { customInstructions: value } } },
      { players: { "1": { customInstructions: value } } },
    ]) {
      expect(() => parseRuntimeConfig({ ...input(), game })).toThrow();
      try {
        parseRuntimeConfig({ ...input(), game });
      } catch (error) {
        const diagnostic = configDiagnostic(error);
        expect(diagnostic.code).not.toBe("config_check_failed");
        expect(JSON.stringify(diagnostic)).not.toContain("PRIVATE_ERROR_BODY");
      }
    }
  });
}

test("normal loader rejects obsolete prompt and binding aliases", () => {
  for (const game of [
    { personalityPrompt: "old" },
    { playerAgents: {} },
    { roleAgents: {} },
    { players: { "1": { personalityPrompt: "old" } } },
    { roles: { wolf: { personalityPrompt: "old" } } },
  ])
    expect(() => parseRuntimeConfig({ ...input(), game })).toThrow("runtime_config_unknown_field");
});
