import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { gameToolProtocol } from "../../agents/game_tool_protocol";
import { taskLocale } from "./task_locale";

const endpoint = process.env.WEREWOLF_MCP_CONTROL_URL;
const token = process.env.WEREWOLF_MCP_TOKEN;

async function invoke(tool: string, args: Record<string, unknown> = {}): Promise<Record<string, unknown>> {
  if (!endpoint || !token) throw new Error("werewolf_mcp_control_environment_missing");
  const response = await fetch(`${endpoint}/invoke`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({ tool, arguments: args }),
  });
  return await response.json() as Record<string, unknown>;
}

function result(value: Record<string, unknown>) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(value) }],
    structuredContent: value,
    ...(value.ok === false ? { isError: true } : {}),
  };
}

async function main(): Promise<void> {
  const protocol = gameToolProtocol(taskLocale(process.env));
  const server = new McpServer({ name: "werewolf-game", version: "1.0.0" });
  server.registerTool("get_game_schema", {
    description: protocol.descriptions.get_game_schema,
    inputSchema: protocol.inputs.get_game_schema.shape,
  }, async () => result(await invoke("get_game_schema")));
  server.registerTool("submit_action", {
    description: protocol.descriptions.submit_action,
    inputSchema: protocol.inputs.submit_action.shape,
  }, async (args) => result(await invoke("submit_action", args)));
  server.registerTool("report_bug", {
    description: protocol.descriptions.report_bug,
    inputSchema: protocol.inputs.report_bug.shape,
  }, async (args) => result(await invoke("report_bug", args)));
  await server.connect(new StdioServerTransport());
}

void main();
