import { AiSdkClient } from "../integrations/llm/ai_sdk_client";
import { ResolvedAgentRuntimeProfile } from "../../runtime/config/contracts";
import { AuditAgentExecutor } from "./contracts";
import { SdkAuditAgentExecutor } from "./sdk_audit_runner";
import { AcpAuditAgentExecutor } from "./acp_audit_runner";
/** Abstract Factory：调用方只提供统一 agent profile，不判断 SDK/ACP transport。 */
export function createAuditAgentExecutor(options: {
  profile: ResolvedAgentRuntimeProfile;
  workspaceRoot: string;
}): AuditAgentExecutor | null {
  const { profile } = options;
  if (profile.kind === "acp" && profile.provider.type === "acp") {
    return new AcpAuditAgentExecutor({
      profile,
      workspaceRoot: options.workspaceRoot,
    });
  }
  if (
    profile.kind !== "llm"
    || profile.provider.type === "acp"
    || !profile.provider.apiKey
    || !profile.model
  ) {
    return null;
  }
  return new SdkAuditAgentExecutor(new AiSdkClient({
    providerType: profile.provider.type,
    providerName: profile.providerName,
    apiKey: profile.provider.apiKey,
    model: profile.model,
    baseURL: profile.provider.baseURL,
    userAgent: profile.provider.userAgent,
    temperature: profile.temperature ?? (profile.reasoningEffort || profile.thinkingEnabled ? undefined : 0.1),
    maxTokens: profile.maxTokens ?? 1200,
    reasoningEffort: profile.reasoningEffort,
    thinkingEnabled: profile.thinkingEnabled ?? false,
  }));
}
