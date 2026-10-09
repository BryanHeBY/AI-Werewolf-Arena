import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { auditToolProtocol } from "./audit_tool_protocol";
import { taskLocale } from "../integrations/acp/task_locale";

const endpoint = process.env.AUDIT_MCP_CONTROL_URL;
const token = process.env.AUDIT_MCP_TOKEN;

async function invoke(
  tool: string,
  args: Record<string, unknown> = {},
): Promise<Record<string, unknown>> {
  if (!endpoint || !token) throw new Error("audit_mcp_control_environment_missing");
  const response = await fetch(`${endpoint}/invoke`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({ tool, arguments: args }),
  });
  return (await response.json()) as Record<string, unknown>;
}

function result(value: Record<string, unknown>) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(value) }],
    structuredContent: value,
    ...(value.ok === false ? { isError: true } : {}),
  };
}

async function main(): Promise<void> {
  const protocol = auditToolProtocol(taskLocale(process.env));
  const server = new McpServer({ name: "werewolf-audit", version: "1.0.0" });
  server.registerTool(
    "get_audit_schema",
    {
      description: protocol.descriptions.get_audit_schema,
      inputSchema: protocol.inputs.get_audit_schema.shape,
    },
    async () => result(await invoke("get_audit_schema")),
  );
  server.registerTool(
    "get_audit_context",
    {
      description: protocol.descriptions.get_audit_context,
      inputSchema: protocol.inputs.get_audit_context.shape,
    },
    async (args) => result(await invoke("get_audit_context", args)),
  );
  server.registerTool(
    "submit_audit_findings",
    {
      description: protocol.descriptions.submit_audit_findings,
      inputSchema: protocol.inputs.submit_audit_findings.shape,
    },
    async (args) => result(await invoke("submit_audit_findings", args)),
  );
  server.registerTool(
    "submit_audit_summary",
    {
      description: protocol.descriptions.submit_audit_summary,
      inputSchema: protocol.inputs.submit_audit_summary.shape,
    },
    async (args) => result(await invoke("submit_audit_summary", args)),
  );
  await server.connect(new StdioServerTransport());
}

void main();
