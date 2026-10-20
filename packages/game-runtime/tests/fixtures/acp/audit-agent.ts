/**
 * Runs the isolated synthetic ACP audit protocol fixture. Inputs are stdio RPC and injected local test controls; outputs are original protocol replies and private-workspace diagnostic files. It owns its test client/transport and existing terminal cleanup; it does not call a billed model or calculate an archive golden.
 */
import { fixtureObject } from "../../support/oracles/fixture-values";
import { auditSummaryFixture } from "../../support/builders/audit-summary";
/** Synthetic ACP agent: reads only the injected audit MCP and records test prompts. */
import { createInterface } from "node:readline";
import { writeFile } from "node:fs/promises";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import type { AcpMcpServerConfig } from "../../../src/adapters/acp/acp-mcp-bridge";

const trace: Record<string, unknown> = { agentPid: process.pid, prompts: [] };
let client: Client | undefined;
let transport: StdioClientTransport | undefined;
const send = (value: unknown) => process.stdout.write(JSON.stringify(value) + "\n");
const save = () => writeFile("audit-fixture.json", JSON.stringify(trace));
try {
  for await (const line of createInterface({ input: process.stdin })) {
    const request = JSON.parse(line);
    if (request.id === undefined) continue;
    if (request.method === "initialize") {
      send({
        jsonrpc: "2.0",
        id: request.id,
        result: { protocolVersion: 1, agentCapabilities: {} },
      });
    } else if (request.method === "session/new") {
      const config = request.params.mcpServers[0] as AcpMcpServerConfig;
      const environment = Object.fromEntries(config.env.map((entry) => [entry.name, entry.value]));
      trace.locale = environment.AWA_TASK_LOCALE; // Do not persist control tokens or configuration.
      client = new Client({ name: "synthetic-audit-agent", version: "1.0.0" });
      transport = new StdioClientTransport({
        command: config.command,
        args: config.args,
        env: environment,
      });
      await client.connect(transport);
      trace.mcpPid = transport.pid;
      await save();
      send({ jsonrpc: "2.0", id: request.id, result: { sessionId: "audit-fixture" } });
    } else if (request.method === "session/prompt") {
      const prompt = String(request.params.prompt[0].text);
      (trace.prompts as string[]).push(prompt);
      const turn = /(?:当前审计回合 ID：|Current audit turn ID: )(a\d+)/.exec(prompt)?.[1];
      if (turn) {
        trace.schema = (
          await client!.callTool({ name: "get_audit_schema", arguments: {} })
        ).structuredContent;
        trace.stale = (
          await client!.callTool({ name: "get_audit_context", arguments: { turn_id: "a999" } })
        ).structuredContent;
        const reply = await client!.callTool({
          name: "get_audit_context",
          arguments: { turn_id: turn },
        });
        trace.context = reply.structuredContent;
        const context = fixtureObject(reply.structuredContent).context as { mode: string };
        trace.submission = (
          await client!.callTool(
            context.mode === "inspect"
              ? {
                  name: "submit_audit_findings",
                  arguments: { turn_id: turn, findings: [], notes: ["Original 模型说明"] },
                }
              : {
                  name: "submit_audit_summary",
                  arguments: {
                    turn_id: turn,
                    markdown: auditSummaryFixture(
                      trace.locale === "en" ? "en" : "zh-CN",
                      undefined,
                      "Original 模型报告",
                    ),
                  },
                },
          )
        ).structuredContent;
      }
      await save();
      send({ jsonrpc: "2.0", id: request.id, result: { stopReason: "end_turn" } });
    }
  }
} finally {
  await client?.close();
}
