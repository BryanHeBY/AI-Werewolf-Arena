/**
 * 单元测试在原生传输启动前，以原字面 profile、本地 bootstrap 及未使用的 SDK 工作区路径核对 SDK 策略选择与 ACP 正并发数严格解析。原 factory describe 内的手写策略及精确预算错误为预期；回调不创建 listener、子进程或工作区文件。
 */
import { runtimeConfigV2 } from "../../support/builders/runtime-config-v2";
import { describe, expect, test } from "bun:test";
import { tmpdir } from "node:os";
import * as path from "node:path";
import { bootstrapGame } from "../../../src/app/bootstrap";
import { createPlayerAgentRuntime } from "../../../src/app/player-agent-factory";
import { ResolvedAgentRuntimeProfile } from "../../../src/app/config/contracts";
import { sixPlayerMvpConfig } from "../../../src/rulesets/presets/six-player-mvp";

function baseOptions(profilesByActor: Map<number, ResolvedAgentRuntimeProfile>, root: string) {
  const context = bootstrapGame(sixPlayerMvpConfig);
  return {
    world: context.world,
    boardConfig: sixPlayerMvpConfig,
    profilesByActor,
    acpWorkspaceRoot: root,
    llmTimeoutMs: 1000,
    trace: false,
    colorizeLogs: false,
    printLlmIo: false,
    printThinking: false,
  };
}

const llmProfile: ResolvedAgentRuntimeProfile = {
  name: "test-llm",
  providerName: "test-openai",
  kind: "llm",
  model: "test-model",
  provider: { type: "openai", apiKey: "test-key" },
};

describe("createPlayerAgentRuntime", () => {
  test("selects the SDK strategy without exposing client construction", async () => {
    const runtime = await createPlayerAgentRuntime(
      baseOptions(new Map([[1, llmProfile]]), path.join(tmpdir(), "unused-sdk-workspace")),
    );
    expect(runtime.kind).toBe("llm");
    expect(typeof runtime.provider.getAction).toBe("function");
    await runtime.close();
  });
});

test("ACP providers accept the same strict positive concurrency field as SDK providers", async () => {
  const { parseRuntimeConfig } = await import("../../../src/app/config/parse-config");
  const input = (limit: unknown) => ({
    providers: {
      default: "acp",
      items: {
        acp: {
          type: "acp",
          transport: "stdio",
          command: "/bin/false",
          maxConcurrentRequests: limit,
        },
      },
    },
    agents: { default: "acp", items: { acp: { kind: "acp", provider: "acp" } } },
    game: {},
  });
  expect(
    parseRuntimeConfig(runtimeConfigV2(input(2))).providers.items.acp.maxConcurrentRequests,
  ).toBe(2);
  for (const value of [0, -1, 1.5, "2", Infinity])
    expect(() => parseRuntimeConfig(runtimeConfigV2(input(value)))).toThrow(
      "runtime_config_positive_integer_invalid",
    );
});

test("ACP 同后端的逐 Agent 会话设置可不同，真实连接差异仍拒绝", async () => {
  const { createTestTempDirectory } = await import("../../support/drivers/temp-directories");
  const root = await createTestTempDirectory("awa-acp-agent-settings-");
  const profile = (fast: boolean): ResolvedAgentRuntimeProfile => ({
    name: `acp-${fast}`,
    kind: "acp",
    providerName: "shared",
    provider: {
      type: "acp",
      transport: "stdio",
      command: "/bin/false",
      args: [],
      env: {},
      sessionConfigOptions: { "fast-mode": fast },
    },
  });
  const first = profile(true),
    second = profile(false);
  const runtime = await createPlayerAgentRuntime(
    baseOptions(
      new Map([
        [1, first],
        [2, second],
      ]),
      root,
    ),
  );
  expect(runtime.kind).toBe("acp");
  await runtime.close();
  const invalid = profile(false);
  if (invalid.provider.type === "acp") invalid.provider.command = "/bin/true";
  await expect(
    createPlayerAgentRuntime(
      baseOptions(
        new Map([
          [1, first],
          [2, invalid],
        ]),
        root,
      ),
    ),
  ).rejects.toThrow("runtime_config_provider_binding_inconsistent");
});

test("Pi 与 LLM、ACP 同局独立装配和关闭，不要求 Pi 文件或默认工具", async () => {
  const { createTestTempDirectory } = await import("../../support/drivers/temp-directories");
  const root = await createTestTempDirectory("awa-three-agent-backends-");
  const profiles = new Map<number, ResolvedAgentRuntimeProfile>([
    [1, llmProfile],
    [
      2,
      {
        name: "pi",
        kind: "pi",
        providerName: "pi",
        provider: {
          type: "pi",
          models: { providers: {} },
          auth: { openai: { type: "api_key", key: "synthetic-not-sent" } },
        },
        piSettings: { defaultProvider: "openai", defaultModel: "gpt-5.4" },
      },
    ],
    [
      3,
      {
        name: "acp",
        kind: "acp",
        providerName: "acp",
        provider: {
          type: "acp",
          transport: "stdio",
          command: "/bin/false",
          args: [],
          env: {},
          sessionConfigOptions: {},
        },
      },
    ],
  ]);
  const runtime = await createPlayerAgentRuntime(baseOptions(profiles, root));
  expect(runtime.kind).toBe("mixed");
  expect(runtime.runtimeState.pi).toHaveLength(1);
  await runtime.close();
  expect(runtime.runtimeState).toMatchObject({
    closed: true,
    sdk: { closed: true },
    acp: [{ closed: true }],
    pi: [{ closed: true, sessions: 0, turns: 0, creating: 0, scheduler: { active: 0, queued: 0 } }],
  });
});
