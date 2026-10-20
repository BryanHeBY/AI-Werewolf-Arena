/**
 * 负责定义 ACP 进程会话、创建输入与流式回调契约；输入由会话池／进程适配器提供。
 * 输出接口保留 registry、桥接工厂和取消信号等运行引用，不作为可序列化游戏协议。
 * 会话实现拥有传输副作用；期限合并、迟到回收与关闭去重由创建实现和会话池分别负责。
 * 取消通知不等于资源已关闭；这些结构和 sessionId 本身不授予游戏行动权限。
 */
import { AcpTurnRegistry } from "./acp-turn-registry";
import type { AgentOutput } from "@ai-werewolf-arena/replay-contract";
import { AcpMcpBridgeFactory } from "./acp-mcp-bridge";
import { AcpSessionConfigOptionValue } from "./acp-session-config";

/** update 是适配器原始通知；actorId 标明所属玩家，消费者仍需解析，不能当作公开游戏事件。 */
export interface AcpSessionUpdate {
  actorId: number;
  update: unknown;
}

/** 回合结束供记录器读取的限长模型原文轨迹；thoughts 不是玩家公开知识，保留原语言。 */
export interface AcpSessionAuditTrace {
  /** 原生结构化轨迹；旧注入会话可以只实现兼容的 messages／thoughts 摘要。 */
  outputs?: AgentOutput[];
  messages: string[];
  thoughts: string[];
}

/** 实现封装一个会话的 prompt／取消／关闭；拒绝原因和强制关闭语义由具体实现负责。 */
export interface AcpSession {
  /** 会话关联标识；进程实现可使用桥接 registry 的标识，不承诺等于远端 ACP sessionId。 */
  readonly sessionId: string;
  prompt(text: string): Promise<void>;
  cancel(): Promise<void>;
  close(options?: { force?: boolean }): Promise<void>;
  /** 返回并清空最近一次 prompt 的语义轨迹；适配器可不实现。 */
  takeAuditTrace?(): AcpSessionAuditTrace;
}

/** registry 保持原运行对象；绝对期限与 signal 约束创建等待，不从 DTO 重建行动许可。 */
export interface AcpSessionCreateInput<TRegistry = AcpTurnRegistry> {
  actorId: number;
  registry: TRegistry;
  /** 固定身份／协议提示，属于初始化的同一份期限预算，不另获一个游戏回合。 */
  initialPrompt?: string;
  deadlineAtMs?: number;
  signal?: AbortSignal;
}

export interface AcpSessionFactory<TRegistry = AcpTurnRegistry> {
  createSession(input: AcpSessionCreateInput<TRegistry>): Promise<AcpSession>;
}

/** 进程命令、环境和工作目录属于启动边界；流式通知／结束回调不承担游戏提交或落盘。 */
export interface AcpProcessClientOptions<TRegistry = AcpTurnRegistry> {
  command: string;
  args?: string[];
  env?: Record<string, string>;
  cwd: string;
  initializeTimeoutMs?: number;
  /** 同步显示回调；抛错后继续消费协议更新，并在本次 prompt 结束时报告原错误。 */
  onUpdate?: (update: AcpSessionUpdate) => void;
  /** 更新流结束时调用，包括错误／取消；异常与已有错误一并报告，不覆盖协议失败或表示行动成功。 */
  onPromptEnd?: (actorId: number) => void;
  mcpBridge?: AcpMcpBridgeFactory<TRegistry>;
  /** session/new 后通过标准 ACP session/set_config_option 应用。 */
  sessionConfigOptions?: Record<string, AcpSessionConfigOptionValue>;
}
