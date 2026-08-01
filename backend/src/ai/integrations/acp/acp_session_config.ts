import * as acp from "@agentclientprotocol/sdk";

export type AcpSessionConfigOptionValue = string | boolean;

/**
 * 在 session 创建后通过标准 ACP 配置接口应用 provider 声明的选项。
 * 配置必须由 Agent 显式公布，且响应必须确认新值；不做静默降级。
 */
export async function applyAcpSessionConfigOptions(
  client: acp.ClientContext,
  session: acp.ActiveSession,
  configured: Readonly<Record<string, AcpSessionConfigOptionValue>>,
): Promise<void> {
  const entries = Object.entries(configured);
  if (entries.length === 0) return;

  let available = session.newSessionResponse.configOptions ?? [];
  for (const [configId, value] of entries) {
    if (!available.some((option) => option.id === configId)) {
      throw new Error(`acp_session_config_option_not_advertised:${configId}`);
    }
    const response = await client.request(
      acp.methods.agent.session.setConfigOption,
      typeof value === "boolean"
        ? { sessionId: session.sessionId, configId, type: "boolean", value }
        : { sessionId: session.sessionId, configId, value },
    );
    available = response.configOptions;
    const applied = available.find((option) => option.id === configId);
    if (!applied || applied.currentValue !== value) {
      throw new Error(`acp_session_config_option_not_applied:${configId}`);
    }
  }
}
