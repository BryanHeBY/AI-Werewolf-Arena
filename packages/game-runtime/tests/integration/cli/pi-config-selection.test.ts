/** 集成测试负责 Pi 配置交叉检查；输入合成连接与模型，按手写预期独立断言保存前错误、目录隔离及自定义注册，不执行模型请求。 */
import { expect, test } from "bun:test";
import { parseRuntimeCatalog } from "../../../src/app/config/parse-config";
import { validateRuntimeNativeConfig } from "../../../src/app/config/validate-runtime-config";

function fixture() {
  const auth = (provider: string) => ({ [provider]: { type: "api_key", key: "synthetic-only" } });
  return {
    backends: {
      schemaVersion: 2,
      items: {
        openai: { kind: "pi", config: { models: {}, auth: auth("openai") } },
        anthropic: { kind: "pi", config: { models: {}, auth: auth("anthropic") } },
      },
    },
    agents: {
      schemaVersion: 2,
      default: "a",
      items: {
        a: {
          backend: "openai",
          options: { defaultProvider: "openai", defaultModel: "gpt-6-luna" },
        },
      },
    },
  };
}
test("Pi selection rejects another connection's provider before session creation", async () => {
  const raw = fixture();
  raw.agents.items.a.backend = "anthropic";
  await expect(validateRuntimeNativeConfig(parseRuntimeCatalog(raw))).rejects.toMatchObject({
    code: "pi_provider_not_configured",
    fieldPath: "agents.items.a.options.defaultProvider",
  });
});
test("Pi selection accepts bundled IDs and rejects an unregistered model with a safe field path", async () => {
  const raw = fixture();
  await validateRuntimeNativeConfig(parseRuntimeCatalog(raw));
  raw.agents.items.a.options.defaultModel = "not-a-registered-model";
  await expect(validateRuntimeNativeConfig(parseRuntimeCatalog(raw))).rejects.toMatchObject({
    code: "pi_model_not_found",
    fieldPath: "agents.items.a.options.defaultModel",
  });
});
test("a custom model is available only in the connection which declares it", async () => {
  const raw = fixture();
  raw.backends.items.openai.config.models = {
    providers: { openai: { models: [{ id: "custom-local" }] } },
  };
  raw.agents.items.a.options.defaultModel = "custom-local";
  await validateRuntimeNativeConfig(parseRuntimeCatalog(raw));
  raw.backends.items.anthropic.config.auth = { openai: { type: "api_key", key: "synthetic-only" } };
  raw.agents.items.a.backend = "anthropic";
  await expect(validateRuntimeNativeConfig(parseRuntimeCatalog(raw))).rejects.toMatchObject({
    code: "pi_model_not_found",
  });
});
