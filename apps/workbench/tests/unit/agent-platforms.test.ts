/** 单元测试负责平台向导原生配置的反例验证。输入合成凭据与覆盖，输出原生对象断言；不访问模型、认证文件或网络。 */
import { describe, expect, test } from "bun:test";
import {
  buildConnection,
  buildAgentOptions,
  compatibleConnection,
  requiresCodexImport,
  changeThinking,
  thinkingValue,
  connectionTier,
  nativeModelTier,
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
    const codex = input("codex").platform;
    expect(
      requiresCodexImport(codex, { name: "partial", kind: "pi", providers: ["openai-codex"] }),
    ).toBe(true);
    expect(
      requiresCodexImport(codex, { name: "ready", kind: "pi", authProviders: ["openai-codex"] }),
    ).toBe(false);
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
test("unspecified thinking stays absent and editing a model override changes its effective value", () => {
  const options = buildAgentOptions(input("openai").platform, "openai", "test", "", {
    modelThinkingLevels: { "openai/test": "high", "openai/other": "medium" },
  });
  expect(Object.hasOwn(options, "defaultThinkingLevel")).toBe(false);
  expect(thinkingValue("pi", "openai", "test", options)).toBe("high");
  const edited = changeThinking("pi", "openai", "test", options, "low");
  expect(thinkingValue("pi", "openai", "test", edited)).toBe("low");
  expect(edited.modelThinkingLevels).toEqual({ "openai/other": "medium" });
  const inherited = changeThinking("pi", "openai", "test", edited, "");
  expect(thinkingValue("pi", "openai", "test", inherited)).toBe("");
  expect(edited.defaultThinkingLevel).toBe("low");
});
test("native fields conflicting with form controls are rejected rather than overwritten", () => {
  expect(() =>
    buildAgentOptions(input("openai").platform, "openai", "test", "low", {
      defaultThinkingLevel: "high",
    }),
  ).toThrow("native_field_conflict: defaultThinkingLevel");
  expect(() =>
    buildConnection(
      input("compatible", { baseURL: "https://synthetic.invalid", native: '{"type":"anthropic"}' }),
    ),
  ).toThrow("native_field_conflict: type");
  expect(() =>
    buildConnection(
      input("openai", {
        baseURL: "https://synthetic.invalid",
        native: '{"models":{"providers":{"openai":{"baseUrl":"https://other.invalid"}}}}',
      }),
    ),
  ).toThrow("native_field_conflict: models.providers.baseUrl");
});
test("connection limits distinguish runtime defaults from explicit positive values", () => {
  const omitted = buildConnection(input("acp"));
  expect(omitted.limits).toBeUndefined();
  expect((omitted.config as Record<string, unknown>).initializeTimeoutMs).toBeUndefined();
  expect(
    buildConnection(input("acp", { maxConcurrentRequests: "4", initializeTimeoutMs: "60000" })),
  ).toMatchObject({ limits: { maxConcurrentRequests: 4 }, config: { initializeTimeoutMs: 60000 } });
  expect(() => buildConnection(input("acp", { maxConcurrentRequests: "0" }))).toThrow(
    "positive_integer_required",
  );
  expect(() => buildConnection(input("acp", { initializeTimeoutMs: "0.5" }))).toThrow(
    "positive_integer_required",
  );
});
test("fast request tiers are specific to a provider and model in a shared connection", () => {
  const connection = {
    name: "shared",
    kind: "pi",
    modelTiers: { "openai-codex": { one: "priority" } },
  };
  expect(connectionTier(connection, "openai-codex", "one")).toBe("priority");
  expect(connectionTier(connection, "openai-codex", "two")).toBe("");
  expect(connectionTier(connection, "openai", "one")).toBe("");
  expect(() =>
    buildConnection(
      input("codex", {
        fast: true,
        native:
          '{"models":{"providers":{"openai-codex":{"modelOverrides":{"synthetic-model":{"samplingParams":{"service_tier":"flex"}}}}}}}',
      }),
    ),
  ).toThrow("native_field_conflict");
});
test("native request tier inherits a model declaration and an override takes precedence", () => {
  const native = {
    models: {
      providers: {
        "openai-codex": {
          models: [{ id: "one", samplingParams: { service_tier: "priority" } }],
          modelOverrides: { one: { samplingParams: { temperature: 0.4 } } },
        },
      },
    },
  };
  expect(nativeModelTier(native, "openai-codex", "one")).toBe("priority");
  expect(
    nativeModelTier(
      {
        models: {
          providers: {
            "openai-codex": {
              ...native.models.providers["openai-codex"],
              modelOverrides: { one: { samplingParams: { service_tier: "flex" } } },
            },
          },
        },
      },
      "openai-codex",
      "one",
    ),
  ).toBe("flex");
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
