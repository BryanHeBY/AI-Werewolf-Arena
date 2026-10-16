/**
 * 配置单元测试以字面 V2 三传输、恶意字段和合成环境值验证唯一输入格式及脱敏边界。
 * 只执行纯解析与 setup 归一，不创建 SDK 会话、文件认证或模型请求；原生 Pi 设置字段由 SDK 拥有。
 */
import { expect, test } from "bun:test";
import { parseRuntimeConfig } from "../../../src/app/config/parse-config";
import {
  resolveAgentProfileByName,
  resolveGameSetup,
} from "../../../src/app/config/resolve-game-setup";
import { describeResolvedSetup } from "../../../src/app/config/describe-setup";

function source() {
  return {
    backends: {
      schemaVersion: 2,
      items: {
        sdk: {
          kind: "llm",
          config: { type: "openai", apiKey: "${TEST_LLM_SECRET}", baseURL: "${TEST_BASE_URL}" },
          limits: { maxConcurrentRequests: 3 },
        },
        pi: {
          kind: "pi",
          config: {
            models: {
              providers: {
                synthetic: {
                  baseUrl: "https://synthetic.invalid",
                  apiKey: "${TEST_PI_SECRET}",
                  api: "openai-completions",
                  models: [{ id: "test" }],
                },
              },
            },
            auth: { synthetic: { type: "api_key", key: "${TEST_PI_SECRET}" } },
          },
        },
        process: {
          kind: "acp",
          config: {
            transport: "stdio",
            command: "synthetic-acp",
            env: { TOKEN: "${TEST_ACP_SECRET}" },
          },
        },
      },
    },
    agents: {
      schemaVersion: 2,
      default: "sdk",
      items: {
        sdk: { backend: "sdk", options: { model: "test", reasoningEffort: "high" } },
        native: {
          backend: "pi",
          options: {
            defaultProvider: "synthetic",
            defaultModel: "test",
            defaultThinkingLevel: "medium",
            compaction: { enabled: false },
            futureNativeFlag: { value: [true, 0, null, "${TEST_PI_SECRET}"] },
          },
          personalityPrompt: "synthetic-secret-personality",
        },
        process: {
          backend: "process",
          options: { spawnArgs: ["--agent"], sessionConfigOptions: { "fast-mode": true } },
        },
      },
    },
    game: {},
    environment: {
      TEST_LLM_SECRET: "synthetic-llm",
      TEST_BASE_URL: "https://synthetic.invalid/v1",
      TEST_PI_SECRET: "synthetic-pi",
      TEST_ACP_SECRET: "synthetic-acp-key",
    },
  };
}

test("backend alone selects kind, native JSON preserves future settings and resolves whole-value environment strings", () => {
  const input = source(),
    runtime = parseRuntimeConfig(input);
  expect(runtime.providers.items.sdk).toMatchObject({
    type: "openai",
    apiKey: "synthetic-llm",
    baseURL: "https://synthetic.invalid/v1",
    maxConcurrentRequests: 3,
  });
  expect(runtime.providers.items.pi).toEqual({
    type: "pi",
    models: {
      providers: {
        synthetic: {
          baseUrl: "https://synthetic.invalid",
          apiKey: "synthetic-pi",
          api: "openai-completions",
          models: [{ id: "test" }],
        },
      },
    },
    auth: { synthetic: { type: "api_key", key: "synthetic-pi" } },
    maxConcurrentRequests: undefined,
  });
  const native = resolveAgentProfileByName(runtime, "native");
  expect(native.kind).toBe("pi");
  expect(native.piSettings).toMatchObject({
    defaultProvider: "synthetic",
    compaction: { enabled: false },
    futureNativeFlag: { value: [true, 0, null, "synthetic-pi"] },
  });
  expect(input.backends.items.pi.config.auth.synthetic.key).toBe("${TEST_PI_SECRET}");
  const acp = resolveAgentProfileByName(runtime, "process");
  expect(acp.provider).toMatchObject({
    type: "acp",
    env: { TOKEN: "synthetic-acp-key" },
    sessionConfigOptions: { "fast-mode": true },
  });
  expect(acp.spawnArgs).toEqual(["--agent"]);
  expect(runtime.providers.items.process).toMatchObject({ sessionConfigOptions: {} });
  const publicSummary = JSON.stringify(
    describeResolvedSetup(resolveGameSetup({ ...runtime, game: { agent: "native" } })),
  );
  expect(publicSummary).not.toContain("synthetic-pi");
  expect(publicSummary).not.toContain("futureNativeFlag");
  expect(publicSummary).not.toContain("synthetic-secret-personality");
});

test.each([
  {
    path: "backends.schemaVersion",
    change: (v: ReturnType<typeof source>) => Reflect.deleteProperty(v.backends, "schemaVersion"),
  },
  {
    path: "agents.schemaVersion",
    change: (v: ReturnType<typeof source>) => Reflect.set(v.agents, "schemaVersion", 1),
  },
  {
    path: "backends.default",
    change: (v: ReturnType<typeof source>) => Reflect.set(v.backends, "default", "sdk"),
  },
  {
    path: "agents.items.sdk.kind",
    change: (v: ReturnType<typeof source>) => Reflect.set(v.agents.items.sdk, "kind", "llm"),
  },
  {
    path: "agents.items.sdk.provider",
    change: (v: ReturnType<typeof source>) => Reflect.set(v.agents.items.sdk, "provider", "sdk"),
  },
  {
    path: "agents.items.sdk.options.maxToken",
    change: (v: ReturnType<typeof source>) =>
      Reflect.set(v.agents.items.sdk.options, "maxToken", 3),
  },
  {
    path: "backends.items.sdk.maxConcurrentRequests",
    change: (v: ReturnType<typeof source>) =>
      Reflect.set(v.backends.items.sdk, "maxConcurrentRequests", 3),
  },
  {
    path: "backends.items.sdk.limits.extra",
    change: (v: ReturnType<typeof source>) => Reflect.set(v.backends.items.sdk.limits, "extra", 1),
  },
  {
    path: "backends.items.process.config.sessionConfigOptions",
    change: (v: ReturnType<typeof source>) =>
      Reflect.set(v.backends.items.process.config, "sessionConfigOptions", {}),
  },
  {
    path: "agents.items.sdk.options",
    change: (v: ReturnType<typeof source>) => Reflect.set(v.agents.items.sdk, "options", null),
  },
  {
    path: "agents.items.sdk.backend",
    change: (v: ReturnType<typeof source>) =>
      Reflect.set(v.agents.items.sdk, "backend", "toString"),
  },
  {
    path: "backends.items.pi.config.models",
    change: (v: ReturnType<typeof source>) => Reflect.set(v.backends.items.pi.config, "models", []),
  },
])("strict V2 rejects $path", ({ path, change }) => {
  const input = source();
  change(input);
  expect(() => parseRuntimeConfig(input)).toThrow(path);
});

test("missing environment errors reveal field path only; partial placeholders stay literal", () => {
  const input = source();
  input.environment.TEST_PI_SECRET = "";
  let error: unknown;
  try {
    parseRuntimeConfig(input);
  } catch (thrown) {
    error = thrown;
  }
  expect(error).toBeInstanceOf(Error);
  expect((error as Error).message).toBe(
    "runtime_config_missing_environment_value: backends.items.pi.config.models.providers.synthetic.apiKey",
  );
  expect((error as Error).message).not.toContain("TEST_PI_SECRET");
  const literal = source();
  literal.backends.items.sdk.config.apiKey = "prefix-${TEST_LLM_SECRET}";
  expect(parseRuntimeConfig(literal).providers.items.sdk).toMatchObject({
    apiKey: "prefix-${TEST_LLM_SECRET}",
  });
});
