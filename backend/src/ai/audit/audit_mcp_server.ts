import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  getAuditContextInput,
  submitAuditFindingsInput,
  submitAuditSummaryInput,
} from "./audit_tool_protocol";

const endpoint = process.env.AUDIT_MCP_CONTROL_URL;
const token = process.env.AUDIT_MCP_TOKEN;

async function invoke(tool: string, args: Record<string, unknown> = {}): Promise<Record<string, unknown>> {
  if (!endpoint || !token) throw new Error("audit_mcp_control_environment_missing");
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
  const server = new McpServer({ name: "werewolf-audit", version: "1.0.0" });
  server.registerTool("get_audit_schema", {
    description: "查询固定审计工具协议，不返回任何复盘内容。",
  }, async () => result(await invoke("get_audit_schema")));
  server.registerTool("get_audit_context", {
    description: "读取当前审计 turn 唯一被授权看到的结构化上下文。",
    inputSchema: getAuditContextInput.shape,
  }, async (args) => result(await invoke("get_audit_context", args)));
  server.registerTool("submit_audit_findings", {
    description: "inspect 模式提交结构化 findings、notes 与 missing_info。",
    inputSchema: submitAuditFindingsInput.shape,
  }, async (args) => result(await invoke("submit_audit_findings", args)));
  server.registerTool("submit_audit_summary", {
    description: "summarize 模式提交最终 Markdown 审计报告。",
    inputSchema: submitAuditSummaryInput.shape,
  }, async (args) => result(await invoke("submit_audit_summary", args)));
  await server.connect(new StdioServerTransport());
}

void main();
