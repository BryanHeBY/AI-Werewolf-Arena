import * as path from "node:path";
import { AiSdkClient, ChatMessage, ToolInvocation } from "../integrations/llm/ai_sdk_client";
import {
  AcpProcessClient,
  AcpSessionFactory,
} from "../integrations/acp/acp_process_client";
import { AcpMcpBridgeFactory } from "../integrations/acp/acp_mcp_bridge";
import {
  AgentProfileConfig,
  ResolvedAgentRuntimeProfile,
} from "../../runtime/config/runtime_config";
import { AgentTurnExecutor, AgentTurnOptions } from "../runtime/agent_turn_executor";
import { AuditMcpControlServer } from "./audit_mcp_control";
import {
  AUDIT_TOOL_SPECS,
  AuditSubmission,
  AuditToolContext,
  AuditToolResult,
  AuditToolTurnRegistry,
} from "./audit_tool_protocol";

export type AuditAgentExecutor = AgentTurnExecutor<AuditToolContext, AuditSubmission>;

interface ToolLoopClient {
  runToolLoop<T>(
    messages: ChatMessage[],
    schemas: typeof AUDIT_TOOL_SPECS,
    callbacks: {
      onToolCall(invocation: ToolInvocation): Promise<{
        toolResult: Record<string, unknown> | string;
        finalAction?: T;
        stop?: boolean;
      }>;
    },
    options?: { signal?: AbortSignal; maxSteps?: number; toolChoice?: "auto" | "required" },
  ): Promise<{ finalAction: T | null }>;
}

function auditSystemPrompt(): string {
  return [
    "你是狼人杀复盘审计智能体。唯一职责是从被授权的结构化上下文中发现可验证的问题。",
    "先调用 get_audit_context 读取当前任务；不要猜测或读取本地文件、终端和其他任务。",
    "inspect 模式必须以 submit_audit_findings 结束；summarize 模式必须以 submit_audit_summary 结束。",
    "普通 assistant 文本仅视为思考，不会成为审计结果。证据序号必须来自当前上下文。",
  ].join("\n");
}

function auditSessionPrompt(): string {
  return [
    "你是狼人杀复盘审计智能体。唯一职责是从随后被授权的结构化上下文中发现可验证的问题。",
    "每个实际审计回合会提供 turn_id；届时先调用 get_audit_context，再使用与模式对应的 submit 工具。",
    "普通 assistant 文本仅视为思考，不会成为审计结果。不要读取本地文件、终端或其他任务。",
    "当前仅初始化会话，尚无有效 turn_id，请不要调用任何工具。",
  ].join("\n");
}

function auditTurnPrompt(turnId: string, mode: AuditToolContext["mode"]): string {
  const modeDirective = mode === "inspect"
    ? "最多提交 5 条 findings；每条 evidence 必须是上下文中存在的 seq。"
    : "Markdown 必须包含 Session、Bug Report Stats、Findings、TODO/Conclusion、Debug Pipeline；Findings 每条写 evidence=1,2，且只能引用上下文 findings.evidence。";
  return [
    `当前审计回合 ID：${turnId}`,
    `当前模式：${mode}`,
    "请通过审计工具读取上下文并提交结果。不要在普通文本中复制上下文或最终结果。",
    modeDirective,
  ].join("\n");
}

function asToolRecord(result: AuditToolResult | object): Record<string, unknown> {
  return result as Record<string, unknown>;
}

/** AI SDK function-tools 适配器。 */
export class SdkAuditAgentExecutor implements AuditAgentExecutor {
  private nextSession = 0;

  constructor(private readonly client: ToolLoopClient) {}

  async runTurn(
    context: AuditToolContext,
    options: AgentTurnOptions,
  ): Promise<AuditSubmission | null> {
    const registry = new AuditToolTurnRegistry();
    const sessionId = `sdk-audit-${++this.nextSession}`;
    const turn = registry.openTurn(context, sessionId);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), options.timeoutMs);
    try {
      const result = await this.client.runToolLoop<AuditSubmission>(
        [
          { role: "system", content: auditSystemPrompt() },
          { role: "user", content: auditTurnPrompt(turn.turnId, context.mode) },
        ],
        AUDIT_TOOL_SPECS,
        {
          onToolCall: async (invocation) => {
            if (invocation.name === "get_audit_schema") {
              return { toolResult: asToolRecord(registry.getSchema()) };
            }
            if (invocation.name === "get_audit_context") {
              return { toolResult: asToolRecord(registry.getContext(sessionId, invocation.args)) };
            }
            if (invocation.name === "submit_audit_findings") {
              const toolResult = registry.submitFindings(sessionId, invocation.args);
              const finalAction = toolResult.ok ? await turn.result : undefined;
              return {
                toolResult: asToolRecord(toolResult),
                ...(finalAction ? { finalAction, stop: true } : {}),
              };
            }
            if (invocation.name === "submit_audit_summary") {
              const toolResult = registry.submitSummary(sessionId, invocation.args);
              const finalAction = toolResult.ok ? await turn.result : undefined;
              return {
                toolResult: asToolRecord(toolResult),
                ...(finalAction ? { finalAction, stop: true } : {}),
              };
            }
            return { toolResult: { ok: false, error: "unknown_audit_tool" } };
          },
        },
        { signal: controller.signal, maxSteps: 6, toolChoice: "required" },
      );
      return result.finalAction;
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
      registry.closeTurn();
    }
  }

  async close(): Promise<void> {}
}

export interface AcpAuditAgentExecutorOptions {
  profile: ResolvedAgentRuntimeProfile;
  workspaceRoot: string;
  sessionFactoryResolver?: (
    registry: AuditToolTurnRegistry,
    workspace: string,
  ) => AcpSessionFactory<AuditToolTurnRegistry>;
}

/** ACP + MCP 适配器；每个并行审计任务使用独立进程和独立 registry。 */
export class AcpAuditAgentExecutor implements AuditAgentExecutor {
  private nextSession = 0;

  constructor(private readonly options: AcpAuditAgentExecutorOptions) {}

  async runTurn(
    context: AuditToolContext,
    options: AgentTurnOptions,
  ): Promise<AuditSubmission | null> {
    const registry = new AuditToolTurnRegistry();
    const workspace = path.join(
      this.options.workspaceRoot,
      `${String(context.taskName).replace(/[^a-zA-Z0-9_-]/g, "_")}-${++this.nextSession}`,
    );
    const factory = this.options.sessionFactoryResolver?.(registry, workspace)
      ?? this.createProcessFactory(registry, workspace);
    let session: Awaited<ReturnType<AcpSessionFactory<AuditToolTurnRegistry>["createSession"]>> | null = null;
    let turn: ReturnType<AuditToolTurnRegistry["openTurn"]> | null = null;
    let timer: NodeJS.Timeout | undefined;
    const deadlineAt = Date.now() + options.timeoutMs;
    try {
      const sessionTask = factory.createSession({
        actorId: 0,
        registry,
        initialPrompt: auditSessionPrompt(),
      });
      const creation = await Promise.race([
        sessionTask.then((value) => ({ kind: "session" as const, value })),
        new Promise<{ kind: "timeout" }>((resolve) => {
          timer = setTimeout(() => resolve({ kind: "timeout" }), options.timeoutMs);
        }),
      ]);
      if (timer) {
        clearTimeout(timer);
        timer = undefined;
      }
      if (creation.kind === "timeout") {
        // 初始化可能仍在底层结束；完成后立即关闭，避免超时任务遗留进程。
        void sessionTask.then((lateSession) => lateSession.close()).catch(() => undefined);
        return null;
      }
      session = creation.value;
      turn = registry.openTurn(context, session.sessionId);
      const prompt = session.prompt(auditTurnPrompt(turn.turnId, context.mode));
      const remainingMs = Math.max(1, deadlineAt - Date.now());
      const timeout = new Promise<null>((resolve) => {
        timer = setTimeout(() => resolve(null), remainingMs);
      });
      const result = await Promise.race([
        turn.result,
        prompt.then(() => null, () => null),
        timeout,
      ]);
      if (result) await session.cancel().catch(() => undefined);
      return result;
    } catch {
      return null;
    } finally {
      if (timer) clearTimeout(timer);
      registry.closeTurn();
      await session?.close().catch(() => undefined);
    }
  }

  async close(): Promise<void> {}

  private createProcessFactory(
    registry: AuditToolTurnRegistry,
    workspace: string,
  ): AcpSessionFactory<AuditToolTurnRegistry> {
    const profile = this.options.profile;
    if (profile.kind !== "acp" || profile.provider.type !== "acp") {
      throw new Error("audit_acp_profile_required");
    }
    const extension = path.extname(__filename) === ".ts" ? ".ts" : ".js";
    const bridge: AcpMcpBridgeFactory<AuditToolTurnRegistry> = {
      serverName: "werewolf-audit",
      createControl: (turnRegistry) => new AuditMcpControlServer(turnRegistry),
      serverEntrypoint: () => path.join(__dirname, `audit_mcp_server${extension}`),
    };
    return new AcpProcessClient<AuditToolTurnRegistry>({
      command: profile.provider.command,
      args: [...(profile.provider.args ?? []), ...(profile.spawnArgs ?? [])],
      env: profile.provider.env,
      cwd: workspace,
      mcpBridge: bridge,
    });
  }
}

export function createSdkAuditAgentExecutor(client: AiSdkClient): AuditAgentExecutor {
  return new SdkAuditAgentExecutor(client);
}

/** Abstract Factory：调用方只提供统一 agent profile，不判断 SDK/ACP transport。 */
export function createAuditAgentExecutor(options: {
  profile: ResolvedAgentRuntimeProfile;
  workspaceRoot: string;
  llmOverride?: Partial<AgentProfileConfig>;
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
  const override = options.llmOverride ?? {};
  return new SdkAuditAgentExecutor(new AiSdkClient({
    providerType: profile.provider.type,
    providerName: profile.providerName,
    apiKey: profile.provider.apiKey,
    model: override.model ?? profile.model,
    baseURL: profile.provider.baseURL,
    userAgent: profile.provider.userAgent,
    temperature: override.temperature ?? profile.temperature ?? 0.1,
    maxTokens: override.maxTokens ?? profile.maxTokens ?? 1200,
    forceJsonResponse: override.forceJsonResponse ?? profile.forceJsonResponse ?? false,
    reasoningEnabled: override.reasoningEnabled ?? profile.reasoningEnabled ?? true,
    reasoningEffort: override.reasoningEffort ?? profile.reasoningEffort ?? "medium",
    thinkingEnabled: override.thinkingEnabled ?? profile.thinkingEnabled ?? false,
  }));
}
