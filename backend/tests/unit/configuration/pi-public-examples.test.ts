/**
 * 配置单元测试以公开 Pi JSON、安装包公开 provider 工厂和字面四模型矩阵为输入，
 * 独立预期核对实际 chat 目录 ID、同 backend 共享及六／十二席绑定；不请求模型、不探测认证或创建会话。
 */
import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import type { Provider } from "@earendil-works/pi-ai";
import { parseRuntimeConfig } from "../../../src/app/config/parse-config";
import { checkConfig } from "../../../src/app/cli/check-config";
import { resolveGameSetup, resolvePlayerProfile } from "../../../src/app/config/resolve-game-setup";
import { loadBoardDefinition } from "../../../src/app/config/load-board-definition";
import path from "node:path";
const root = path.resolve(import.meta.dir, "../../../../configs.example");
const read = (name: string) => JSON.parse(readFileSync(path.join(root, name), "utf8"));
const expected = [
  ["pi_openai", "openai", "gpt-6-luna", "openai-responses", "openaiProvider"],
  ["pi_anthropic", "anthropic", "claude-sonnet-5-5", "anthropic-messages", "anthropicProvider"],
  ["pi_glm", "zai-coding-cn", "glm-5.3-flash", "openai-completions", "zaiCodingCnProvider"],
  ["pi_kimi", "kimi-coding", "k3", "openai-completions", "kimiCodingProvider"],
] as const;

test("public four-provider Pi profiles reference actual installed chat models under one backend", async () => {
  const runtime = parseRuntimeConfig({
    backends: read("runtime/backends.json"),
    agents: read("runtime/agents.json"),
    game: {},
    environment: {},
  });
  for (const [agentName, providerId, modelId, api, factoryName] of expected) {
    const agent = runtime.agents.items[agentName];
    expect(agent).toMatchObject({
      kind: "pi",
      provider: "pi_native",
      piSettings: { defaultProvider: providerId, defaultModel: modelId, cacheWarming: "off" },
    });
    // 使用 package exports 的公开工厂，仅取得打包静态 chat 目录；不创建 ModelRuntime 触发 auth 检查。
    const publicPath = `@earendil-works/pi-ai/providers/${providerId}`;
    const module = (await import(publicPath)) as Record<string, unknown>;
    const factory = module[factoryName];
    if (typeof factory !== "function") throw new Error("pi_public_provider_factory_missing");
    const provider = Reflect.apply(factory, undefined, []) as Provider;
    expect(provider.id).toBe(providerId);
    expect(provider.getModels().find((model) => model.id === modelId)).toMatchObject({
      provider: providerId,
      id: modelId,
      api,
    });
  }
  expect(runtime.agents.default).toBe("deepseek_v4_flash");
});

test("public six/twelve Pi game examples resolve every seat through real V2 config check", async () => {
  for (const [gameName, size] of [
    ["six_player_pi", 6],
    ["twelve_player_pi", 12],
  ] as const) {
    const game = read(`games/${gameName}.json`);
    expect(Object.keys(game.players)).toHaveLength(size);
    expect(Object.values(game.players).map((value) => (value as { agent: string }).agent)).toEqual(
      Array.from({ length: size }, (_, i) => expected[i % 4]![0]),
    );
    const setup = await checkConfig(root, gameName);
    expect(setup.defaultAgent).toMatchObject({
      name: "pi_default",
      kind: "pi",
      providerName: "pi_native",
    });
    expect(Object.values(setup.players).map((player) => player.agent?.kind)).toEqual(
      Array(size).fill("pi"),
    );
    expect(JSON.stringify(setup)).not.toContain("YOUR_PI_");
  }
});

test("catgirl Pi example gives every seat global instructions and appends individual bilingual styles", async () => {
  const game = read("games/twelve_player_pi_miao.json");
  const board = await loadBoardDefinition(root, game.board);
  for (const locale of ["zh-CN", "en"] as const) {
    const setup = resolveGameSetup(
      parseRuntimeConfig({
        backends: read("runtime/backends.json"),
        agents: read("runtime/agents.json"),
        game: { ...game, locale },
        environment: {},
      }),
      {},
      board,
    );
    expect(setup.warnings).toEqual([]);
    for (let actor = 1; actor <= 12; actor++) {
      const profile = resolvePlayerProfile(setup, actor);
      expect(profile.kind).toBe("pi");
      expect(profile.customInstructions).toContain(locale === "en" ? "catgirl" : "猫娘");
      expect(profile.customInstructions).toContain("喵");
      if (actor === 1)
        expect(profile.customInstructions).toContain(locale === "en" ? "sunbathing" : "晒太阳");
      if (actor === 2)
        expect(profile.customInstructions).toContain(locale === "en" ? "prickly" : "傲娇");
    }
    expect(resolvePlayerProfile(setup, 3).customInstructions).not.toContain(
      locale === "en" ? "sunbathing" : "晒太阳",
    );
  }
  const summary = await checkConfig(root, "twelve_player_pi_miao");
  expect(summary.customInstructions).toEqual({ mode: "append" });
  expect(JSON.stringify(summary)).not.toContain("catgirl");
});
