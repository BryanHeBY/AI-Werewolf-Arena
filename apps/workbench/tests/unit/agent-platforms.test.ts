/** 单元测试负责平台向导原生配置的反例验证。输入合成凭据与覆盖，输出原生对象断言；不访问模型、认证文件或网络。 */
import { describe, expect, test } from "bun:test";
import {
  buildConnection,
  buildAgentOptions,
  compatibleConnection,
  platforms,
  type PlatformInput,
} from "../../src/client/agent-platforms";

function input(id: string, overrides: Partial<PlatformInput> = {}): PlatformInput {
  const platform = platforms.find((platform) => platform.id === id)!;
  return {
    platform,
    provider: platform.provider,
    model: "synthetic-model",
    key: "synthetic-key",
    baseURL: "",
    fast: false,
    command: "synthetic-acp",
    args: "[]",
    env: "{}",
    native: "{}",
    ...overrides,
  };
}
describe("Pi native defaults", () => {
  for (const id of ["openai", "codex", "anthropic", "zhipu", "kimi"])
    test(`${id} keeps the SDK endpoint omitted`, () => {
      const values = input(id);
      const backend = buildConnection(values);
      expect(backend).toMatchObject({ kind: "pi", config: { models: { providers: {} } } });
      expect(JSON.stringify(backend)).not.toContain("baseUrl");
      const options = buildAgentOptions(values.platform, values.provider, values.model, "low", {
        temperature: 0.5,
      });
      expect(options).toMatchObject({
        defaultProvider: values.provider,
        defaultModel: "synthetic-model",
        defaultTools: [],
        cacheWarming: "off",
        temperature: 0.5,
      });
    });
  test("native proxy and model defaults merge without replacing unrelated providers", () => {
    expect(
      buildConnection(
        input("codex", {
          fast: true,
          baseURL: "https://synthetic.invalid/v1",
          native: JSON.stringify({
            models: {
              providers: {
                anthropic: { baseUrl: "https://other.invalid" },
                "openai-codex": {
                  modelOverrides: { "synthetic-model": { samplingParams: { temperature: 0.7 } } },
                },
              },
            },
          }),
        }),
      ),
    ).toMatchObject({
      config: {
        models: {
          providers: {
            anthropic: { baseUrl: "https://other.invalid" },
            "openai-codex": {
              baseUrl: "https://synthetic.invalid/v1",
              modelOverrides: {
                "synthetic-model": {
                  samplingParams: { temperature: 0.7, service_tier: "priority" },
                },
              },
            },
          },
        },
      },
    });
  });
  test("a shared kind does not imply compatible credentials", () => {
    const platform = input("zhipu").platform;
    expect(
      compatibleConnection(
        { name: "openai_only", kind: "pi", authProviders: ["openai"] },
        platform,
      ),
    ).toBe(false);
    expect(
      compatibleConnection(
        { name: "shared", kind: "pi", authProviders: ["openai", "zai-coding-cn"] },
        platform,
      ),
    ).toBe(true);
    expect(compatibleConnection(undefined, platform)).toBe(false);
  });
  test("native custom providers and environment placeholders stay unexpanded", () => {
    const backend = buildConnection(
      input("pi-native", {
        provider: "local",
        key: "${LOCAL_KEY}",
        native:
          '{"models":{"providers":{"local":{"baseUrl":"http://localhost:1234/v1","api":"openai-completions","models":[{"id":"local-model"}]}}}}',
      }),
    );
    expect(JSON.stringify(backend)).toContain("${LOCAL_KEY}");
    expect(backend).toMatchObject({
      config: { models: { providers: { local: { api: "openai-completions" } } } },
    });
  });
});
test("LLM and ACP preserve their own transport options and reject invalid maps", () => {
  expect(buildConnection(input("compatible", { baseURL: "http://localhost/v1" }))).toMatchObject({
    kind: "llm",
    config: { type: "openai", baseURL: "http://localhost/v1" },
  });
  expect(
    buildConnection(input("acp", { args: '["--stdio"]', env: '{"SAFE":"value"}' })),
  ).toMatchObject({ kind: "acp", config: { args: ["--stdio"], env: { SAFE: "value" } } });
  expect(() => buildConnection(input("acp", { env: '{"BAD":1}' }))).toThrow("invalid_environment");
  expect(() => buildConnection(input("compatible"))).toThrow("connection_fields_required");
});
