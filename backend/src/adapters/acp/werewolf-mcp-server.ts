/**
 * 负责 stdio MCP 工具发现、公共输入解析与本机控制面的 JSON 转发；输入环境 endpoint／token 和工具请求。
 * 输出文本及结构回包，网络／协议副作用在此发生；回合身份与行动授权仍归控制面 registry。
 * 此入口不另设请求期限或取消器；序列化、fetch、解码和启动失败沿原路径传播，不提供游戏提交许可。
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { text, toolFailure } from "@ai-werewolf-arena/game-text";
import { gameToolProtocol } from "../../agents/game-tool-protocol";
import { taskLocale } from "./task-locale";

// 入口加载时读取原环境地址与 token；它们只用于本机传输认证，不替代 turn_id／领域规则。
const endpoint = process.env.WEREWOLF_MCP_CONTROL_URL;
const token = process.env.WEREWOLF_MCP_TOKEN;

async function invoke(
  tool: string,
  args: Record<string, unknown> = {},
): Promise<Record<string, unknown>> {
  if (!endpoint || !token) throw new Error("werewolf_mcp_control_environment_missing");
  const response = await fetch(`${endpoint}/invoke`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({ tool, arguments: args }),
  });
  // 原路径不检查 HTTP 状态；解码结果的断言不做 schema 验证，JSON／传输失败直接传播。
  return (await response.json()) as Record<string, unknown>;
}

// 文本现场序列化，structuredContent 保同一 value 引用；只有 ok === false 标记 MCP 错误。
function result(value: Record<string, unknown>) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(value) }],
    structuredContent: value,
    ...(value.ok === false ? { isError: true } : {}),
  };
}

async function main(): Promise<void> {
  const locale = taskLocale(process.env),
    protocol = gameToolProtocol(locale);
  const server = new McpServer({ name: "werewolf-game", version: "1.0.0" });
  server.registerTool(
    "get_game_schema",
    {
      description: protocol.descriptions.get_game_schema,
      inputSchema: protocol.inputs.get_game_schema.shape,
    },
    async () => result(await invoke("get_game_schema")),
  );
  server.registerTool(
    "submit_action",
    {
      description: protocol.descriptions.submit_action,
      inputSchema: protocol.inputs.submit_action.shape,
    },
    async (args) => result(await invoke("submit_action", args)),
  );
  server.registerTool(
    "report_bug",
    {
      description: protocol.descriptions.report_bug,
      inputSchema: protocol.inputs.report_bug.shape,
    },
    async (args) => result(await invoke("report_bug", args)),
  );
  // 发现列表保公共 schema；无效 submit_action 先将原 turn_id 交原回合 owner，再返回 MCP 拒绝。
  // 此拒绝路径不执行行动；其他工具的输入失败仍按各自原错误返回。
  server.server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const name = request.params.name;
    if (name !== "get_game_schema" && name !== "submit_action" && name !== "report_bug")
      return result(toolFailure(locale, "unknown_mcp_tool"));
    const args = request.params.arguments ?? {},
      parsed = protocol.inputs[name].safeParse(args);
    if (!parsed.success) {
      if (name === "submit_action") {
        const refusal = await invoke("reject_submission_input", { turn_id: args.turn_id });
        return result({ ...refusal, message: text(locale, "error.schema_input") });
      }
      return result(
        toolFailure(
          locale,
          name === "report_bug" ? "invalid_report_bug_arguments" : "schema_input",
        ),
      );
    }
    return result(await invoke(name, parsed.data));
  });
  await server.connect(new StdioServerTransport());
}

void main();
