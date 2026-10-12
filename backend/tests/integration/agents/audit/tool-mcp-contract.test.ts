/**
 * Integration test owns the actual audit MCP listener and stdio sidecar against a real
 * turn registry. Literal tool names and accepted findings/source assertions are the
 * oracle; session binding, process transport and cleanup remain together under the
 * original describe prefix. No external audit model is invoked.
 */
import { describe, expect, test } from "bun:test";
import { AuditToolTurnRegistry } from "../../../../src/ai/audit/audit_tool_protocol";
import { AuditMcpControlServer } from "../../../../src/ai/audit/audit_mcp_control";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import * as path from "node:path";

describe("Audit ACP MCP bridge", () => {
  test("exposes the same semantic audit contract and resolves a registry turn", async () => {
    const registry = new AuditToolTurnRegistry();
    const control = new AuditMcpControlServer(registry);
    const config = await control.start(process.execPath, []);
    const env = Object.fromEntries(config.env.map((entry) => [entry.name, entry.value]));
    control.bindSession("audit-session");
    const turn = registry.openTurn(
      {
        mode: "inspect",
        taskName: "agent_reports",
        source: "debug_reports.json",
        payload: { reports: [{ seq: 3 }] },
      },
      "audit-session",
    );
    const client = new Client({ name: "audit-mcp-test", version: "1.0.0" });
    try {
      await client.connect(
        new StdioClientTransport({
          command: process.execPath,
          args: [path.resolve(process.cwd(), "src/ai/audit/audit_mcp_server.ts")],
          env: Object.fromEntries(
            Object.entries({ ...process.env, ...env }).filter(
              (entry): entry is [string, string] => entry[1] !== undefined,
            ),
          ),
        }),
      );
      const tools = await client.listTools();
      expect(tools.tools.map((tool) => tool.name)).toEqual([
        "get_audit_schema",
        "get_audit_context",
        "submit_audit_findings",
        "submit_audit_summary",
      ]);
      await expect(
        client.callTool({
          name: "get_audit_context",
          arguments: { turn_id: turn.turnId },
        }),
      ).resolves.toMatchObject({
        structuredContent: { ok: true, context: { task_name: "agent_reports" } },
      });
      await expect(
        client.callTool({
          name: "submit_audit_findings",
          arguments: {
            turn_id: turn.turnId,
            findings: [
              {
                severity: "low",
                category: "logging",
                message: "日志重复",
                evidence: [3],
              },
            ],
            notes: [],
            missing_info: [],
          },
        }),
      ).resolves.toMatchObject({ structuredContent: { ok: true, accepted: true } });
      await expect(turn.result).resolves.toMatchObject({
        kind: "findings",
        findings: [{ source: "debug_reports.json" }],
      });
    } finally {
      await client.close().catch(() => undefined);
      registry.closeTurn();
      await control.close();
    }
  });
});
