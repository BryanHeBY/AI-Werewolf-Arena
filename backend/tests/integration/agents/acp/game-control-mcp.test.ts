/**
 * Integration tests: Exercises the actual game MCP control listener and stdio sidecar from
 * an in-memory turn. Literal tool/schema/receipt expectations check session binding and
 * current-turn submission; the process owns only the injected game capability. Existing
 * literal expectations and independently supplied fixture plans remain the oracle;
 * transport/recording setup is local and no billed model session is started.
 */
import { describe, expect, test } from "bun:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import * as path from "node:path";
import { bootstrapGame } from "../../../../src/app/bootstrap";
import { AcpTurnRegistry } from "../../../../src/adapters/acp/acp-turn-registry";
import { WerewolfMcpControlServer } from "../../../../src/adapters/acp/werewolf-mcp-control";
import { sixPlayerMvpConfig } from "../../../../src/rulesets/presets/six-player-mvp";
import { speakRequest } from "../../../support/builders/agents/acp-requests";

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
        args: [path.resolve(process.cwd(), "src/adapters/acp/werewolf-mcp-server.ts")],
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
