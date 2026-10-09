import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { text, toolFailure } from "@ai-werewolf-arena/game-text";
import { gameToolProtocol } from "../../agents/game_tool_protocol";
import { taskLocale } from "./task_locale";

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
  // Keep canonical discovery schemas. Input validation failures must reach the
  // addressed turn's owner before MCP rejects them; no action is executed.
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
