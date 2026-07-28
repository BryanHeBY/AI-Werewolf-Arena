import { describe, expect, test } from "bun:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import * as path from "node:path";
import { bootstrapGame } from "../../src/app/bootstrap";
import { AcpActionProvider } from "../../src/ai/agents/acp/acp_action_provider";
import {
  AcpSession,
  AcpSessionFactory,
} from "../../src/ai/integrations/acp/acp_process_client";
import { AcpTurnRegistry } from "../../src/ai/integrations/acp/acp_turn_registry";
import { WerewolfMcpControlServer } from "../../src/ai/integrations/acp/werewolf_mcp_control";
import { ActionRequest, Phase } from "../../src/core/domain/model";
import { sixPlayerMvpConfig } from "../../src/runtime/scenarios/six_player_mvp";

function speakRequest(actorId = 1): ActionRequest {
  return {
    actorId,
    phase: Phase.Day,
    allowedTools: ["speak"],
    context: { day: 1, phase: "day_speech", broadcast_feed: ["[上帝] 天亮了"] },
  };
}

describe("AcpTurnRegistry", () => {
  test("rejects stale sessions and tools outside the current turn", async () => {
    const registry = new AcpTurnRegistry();
    expect(registry.getSchema().tools.submit_action).toContain("turn_id");
    const pending = registry.openTurn(speakRequest(), "session-a");
    expect(pending.turnId).toBe("t1");

    expect(
      registry.submitAction("wrong-session", {
        turn_id: pending.turnId,
        action: "speak",
        arguments: { text: "x" },
      }),
    ).toEqual({ ok: false, error: "turn_not_open_or_session_invalid" });
    expect(
      registry.submitAction("session-a", {
        turn_id: pending.turnId,
        action: "vote",
        arguments: { target_id: 2, abstain: false },
      }),
    ).toEqual({ ok: false, error: "tool_not_allowed_in_this_turn" });
    expect(
      registry.submitAction("session-a", {
        turn_id: pending.turnId,
        action: "speak",
        arguments: { text: "我通过 MCP 工具发言。" },
      }),
    ).toEqual({ ok: true, accepted: true });
    await expect(pending.action).resolves.toEqual({
      name: "speak",
      args: { text: "我通过 MCP 工具发言。" },
    });
    expect(
      registry.submitAction("session-a", {
        turn_id: pending.turnId,
        action: "speak",
        arguments: { text: "第二次不能生效" },
      }),
    ).toEqual({ ok: false, error: "turn_not_open_or_session_invalid" });
    registry.close();
  });
});

describe("WerewolfMcpControlServer", () => {
  test("exposes only the current turn through the injected MCP sidecar capability", async () => {
    const registry = new AcpTurnRegistry();
    const control = new WerewolfMcpControlServer(registry);
    const config = await control.start(process.execPath, []);
    const env = Object.fromEntries(config.env.map((entry) => [entry.name, entry.value]));
    control.bindSession("session-mcp");
    const pending = registry.openTurn(speakRequest(), "session-mcp");
    try {
      const schema = await fetch(`${env.WEREWOLF_MCP_CONTROL_URL}/invoke`, {
        method: "POST",
        headers: { authorization: `Bearer ${env.WEREWOLF_MCP_TOKEN}`, "content-type": "application/json" },
        body: JSON.stringify({ tool: "get_game_schema", arguments: {} }),
      });
      await expect(schema.json()).resolves.toMatchObject({ protocol_version: "1" });

      const mcpClient = new Client({ name: "werewolf-mcp-test", version: "1.0.0" });
      const transport = new StdioClientTransport({
        command: process.execPath,
        args: [path.resolve(process.cwd(), "src/ai/integrations/acp/werewolf_mcp_server.ts")],
        env: { ...process.env, ...env },
      });
      await mcpClient.connect(transport);
      const tools = await mcpClient.listTools();
      expect(tools.tools.map((tool) => tool.name)).toEqual(
        expect.arrayContaining(["get_game_schema", "submit_action", "report_bug"]),
      );
      await expect(mcpClient.callTool({ name: "get_game_schema", arguments: {} })).resolves.toMatchObject({
        structuredContent: { protocol_version: "1" },
      });

      await expect(mcpClient.callTool({
        name: "submit_action",
        arguments: { turn_id: pending.turnId, action: "speak", arguments: { text: "MCP 生效。" } },
      })).resolves.toMatchObject({ structuredContent: { ok: true, accepted: true } });
      await expect(pending.action).resolves.toEqual({ name: "speak", args: { text: "MCP 生效。" } });
      await mcpClient.close();
    } finally {
      registry.close();
      await control.close();
    }
  });
});

describe("AcpActionProvider", () => {
  test("accepts an action only through the MCP bridge bound to its session", async () => {
    const context = bootstrapGame(sixPlayerMvpConfig);
    let cancelled = 0;
    let sessionsCreated = 0;
    const factory: AcpSessionFactory = {
      async createSession(input): Promise<AcpSession> {
        sessionsCreated += 1;
        expect(input.initialPrompt).toContain("你的唯一目标是帮助你所在阵营赢得本局");
        expect(input.initialPrompt).not.toContain("MCP 协议");
        expect(input.initialPrompt).not.toContain("werewolf-game");
        expect(input.initialPrompt).not.toContain("speak_to_wolves.text");
        return {
          sessionId: "fake-session-1",
          async prompt(prompt: string): Promise<void> {
            const turnId = /当前回合 ID：(\S+)/.exec(prompt)?.[1];
            expect(turnId).toBeDefined();
            expect(prompt).toContain("MCP 服务 werewolf-game 的 submit_action");
            expect(prompt).toContain(`参数 turn_id 必须为 ${turnId}`);
            const response = input.registry.submitAction("fake-session-1", {
              turn_id: turnId!,
              action: "speak",
              arguments: { text: "这是 MCP 工具提交的行动。" },
            });
            expect(response).toEqual({ ok: true, accepted: true });
          },
          async cancel(): Promise<void> {
            cancelled += 1;
          },
          async close(): Promise<void> {},
        };
      },
    };
    const provider = new AcpActionProvider(context.world, {
      sessionFactory: factory,
      turnTimeoutMs: 1000,
    });

    await expect(provider.getAction(speakRequest())).resolves.toEqual({
      name: "speak",
      args: { text: "这是 MCP 工具提交的行动。" },
    });
    // 同一 ACP session 会复用，但每一回合由不同的 turn_id 防重放。
    await expect(provider.getAction(speakRequest())).resolves.toEqual({
      name: "speak",
      args: { text: "这是 MCP 工具提交的行动。" },
    });
    expect(sessionsCreated).toBe(1);
    expect(cancelled).toBe(2);
    await provider.close();
  });

  test("falls back as soon as an ACP turn ends without submit_action", async () => {
    const context = bootstrapGame(sixPlayerMvpConfig);
    const factory: AcpSessionFactory = {
      async createSession(): Promise<AcpSession> {
        return {
          sessionId: "empty-session",
          async prompt(): Promise<void> {},
          async cancel(): Promise<void> {},
          async close(): Promise<void> {},
        };
      },
    };
    const provider = new AcpActionProvider(context.world, {
      sessionFactory: factory,
      turnTimeoutMs: 60_000,
      fallbackProvider: {
        async getAction() {
          return { name: "speak", args: { text: "立即回退。" } };
        },
      },
    });

    const startedAt = Date.now();
    await expect(provider.getAction(speakRequest())).resolves.toEqual({
      name: "speak",
      args: { text: "立即回退。" },
    });
    expect(Date.now() - startedAt).toBeLessThan(1_000);
    await provider.close();
  });
});
