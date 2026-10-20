/**
 * 负责按已解析 agent profile 选择审计传输实现。输入为 profile 与工作区根；输出为 ACP／Pi／SDK executor 或 null。
 * 有效配置才装配客户端；温度、推理、token 参数保原回退，不加载全局配置或发起模型请求。
 * 会话、期限和失败收尾归具体 executor；这里不授游戏写权或创建审计证据、记录文件。
 */
import { AiSdkClient } from "../adapters/llm/ai-sdk-client";
import { ResolvedAgentRuntimeProfile } from "./config/contracts";
import { AuditAgentExecutor } from "../audit/agents/contracts";
import { SdkAuditAgentExecutor } from "../audit/agents/sdk-audit-runner";
import { AcpAuditAgentExecutor } from "../audit/agents/acp-audit-runner";
import { PiAuditAgentExecutor } from "../audit/agents/pi-audit-runner";
/** 调用方提供统一已解析 profile；本工厂按原 kind/provider 分支装配，不替 profile 增加隐式来源。 */
export function createAuditAgentExecutor(options: {
  profile: ResolvedAgentRuntimeProfile;
  workspaceRoot: string;
}): AuditAgentExecutor | null {
  const { profile } = options;
  if (profile.kind === "pi" && profile.provider.type === "pi")
    return new PiAuditAgentExecutor(profile);
  if (profile.kind === "acp" && profile.provider.type === "acp") {
    return new AcpAuditAgentExecutor({
      profile,
      workspaceRoot: options.workspaceRoot,
    });
  }
  // 非SDK配置／缺key／缺model按原政策返回null；ACP分支在此前先行，不被这些字段误拒。
  if (
    profile.kind !== "llm" ||
    (profile.provider.type !== "openai" && profile.provider.type !== "anthropic") ||
    !profile.provider.apiKey ||
    !profile.model
  ) {
    return null;
  }
  return new SdkAuditAgentExecutor(
    new AiSdkClient({
      providerType: profile.provider.type,
      providerName: profile.providerName,
      apiKey: profile.provider.apiKey,
      model: profile.model,
      baseURL: profile.provider.baseURL,
      userAgent: profile.provider.userAgent,
      temperature:
        profile.temperature ??
        (profile.reasoningEffort || profile.thinkingEnabled ? undefined : 0.1),
      maxTokens: profile.maxTokens ?? 1200,
      reasoningEffort: profile.reasoningEffort,
      thinkingEnabled: profile.thinkingEnabled ?? false,
    }),
  );
}
