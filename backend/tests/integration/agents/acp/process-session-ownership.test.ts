/**
 * 集成测试验证 process-session-ownership 的既有传输、回合与显式特权回退边界。输入为原假客户端、请求、取消／期限和回调控制；预期来自原手写动作、引用、记录与拒绝断言。特权 provider 保留原请求及测试状态控制，不进入默认生产观察策略。
 */
import { acpAdapterEntry } from "../../../support/fixtures/manifest";
import { expect, test } from "bun:test";
import path from "node:path";
import { readFile } from "node:fs/promises";
import { bootstrapGame } from "../../../../src/app/bootstrap";
import { sixPlayerMvpConfig } from "../../../../src/rulesets/presets/six-player-mvp";
import { AcpProcessClient } from "../../../../src/adapters/acp/acp-process-client";
import { AcpActionProvider } from "../../../../src/agents/acp/acp-action-provider";
import { WerewolfMcpControlServer } from "../../../../src/adapters/acp/werewolf-mcp-control";
import type {
  AcpMcpBridgeFactory,
  AcpMcpServerConfig,
} from "../../../../src/adapters/acp/acp-mcp-bridge";
import { AcpTurnRegistry } from "../../../../src/adapters/acp/acp-turn-registry";
import { Phase, type ActionRequest } from "../../../../src/domain";
import { createTestTempDirectory } from "../../../support/drivers/temp-directories";

const fixture = acpAdapterEntry("ownership");
function request(actorId: number): ActionRequest {
  return {
    actorId,
    phase: Phase.Day,
    allowedTools: ["speak"],
    context: {
      day: 1,
      stage: "day_speech",
      visible_events: [],
      turn_constraints: { min_valid_actions: 1, max_valid_actions: 1 },
    },
  };
}
function captureBridge(configs: AcpMcpServerConfig[]): AcpMcpBridgeFactory<AcpTurnRegistry> {
  return {
    serverName: "werewolf-game",
    serverEntrypoint: () =>
      path.resolve(process.cwd(), "src/adapters/acp/werewolf-mcp-server.ts"),
    createControl(registry) {
      const control = new WerewolfMcpControlServer(registry);
      return {
        async start(command, args) {
          const result = await control.start(command, args);
          configs.push(result);
          return result;
        },
        bindSession: (id) => control.bindSession(id),
        close: (options) => control.close(options),
      };
    },
  };
}
async function stopped(pid: number) {
  const deadline = Date.now() + 2000;
  while (Date.now() < deadline) {
    try {
      process.kill(pid, 0);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ESRCH") return;
      throw error;
    }
    await Bun.sleep(10);
  }
  throw new Error("owned_process_still_alive");
}
async function unreachable(config: AcpMcpServerConfig) {
  const endpoint = config.env.find((item) => item.name === "WEREWOLF_MCP_CONTROL_URL")!.value;
  await expect(fetch(endpoint, { signal: AbortSignal.timeout(1000) })).rejects.toBeDefined();
}

for (const locale of ["zh-CN", "en"] as const)
  test(`${locale}: identical remote ACP session IDs do not collide across players; actual agents and MCPs are reclaimed`, async () => {
    const game = bootstrapGame(sixPlayerMvpConfig, { locale }),
      root = await createTestTempDirectory("awa-acp-owned-"),
      controls: AcpMcpServerConfig[] = [];
    const provider = new AcpActionProvider(game.world, {
      turnTimeoutMs: 2000,
      privilegedFallbackProvider: {
        async getAction() {
          throw new Error("unexpected_fallback");
        },
      },
      sessionFactoryResolver: (actorId) =>
        new AcpProcessClient({
          command: process.execPath,
          args: [fixture],
          cwd: path.join(root, String(actorId)),
          env: { AWA_TEST_ACTOR: String(actorId) },
          mcpBridge: captureBridge(controls),
        }),
    });
    try {
      const first = await Promise.all([1, 2].map((actor) => provider.getAction(request(actor))));
      expect(first).toEqual([
        { name: "speak", args: { text: "actor-1" } },
        { name: "speak", args: { text: "actor-2" } },
      ]);
      expect((await provider.getAction(request(1)))?.args).toEqual({ text: "actor-1" });
      expect(controls).toHaveLength(2);
      await provider.close();
      for (const actor of [1, 2]) {
        const facts = JSON.parse(
          await readFile(path.join(root, String(actor), "acp-owned.json"), "utf8"),
        );
        expect(facts.locale).toBe(locale);
        expect(facts.accepted.every((value: any) => value.ok && value.applied === false)).toBe(
          true,
        );
        await stopped(facts.agentPid);
        await stopped(facts.mcpPid);
      }
      for (const control of controls) await unreachable(control);
      expect(provider.runtimeState.pool).toEqual({
        closed: true,
        sessions: 0,
        creating: 0,
        retiring: 0,
      });
      expect(provider.runtimeState.registry.pending).toBe(0);
    } finally {
      await provider.close();
    }
  });

test("initialization timeout kills the real process group and closes its already allocated MCP listener", async () => {
  const root = await createTestTempDirectory("awa-acp-init-owned-"),
    controls: AcpMcpServerConfig[] = [],
    registry = new AcpTurnRegistry(bootstrapGame(sixPlayerMvpConfig).world);
  const factory = new AcpProcessClient({
    command: process.execPath,
    args: [fixture],
    cwd: root,
    env: { AWA_TEST_MODE: "init_hang" },
    initializeTimeoutMs: 500,
    mcpBridge: captureBridge(controls),
  });
  await expect(factory.createSession({ actorId: 1, registry })).rejects.toBeDefined();
  const facts = JSON.parse(await readFile(path.join(root, "acp-owned.json"), "utf8"));
  await stopped(facts.agentPid);
  await stopped(facts.nestedPid);
  expect(controls).toHaveLength(1);
  await unreachable(controls[0]);
  registry.close();
});

test("graceful close of a non-cooperative ACP prompt escalates to process-group kill and releases injected MCP", async () => {
  const root = await createTestTempDirectory("awa-acp-stubborn-"),
    controls: AcpMcpServerConfig[] = [],
    registry = new AcpTurnRegistry(bootstrapGame(sixPlayerMvpConfig).world);
  const factory = new AcpProcessClient({
    command: process.execPath,
    args: [fixture],
    cwd: root,
    env: { AWA_TEST_MODE: "stubborn" },
    mcpBridge: captureBridge(controls),
  });
  const active = await factory.createSession({ actorId: 1, registry });
  const opened = registry.openTurn(request(1), active.sessionId);
  const prompt = active.prompt(`Current turn ID: ${opened.turnId}`).then(
    () => null,
    (error) => error,
  );
  await Bun.sleep(20);
  registry.close();
  await active.close();
  await prompt;
  const facts = JSON.parse(await readFile(path.join(root, "acp-owned.json"), "utf8"));
  await stopped(facts.agentPid);
  await stopped(facts.nestedPid);
  await stopped(facts.mcpPid);
  await unreachable(controls[0]);
  expect(registry.snapshot).toEqual({ closed: true, pending: 0 });
});

test("separate ACP providers progress independently under their own limits", async () => {
  const { createPlayerAgentRuntime } = await import("../../../../src/app/player-agent-factory");
  const root = await createTestTempDirectory("awa-acp-independent-"),
    game = bootstrapGame(sixPlayerMvpConfig, { locale: "en" });
  let ready!: () => void;
  const began = new Promise<void>((done) => {
    ready = done;
  });
  const profiles = new Map(
    [1, 2].map((actor) => [
      actor,
      {
        name: `actor-${actor}`,
        kind: "acp" as const,
        providerName: `independent-${actor}`,
        provider: {
          type: "acp" as const,
          transport: "stdio" as const,
          command: process.execPath,
          args: [fixture],
          env: {
            AWA_TEST_ACTOR: String(actor),
            AWA_TEST_MODE: actor === 1 ? "stubborn" : "normal",
          },
          sessionConfigOptions: {},
          maxConcurrentRequests: 1,
        },
      },
    ]),
  );
  const runtime = await createPlayerAgentRuntime({
    world: game.world,
    boardConfig: sixPlayerMvpConfig,
    profilesByActor: profiles,
    acpWorkspaceRoot: root,
    llmTimeoutMs: 5000,
    trace: false,
    colorizeLogs: false,
    printLlmIo: false,
    printThinking: false,
    createAcpUpdateObserver: (actor) =>
      actor === 1
        ? (update: unknown) => {
            if ((update as any).content?.text === "fixture_prompt_started") ready();
          }
        : undefined,
  });
  const blocked = runtime.provider.getAction(request(1));
  await began;
  try {
    expect(await runtime.provider.getAction(request(2))).toEqual({
      name: "speak",
      args: { text: "actor-2" },
    });
    expect(runtime.runtimeState.acp![0].scheduler.active).toBe(1);
    expect(runtime.runtimeState.acp![1].scheduler.active).toBe(0);
    await runtime.close();
    expect(await blocked).toBeNull();
    for (const actor of [1, 2]) {
      const facts = JSON.parse(
        await readFile(path.join(root, `player-${actor}/acp-owned.json`), "utf8"),
      );
      await stopped(facts.agentPid);
      await stopped(facts.mcpPid);
      if (facts.nestedPid) await stopped(facts.nestedPid);
    }
  } finally {
    await runtime.close();
  }
});
