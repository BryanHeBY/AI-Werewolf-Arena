import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  reportGameBugInput,
  submitGameActionInput,
} from "../../agents/game_tool_protocol";

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
  const server = new McpServer({ name: "werewolf-game", version: "1.0.0" });
  server.registerTool("get_game_schema", {
    description: "查询固定的狼人杀 MCP 工具协议。不会返回局内状态；当前回合信息以用户消息为准。",
  }, async () => result(await invoke("get_game_schema")));
  server.registerTool("submit_action", {
    description: "提交当前回合唯一会生效的游戏行动。普通文本不会产生游戏效果。",
    inputSchema: submitGameActionInput.shape,
  }, async (args) => result(await invoke("submit_action", args)));
  server.registerTool("report_bug", {
    description: "仅上报明确的规则、流程、状态、日志或可见性矛盾；不会替代本回合必须提交的游戏行动。",
    inputSchema: reportGameBugInput.shape,
  }, async (args) => result(await invoke("report_bug", args)));
  await server.connect(new StdioServerTransport());
}

void main();
