/**
 * Runtime factory integration verify SDK/ACP selection, mixed routing and cleanup ownership.
 * Input: Resolved actor/provider bindings, injected client/close failures and temporary workspaces.
 * Output and independent oracle: Selected strategy, immutable budget/binding behavior, scheduler counts and preserved cleanup error identities.
 * The test never calls a billed model or rewrites expected fixture/Tape bytes.
 */
import { describe, expect, spyOn, test } from "bun:test";
import { promises as fs } from "node:fs";
import { tmpdir } from "node:os";
import * as path from "node:path";
import { createTestTempDirectory } from "../../support/drivers/temp-directories";
import { bootstrapGame } from "../../../src/app/bootstrap";
import { createPlayerAgentRuntime } from "../../../src/runtime/player_agent_factory";
import { ResolvedAgentRuntimeProfile } from "../../../src/runtime/config/contracts";
import { sixPlayerMvpConfig } from "../../../src/runtime/scenarios/six_player_mvp";

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

const acpProfile: ResolvedAgentRuntimeProfile = {
  name: "test-acp",
  providerName: "test-acp-provider",
  kind: "acp",
  provider: {
    type: "acp",
    transport: "stdio",
    command: "/bin/false",
    args: [],
    env: {},
    sessionConfigOptions: {},
  },
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

  test("selects ACP and owns its workspace lifecycle boundary", async () => {
    const root = await createTestTempDirectory("awa-player-factory-");
    const workspace = path.join(root, "acp-workspaces");
    const runtime = await createPlayerAgentRuntime(
      baseOptions(new Map([[1, acpProfile]]), workspace),
    );
    expect(runtime.kind).toBe("acp");
    expect((await fs.stat(workspace)).isDirectory()).toBe(true);
    await runtime.close();
  });

  test("routes mixed transports by the configured actor and closes both owners", async () => {
    const root = await createTestTempDirectory("awa-mixed-factory-");
    const runtime = await createPlayerAgentRuntime(
      baseOptions(
        new Map([
          [1, llmProfile],
          [2, acpProfile],
        ]),
        root,
      ),
    );
    expect(runtime.kind).toBe("mixed");
    expect(runtime.runtimeState.sdk).toBeDefined();
    expect(runtime.runtimeState.acp).toHaveLength(1);
    await expect(runtime.provider.getAction({ actorId: 999 } as any)).rejects.toThrow(
      "runtime_config_agent_profile_missing_for_actor:999",
    );
    await runtime.close();
    expect(runtime.runtimeState.closed).toBe(true);
    expect(runtime.runtimeState.sdk!.scheduler).toEqual({ closed: true, active: 0, queued: 0 });
    expect(runtime.runtimeState.acp![0].scheduler).toEqual({ closed: true, active: 0, queued: 0 });
    await expect(runtime.provider.getAction({ actorId: 1 } as any)).rejects.toThrow(
      "player_runtime_closed",
    );
  });
});

test("mixed close preserves SDK and ACP cleanup errors without skipping another owner", async () => {
  const { LlmActionProvider } = await import("../../../src/ai/agents/llm/llm_action_provider");
  const { AcpActionProvider } = await import("../../../src/ai/agents/acp/acp_action_provider");
  const sdkError = new Error("sdk-close"),
    acpError = new Error("acp-close");
  const sdk = spyOn(LlmActionProvider.prototype, "close").mockRejectedValue(sdkError);
  const acp = spyOn(AcpActionProvider.prototype, "close").mockRejectedValue(acpError);
  try {
    const runtime = await createPlayerAgentRuntime(
      baseOptions(
        new Map([
          [1, llmProfile],
          [2, acpProfile],
        ]),
        await createTestTempDirectory("awa-mixed-errors-"),
      ),
    );
    const failed = await runtime.close().then(
      () => null,
      (error) => error,
    );
    expect(failed.errors[0]).toBe(sdkError);
    expect(failed.errors[1].errors).toEqual([acpError]);
    expect(sdk).toHaveBeenCalledTimes(1);
    expect(acp).toHaveBeenCalledTimes(1);
  } finally {
    sdk.mockRestore();
    acp.mockRestore();
  }
});

test("ACP providers accept the same strict positive concurrency field as SDK providers", async () => {
  const { parseRuntimeConfig } = await import("../../../src/runtime/config/parse_config");
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
  expect(parseRuntimeConfig(input(2)).providers.items.acp.maxConcurrentRequests).toBe(2);
  for (const value of [0, -1, 1.5, "2", Infinity])
    expect(() => parseRuntimeConfig(input(value))).toThrow(
      "runtime_config_positive_integer_invalid",
    );
});

test("factory snapshots caller bindings and provider budgets for the lifetime of this game", async () => {
  const { AiSdkClient } = await import("../../../src/ai/integrations/llm/ai_sdk_client");
  let ready!: () => void,
    release!: () => void,
    started = 0;
  const began = new Promise<void>((done) => {
      ready = done;
    }),
    held = new Promise<void>((done) => {
      release = done;
    });
  const loop = spyOn(AiSdkClient.prototype, "runToolLoop").mockImplementation(
    async (messages: any, _schemas: any, callbacks: any) => {
      started++;
      ready();
      await held;
      const turn = /(?:turn_id must be |turn_id 必须为 )(t\d+)/.exec(messages.at(-1).content)![1];
      const accepted = await callbacks.onToolCall({
        id: "snapshot",
        name: "submit_action",
        rawArgs: "{}",
        args: { turn_id: turn, action: "speak", arguments: { text: "snapshot" } },
      });
      return {
        finalAction: accepted.finalAction,
        assistantText: "",
        thinkingTrace: [],
        failedToolInvocations: [],
      };
    },
  );
  const sourceProvider = { ...llmProfile.provider, maxConcurrentRequests: 1 },
    first = { ...llmProfile, provider: sourceProvider },
    third = { ...llmProfile, provider: sourceProvider };
  const source = new Map([
    [1, first],
    [3, third],
  ]);
  const runtime = await createPlayerAgentRuntime(
    baseOptions(source, await createTestTempDirectory("awa-snapshot-")),
  );
  const action = (actorId: number) =>
    ({
      actorId,
      phase: "day",
      allowedTools: ["speak"],
      context: {
        day: 1,
        stage: "day_speech",
        visible_events: [],
        turn_constraints: { min_valid_actions: 1, max_valid_actions: 1 },
      },
    }) as any;
  try {
    sourceProvider.maxConcurrentRequests = 2;
    first.kind = "acp" as any;
    first.providerName = "mutated";
    source.delete(3);
    source.set(5, third);
    const one = runtime.provider.getAction(action(1));
    await began;
    const three = runtime.provider.getAction(action(3));
    await Promise.resolve();
    expect(started).toBe(1);
    expect(runtime.runtimeState.sdk!.scheduler).toEqual({ closed: false, active: 1, queued: 1 });
    await expect(runtime.provider.getAction(action(5))).rejects.toThrow(
      "runtime_config_agent_profile_missing_for_actor:5",
    );
    release();
    expect((await Promise.all([one, three])).map((value) => value?.name)).toEqual([
      "speak",
      "speak",
    ]);
    expect(started).toBe(2);
  } finally {
    release();
    loop.mockRestore();
    await runtime.close();
  }
});

test("same provider name requires one consistent configuration, and partial initialization preserves both errors", async () => {
  const { LlmActionProvider } = await import("../../../src/ai/agents/llm/llm_action_provider");
  const { promises: files } = await import("node:fs");
  const root = await createTestTempDirectory("awa-partial-runtime-");
  await expect(
    createPlayerAgentRuntime(
      baseOptions(
        new Map([
          [1, llmProfile],
          [2, { ...llmProfile, provider: { ...llmProfile.provider, maxConcurrentRequests: 2 } }],
        ]),
        root,
      ),
    ),
  ).rejects.toThrow("runtime_config_provider_binding_inconsistent");
  const blocked = path.join(root, "file");
  await files.writeFile(blocked, "fixture");
  const cleanup = new Error("partial-sdk-close");
  const close = spyOn(LlmActionProvider.prototype, "close").mockRejectedValue(cleanup);
  try {
    const failed = await createPlayerAgentRuntime(
      baseOptions(
        new Map([
          [1, llmProfile],
          [2, acpProfile],
        ]),
        blocked,
      ),
    ).then(
      () => null,
      (error) => error,
    );
    expect(failed).toBeInstanceOf(AggregateError);
    expect(failed.errors[0].code).toBe("EEXIST");
    expect(failed.errors[1]).toBe(cleanup);
    expect(close).toHaveBeenCalledTimes(1);
  } finally {
    close.mockRestore();
  }
});
