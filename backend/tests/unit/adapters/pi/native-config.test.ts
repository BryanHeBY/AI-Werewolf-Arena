/** 单元测试以字面 native JSON 核对有限内存配置约束，不读取个人认证或进行模型请求。 */
import { describe, expect, test } from "bun:test";
import { emptyPiResourceLoader } from "../../../../src/adapters/pi/empty-resource-loader";
import { validatePiHostConfig, validatePiSettings } from "../../../../src/adapters/pi";
import { PiRuntime } from "../../../../src/adapters/pi";
import { ModelRuntime } from "@earendil-works/pi-coding-agent";
import { InMemoryCredentialStore } from "@earendil-works/pi-ai";
import { registerNativePiModels } from "../../../../src/adapters/pi/native-config";
import { bindPiMemoryAuth, PiMemoryCredentials } from "../../../../src/adapters/pi/memory-auth";

const config = {
  models: {
    providers: {
      local: {
        api: "openai-completions",
        baseUrl: "http://127.0.0.1/v1",
        models: [{ id: "test" }],
      },
    },
  },
  auth: { local: { type: "api_key", key: "test" } },
};

describe("Pi native JSON 的显式有限边界", () => {
  test("保留并脱离调用方 JSON，不更名 native 字段", () => {
    const result = validatePiHostConfig(config);
    expect(result).toEqual(config);
    expect(result).not.toBe(config);
    expect(result.models).not.toBe(config.models);
    expect(result.auth).not.toBe(config.auth);
  });
  test("命令型 key/header、radius、未知字段都不能静默忽略", () => {
    for (const patch of [
      { apiKey: "!touch /tmp/never" },
      { headers: { authorization: "!never" } },
      { oauth: "radius" },
      { unknownCapability: true },
    ]) {
      expect(() =>
        validatePiHostConfig({
          ...config,
          models: { providers: { local: { ...config.models.providers.local, ...patch } } },
        }),
      ).toThrow();
    }
  });
  test("必须显式模型，拒绝资源/工具发现及预热请求", () => {
    expect(() => validatePiSettings()).toThrow("pi_settings_model_required");
    for (const patch of [
      { packages: ["some-package"] },
      { extensions: ["./ext.ts"] },
      { defaultTools: ["bash"] },
      { mcpServers: { other: {} } },
      { cacheWarming: "idle" },
    ]) {
      expect(() =>
        validatePiSettings({ defaultProvider: "local", defaultModel: "test", ...patch }),
      ).toThrow();
    }
    expect(
      validatePiSettings({
        defaultProvider: "local",
        defaultModel: "test",
        defaultThinkingLevel: "high",
      }),
    ).toEqual({
      defaultProvider: "local",
      defaultModel: "test",
      defaultThinkingLevel: "high",
      cacheWarming: "off",
    });
  });
  test("资源loader明确空且不会扩展路径", async () => {
    const loader = emptyPiResourceLoader("原始规则");
    await loader.reload();
    expect(loader.getAgentsFiles()).toEqual({ agentsFiles: [] });
    expect(loader.getSkills()).toEqual({ skills: [], diagnostics: [] });
    expect(loader.getExtensions().extensions).toEqual([]);
    expect(loader.getSystemPrompt()).toBe("原始规则");
    expect(() =>
      loader.extendResources({
        skillPaths: [
          { path: "/tmp/no", metadata: { source: "local", scope: "project", origin: "top-level" } },
        ],
      }),
    ).toThrow("pi_resources_disabled");
  });
  test("原生空 models 加显式内置 auth 能建立内存会话，无模型请求", async () => {
    const runtime = await PiRuntime.create({
      models: {},
      auth: { openai: { type: "api_key", key: "synthetic" } },
    });
    try {
      const session = await runtime.createSession({
        settings: { defaultProvider: "openai", defaultModel: "gpt-4o" },
        systemPrompt: "规则",
        tools: [],
      });
      expect(session.runtimeState).toEqual({ closed: false, pending: 0 });
      expect(runtime.runtimeState.sessions).toBe(1);
    } finally {
      await runtime.close();
    }
    expect(runtime.runtimeState).toEqual({
      closed: true,
      sessions: 0,
      creating: 0,
      pending: 0,
      credentialOperations: 0,
    });
  });
  test("models.json 原生默认与嵌套 overrides 不丢兄弟字段", async () => {
    const runtime = await ModelRuntime.create({
      credentials: new InMemoryCredentialStore(),
      modelsPath: null,
      refreshOnCreate: false,
    });
    const native = validatePiHostConfig({
      models: {
        providers: {
          local: {
            api: "openai-completions",
            baseUrl: "http://127.0.0.1/v1",
            compat: { openRouterRouting: { order: ["a"], only: ["b"] } },
            models: [
              {
                id: "test",
                inputLimits: {
                  images: { resize: { maxWidth: 800, maxHeight: 600 }, maxPerMessage: 2 },
                },
                samplingParamsByThinkingLevel: { high: { temperature: 0.1, top_p: 0.9 } },
              },
            ],
            modelOverrides: {
              test: {
                name: "覆盖后",
                cost: { input: 2 },
                compat: { openRouterRouting: { only: ["c"] } },
                inputLimits: { images: { resize: { maxWidth: 400 } } },
                samplingParamsByThinkingLevel: { high: { temperature: 0.2 } },
              },
            },
          },
        },
      },
      auth: {},
    });
    registerNativePiModels(runtime, native.models);
    const model = runtime.getModel("local", "test")!;
    expect(model.name).toBe("覆盖后");
    expect(model.contextWindow).toBe(128000);
    expect(model.maxTokens).toBe(16384);
    expect(model.cost).toEqual({ input: 2, output: 0, cacheRead: 0, cacheWrite: 0 });
    expect(
      model.compat && "openRouterRouting" in model.compat
        ? model.compat.openRouterRouting
        : undefined,
    ).toEqual({ order: ["a"], only: ["c"] });
    expect(model.inputLimits).toEqual({
      images: { resize: { maxWidth: 400, maxHeight: 600 }, maxPerMessage: 2 },
    });
    expect(model.samplingParamsByThinkingLevel?.high).toEqual({ temperature: 0.2, top_p: 0.9 });
  });
  test("全部认证扫描仅用注入 credential.env，未授权 provider 连 resolver 都不调用", async () => {
    const credentials = new InMemoryCredentialStore();
    await credentials.modify("memory-canary", async () => ({
      type: "api_key",
      key: "synthetic",
      env: { ALLOWED: "injected" },
    }));
    const runtime = await ModelRuntime.create({
      credentials,
      modelsPath: null,
      refreshOnCreate: false,
    });
    const observed: unknown[] = [];
    let forbidden = 0;
    runtime.registerNativeProvider({
      id: "memory-canary",
      name: "canary",
      getModels: () => [],
      stream: () => {
        throw new Error("unused");
      },
      streamSimple: () => {
        throw new Error("unused");
      },
      auth: {
        apiKey: {
          name: "memory",
          resolve: async ({ ctx, credential }) => {
            observed.push([
              await ctx.env("ALLOWED"),
              await ctx.env("PATH"),
              await ctx.fileExists("~/.config/gcloud/application_default_credentials.json"),
            ]);
            return credential?.key ? { auth: { apiKey: credential.key } } : undefined;
          },
        },
      },
    });
    runtime.registerNativeProvider({
      id: "forbidden-canary",
      name: "forbidden",
      getModels: () => [],
      stream: () => {
        throw new Error("unused");
      },
      streamSimple: () => {
        throw new Error("unused");
      },
      auth: {
        apiKey: {
          name: "forbidden",
          resolve: async () => {
            forbidden++;
            throw new Error("must-not-check-ambient");
          },
        },
      },
    });
    bindPiMemoryAuth(runtime, new Set(["memory-canary"]));
    await runtime.refresh({ allowNetwork: false });
    expect(forbidden).toBe(0);
    expect(observed.length).toBeGreaterThan(0);
    expect(observed.every((value) => JSON.stringify(value) === '["injected",null,false]')).toBe(
      true,
    );
    expect((await runtime.getAuth("memory-canary"))?.auth.apiKey).toBe("synthetic");
  });
  test("取消只结束调用方等待，已开始的认证刷新仍由关闭真实等待并传播原错", async () => {
    const store = new PiMemoryCredentials();
    let entered!: () => void;
    const entry = new Promise<void>((resolve) => {
      entered = resolve;
    });
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const controller = new AbortController();
    const aborted = new Error("auth-wait-cancelled");
    const cleanup = new Error("refresh-late-failed");
    const work = store.modify(
      "oauth",
      async () => {
        entered();
        await gate;
        throw cleanup;
      },
      { signal: controller.signal },
    );
    const observed = work.catch((error) => error);
    await entry;
    controller.abort(aborted);
    expect(await observed).toBe(aborted);
    expect(store.pending).toBe(1);
    let settled = false;
    const close = store.settle().then(
      () => {
        settled = true;
      },
      (error) => {
        settled = true;
        return error;
      },
    );
    await Promise.resolve();
    expect(settled).toBe(false);
    release();
    expect(await close).toBe(cleanup);
    expect(store.pending).toBe(0);
  });
  test("立即 settle 也包含还未进入回调的认证写和同 provider 后继队列", async () => {
    const store = new PiMemoryCredentials();
    let releaseA!: () => void;
    const a = new Promise<void>((resolve) => {
      releaseA = resolve;
    });
    let releaseB!: () => void;
    const b = new Promise<void>((resolve) => {
      releaseB = resolve;
    });
    const started: string[] = [];
    const first = store.modify("same", async () => {
      started.push("a");
      await a;
      return { type: "api_key", key: "a" };
    });
    const second = store.modify("same", async () => {
      started.push("b");
      await b;
      return { type: "api_key", key: "b" };
    });
    expect(store.pending).toBe(2);
    let settled = false;
    const closing = store.settle().then(() => {
      settled = true;
    });
    await Promise.resolve();
    expect(settled).toBe(false);
    releaseA();
    await first;
    for (let i = 0; i < 8; i++) await Promise.resolve();
    expect(started).toEqual(["a", "b"]);
    expect(settled).toBe(false);
    expect(store.pending).toBe(1);
    releaseB();
    await second;
    await closing;
    expect(settled).toBe(true);
    expect((await store.read("same"))?.type).toBe("api_key");
    expect(store.pending).toBe(0);
  });
});
