/**
 * 负责 V2 backends、agents、game、可选 audit 及已解析运行配置的类型结构。输入／输出关系分别描述模型 API、ACP 进程、玩家覆盖与装配结果。
 * 配置数据由读取／解析和 setup 所有者管理；此契约不加载文件或环境、不创建 Agent，也不拥有角色库存或全局缓存。
 */
/** `openai` 同时覆盖 OpenRouter 等 Chat Completions 兼容网关。 */
import type { Locale } from "@ai-werewolf-arena/game-contract";
import type { SettingsManager } from "@earendil-works/pi-coding-agent";
export type ProviderType = "openai" | "anthropic" | "acp" | "pi";

/** 由已安装 Pi SDK 推导原生设置；AWA 不复制其字段表，也不加载原生设置文件。 */
export type PiSettings = ReturnType<SettingsManager["getSettings"]>;
export type GameBoard = string;
export type ReasoningEffort = "none" | "minimal" | "low" | "medium" | "high" | "xhigh";

/** 模型网关连接参数由 provider 持有；模型与单轮采样参数归 Agent profile。并发限额只约束本地请求调度。 */
export interface LlmProviderConfig {
  type: "openai" | "anthropic";
  apiKey: string;
  baseURL?: string;
  userAgent?: string;
  maxConcurrentRequests?: number;
}

/** ACP 是 Agent 进程传输，不是模型 API Provider。 */
export interface AcpProviderConfig {
  type: "acp";
  transport: "stdio";
  command: string;
  args: string[];
  env: Record<string, string>;
  cwd?: string;
  initializeTimeoutMs?: number;
  maxConcurrentRequests?: number;
  sessionConfigOptions: Record<string, string | boolean>;
}

/** Pi 连接描述是原生 models.json / auth.json 的内存对象，不提供文件路径或隐式 home 回退。 */
export interface PiProviderConfig {
  type: "pi";
  models: Record<string, unknown>;
  auth: Record<string, unknown>;
  maxConcurrentRequests?: number;
}

export type ProviderConfig = LlmProviderConfig | AcpProviderConfig | PiProviderConfig;

/** 提示配置只保存人格文本；实际注入由玩家提示策略统一执行，不授予游戏动作权限。 */
export interface AgentPromptConfig {
  personalityPrompt?: string;
}

export interface AgentProfileConfig extends AgentPromptConfig {
  model: string;
  temperature?: number;
  maxTokens?: number;
  reasoningEffort?: ReasoningEffort;
  thinkingEnabled?: boolean;
}

export interface LlmAgentEntryConfig extends AgentProfileConfig {
  kind: "llm";
  provider: string;
}

export interface AcpAgentEntryConfig extends AgentPromptConfig {
  kind: "acp";
  provider: string;
  /** 静态启动参数；不得包含身份或对局状态。 */
  spawnArgs?: string[];
  sessionReuse?: "per_player";
  actionTransport?: "mcp";
  sessionConfigOptions?: Record<string, string | boolean>;
}

export interface PiAgentEntryConfig extends AgentPromptConfig {
  kind: "pi";
  provider: string;
  piSettings: PiSettings;
}

export type AgentEntryConfig = LlmAgentEntryConfig | AcpAgentEntryConfig | PiAgentEntryConfig;

export interface ProvidersConfig {
  default: string;
  items: Record<string, ProviderConfig>;
}

export interface AgentsConfig {
  default: string;
  items: Record<string, AgentEntryConfig>;
}

/** 对局引用已定义的 Agent；对象形式可覆盖提示词及 ACP 启动参数。 */
export type GameAgentSelection =
  | string
  | {
      agent: string;
      spawnArgs?: string[];
      personalityPrompt?: string;
    };

/** 玩家专属人格可按语言选择；未设置表示继承，null 表示清除，选择后的字符串仍保留原文。 */
export type LocalizedPrompt = string | Partial<Record<Locale, string>>;
export interface PlayerConfig {
  name?: string;
  agent?: string;
  spawnArgs?: string[];
  /** null 明确清除继承人格；字符串原文保留。 */
  personalityPrompt?: LocalizedPrompt | null;
}

export interface GameConfig {
  board?: GameBoard;
  maxDays?: number;
  maxRuntimeMs?: number;
  llmTimeoutMs?: number;
  trace?: boolean;
  printAllEvents?: boolean;
  printChat?: boolean;
  streamEvents?: boolean;
  color?: boolean;
  printLlmIo?: boolean;
  printThinking?: boolean;
  printPrivateEvents?: boolean;
  recordRootDir?: string;
  agent?: string;
  roleAgents?: Record<string, GameAgentSelection>;
  playerAgents?: Record<string, GameAgentSelection>;
  players?: Record<string, PlayerConfig>;
  /** locale 控制玩家提示，displayLocale 控制展示；未设置的展示语言跟随玩家语言。 */
  locale?: Locale;
  displayLocale?: Locale;
  seed?: string;
}

export interface DebugSummaryAgentConfig {
  enabled?: boolean;
  agentName?: string;
  timeoutMs?: number;
  maxAttempts?: number;
  concurrency?: number;
  publicMaxItems?: number;
  maxItems?: number;
  playerMaxItems?: number;
}

export interface DebugSummaryConfig {
  agent?: DebugSummaryAgentConfig;
}

/** V2 公共文件归一后的运行输入；providers 是内部连接表的唯一副本，不再对应旧 providers.json。 */
export interface RuntimeConfig {
  providers: ProvidersConfig;
  agents: AgentsConfig;
  game: GameConfig;
  debugSummary?: DebugSummaryConfig;
}

export interface ResolvedAuditConfig {
  profile: ResolvedAgentRuntimeProfile;
  timeoutMs: number;
  maxAttempts: number;
  concurrency: number;
  publicMaxItems: number;
  maxItems: number;
  playerMaxItems: number;
}

/** 装配结果引用已校验的 provider 配置；这是运行输入，不包含进程、会话或请求租约。 */
export interface ResolvedAgentRuntimeProfile extends AgentPromptConfig {
  name: string;
  providerName: string;
  provider: ProviderConfig;
  kind: "llm" | "acp" | "pi";
  piSettings?: PiSettings;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  reasoningEffort?: ReasoningEffort;
  thinkingEnabled?: boolean;
  spawnArgs?: string[];
  sessionReuse?: "per_player";
  actionTransport?: "mcp";
}
