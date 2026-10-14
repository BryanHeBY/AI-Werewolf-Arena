/**
 * 负责在已创建会话上逐项应用 ACP 配置；输入是 client、创建响应和显式选项，输出为完成或原失败。
 * 副作用仅是顺序发送 session/set_config_option，并以每次响应更新可用选项；不持会话复用状态。
 * 本函数不另建期限或取消／关闭流程，等待预算与失败回收仍由调用方的创建生命周期负责。
 * 未公布／未确认的选项直接失败；先前已经应用的选项不回滚，不执行静默降级。
 */
import * as acp from "@agentclientprotocol/sdk";

/** 仅描述当前接入的字符串／布尔选项；具体 configId 与可选值由 Agent 的当次响应声明。 */
export type AcpSessionConfigOptionValue = string | boolean;

/**
 * 在 session 创建后通过标准 ACP 配置接口应用 provider 声明的选项。
 * 配置必须由 Agent 显式公布，且响应必须确认新值；不做静默降级。
 */
export async function applyAcpSessionConfigOptions(
  client: acp.ClientContext,
  session: Pick<acp.ActiveSession, "sessionId" | "newSessionResponse">,
  configured: Readonly<Record<string, AcpSessionConfigOptionValue>>,
): Promise<void> {
  // 先拍摄调用方的选项条目并保持顺序；空配置不读取会话公布列表或发送请求。
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
    // 后一项依据这次响应的完整列表校验；不继续使用创建时的旧列表，也不合并出过期选项。
    available = response.configOptions;
    const applied = available.find((option) => option.id === configId);
    // 先替换 available 再核确认值；失败保留已发送／已应用前缀，不负责关闭或补偿。
    if (!applied || applied.currentValue !== value) {
      throw new Error(`acp_session_config_option_not_applied:${configId}`);
    }
  }
}
