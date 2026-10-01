import { AcpTurnRegistry } from "./acp_turn_registry";
import { AcpMcpBridgeFactory } from "./acp_mcp_bridge";
import { AcpSessionConfigOptionValue } from "./acp_session_config";

export interface AcpSessionUpdate {
  actorId: number;
  update: unknown;
}

/** ACP 回合结束后供复盘记录器读取的限长语义轨迹。 */
export interface AcpSessionAuditTrace {
  messages: string[];
  thoughts: string[];
}

export interface AcpSession {
  readonly sessionId: string;
  prompt(text: string): Promise<void>;
  cancel(): Promise<void>;
  close(options?: { force?: boolean }): Promise<void>;
  /** 返回并清空最近一次 prompt 的语义轨迹；适配器可不实现。 */
  takeAuditTrace?(): AcpSessionAuditTrace;
}

export interface AcpSessionCreateInput<TRegistry = AcpTurnRegistry> {
  actorId: number;
  registry: TRegistry;
  /** Fixed identity/protocol prompt; part of initialization's deadline. */
  initialPrompt?: string;
  deadlineAtMs?: number;
  signal?: AbortSignal;
}

export interface AcpSessionFactory<TRegistry = AcpTurnRegistry> {
  createSession(input: AcpSessionCreateInput<TRegistry>): Promise<AcpSession>;
}

export interface AcpProcessClientOptions<TRegistry = AcpTurnRegistry> {
  command: string;
  args?: string[];
  env?: Record<string, string>;
  cwd: string;
  initializeTimeoutMs?: number;
  onUpdate?: (update: AcpSessionUpdate) => void;
  /** Called after a prompt's update stream ends, including errors/cancellation. */
  onPromptEnd?: (actorId: number) => void;
  mcpBridge?: AcpMcpBridgeFactory<TRegistry>;
  /** session/new 后通过标准 ACP session/set_config_option 应用。 */
  sessionConfigOptions?: Record<string, AcpSessionConfigOptionValue>;
}
