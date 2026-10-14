/**
 * 负责审计 MCP sidecar 的 stdio 工具注册与 HTTP 转发。输入为启动环境中的 endpoint／token 和工具参数；
 * 输出同 JSON 数据的文本及 structuredContent，ok=false 按原规则标 MCP 错误。
 * 副作用限 stdio 和原 loopback 请求；本叶不自设期限或取消信号，退出与资源回收归启动它的 ACP 所有者。
 * 四工具只查询协议／当前证据与提交审计诊断，不调用游戏行动、录制写入或任意文件访问接口。
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { auditToolProtocol } from "./audit_tool_protocol";
import { taskLocale } from "../integrations/acp/task_locale";

// 启动时捕获控制地址和认证 token；后续请求不从任务 payload 拼出其它地址或凭证。
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
  // 保原 JSON 回包；HTTP状态不另判，工具的 ok=false 在 result 中决定错误标记。
  return (await response.json()) as Record<string, unknown>;
}

/** 两种 MCP 表达来自同一回包，文本只 JSON编码，不渲染或修改证据序号。 */
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
