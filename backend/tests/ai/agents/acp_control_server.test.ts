/**
 * Local transport integration verify the injected current-turn MCP sidecar boundary.
 * Input: A real loopback control listener, stdio MCP client and bound speak request.
 * Output and independent oracle: Exact exposed tool names, read-only acceptance receipts and the selected action; clients/listener close in finally.
 * The test never calls a billed model or rewrites expected fixture/Tape bytes.
 */
import { describe, expect, test } from "bun:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import * as path from "node:path";
import { bootstrapGame } from "../../../src/app/bootstrap";
import { AcpTurnRegistry } from "../../../src/ai/integrations/acp/acp_turn_registry";
import { WerewolfMcpControlServer } from "../../../src/ai/integrations/acp/werewolf_mcp_control";
import { sixPlayerMvpConfig } from "../../../src/runtime/scenarios/six_player_mvp";
import { speakRequest } from "../../support/builders/agents/acp-requests";

describe("WerewolfMcpControlServer", () => {
  test("exposes only the current turn through the injected MCP sidecar capability", async () => {
    const registry = new AcpTurnRegistry(bootstrapGame(sixPlayerMvpConfig).world);
    const control = new WerewolfMcpControlServer(registry);
    const config = await control.start(process.execPath, []);
    const env = Object.fromEntries(config.env.map((entry) => [entry.name, entry.value]));
    control.bindSession("session-mcp");
    const pending = registry.openTurn(speakRequest(), "session-mcp");
    try {
      const schema = await fetch(`${env.WEREWOLF_MCP_CONTROL_URL}/invoke`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${env.WEREWOLF_MCP_TOKEN}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ tool: "get_game_schema", arguments: {} }),
      });
      await expect(schema.json()).resolves.toMatchObject({ protocol_version: "1" });

      const mcpClient = new Client({ name: "werewolf-mcp-test", version: "1.0.0" });
      const transport = new StdioClientTransport({
        command: process.execPath,
        args: [path.resolve(process.cwd(), "src/ai/integrations/acp/werewolf_mcp_server.ts")],
        env: Object.fromEntries(
          Object.entries({ ...process.env, ...env }).filter(
            (entry): entry is [string, string] => entry[1] !== undefined,
          ),
        ),
      });
      await mcpClient.connect(transport);
      const tools = await mcpClient.listTools();
      expect(tools.tools.map((tool) => tool.name)).toEqual(
        expect.arrayContaining(["get_game_schema", "submit_action", "report_bug"]),
      );
      await expect(
        mcpClient.callTool({ name: "get_game_schema", arguments: {} }),
      ).resolves.toMatchObject({
        structuredContent: { protocol_version: "1" },
      });

      await expect(
        mcpClient.callTool({
          name: "submit_action",
          arguments: {
            turn_id: pending.turnId,
            action: "speak",
            arguments: { text: "MCP 生效。" },
          },
        }),
      ).resolves.toMatchObject({ structuredContent: { ok: true, accepted: true } });
      await expect(pending.action).resolves.toEqual({
        name: "speak",
        args: { text: "MCP 生效。" },
      });
      await mcpClient.close();
    } finally {
      registry.close();
      await control.close();
    }
  });
});
