/**
 * Unit tests verify SDK strategy selection and strict ACP positive concurrency parsing before native transport startup.
 * Input: Original literal profiles, local bootstrap and unused SDK workspace pathname under the original factory describe prefix.
 * Output and oracle: Handwritten strategy and exact invalid-budget errors remain unchanged; no listener, subprocess or workspace file is created by these callbacks.
 */
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
  expect(parseRuntimeConfig(input(2)).providers.items.acp.maxConcurrentRequests).toBe(2);
  for (const value of [0, -1, 1.5, "2", Infinity])
    expect(() => parseRuntimeConfig(input(value))).toThrow(
      "runtime_config_positive_integer_invalid",
    );
});
