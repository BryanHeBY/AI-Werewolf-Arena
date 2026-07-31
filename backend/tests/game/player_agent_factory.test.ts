import { describe, expect, test } from "bun:test";
import { promises as fs } from "node:fs";
import { tmpdir } from "node:os";
import * as path from "node:path";
import { bootstrapGame } from "../../src/app/bootstrap";
import { createPlayerAgentRuntime } from "../../src/runtime/player_agent_factory";
import { ResolvedAgentRuntimeProfile } from "../../src/runtime/config/runtime_config";
import { sixPlayerMvpConfig } from "../../src/runtime/scenarios/six_player_mvp";

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
  provider: { type: "acp", command: "/bin/false" },
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
    const root = await fs.mkdtemp(path.join(tmpdir(), "awa-player-factory-"));
    const workspace = path.join(root, "acp-workspaces");
    try {
      const runtime = await createPlayerAgentRuntime(
        baseOptions(new Map([[1, acpProfile]]), workspace),
      );
      expect(runtime.kind).toBe("acp");
      expect((await fs.stat(workspace)).isDirectory()).toBe(true);
      await runtime.close();
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  });

  test("rejects mixed transports at the factory boundary", async () => {
    await expect(createPlayerAgentRuntime(baseOptions(
      new Map([[1, llmProfile], [2, acpProfile]]),
      path.join(tmpdir(), "unused-mixed-workspace"),
    ))).rejects.toThrow("runtime_config_mixed_llm_and_acp_agents_not_supported_yet");
  });
});

