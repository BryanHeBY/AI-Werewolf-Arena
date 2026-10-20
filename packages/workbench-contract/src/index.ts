/**
 * 负责工作台与运行实例共用的纯 JSON 契约，输出配置文档、诊断、日志及运行状态类型。
 * 输入均为数据；消费者分别是本地服务、CLI 与浏览器，不包含认证解析、进程句柄或游戏行动权限。
 */
export type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
export type JsonObject = { [key: string]: Json };
export type ConfigKind = "backends" | "agents" | "games" | "boards";
export interface ConfigDocument {
  kind: ConfigKind;
  name: string;
  revision: string | null;
  text: string;
}
export interface Diagnostic {
  code: string;
  path?: string;
  severity: "error" | "warning";
}
export type RunState =
  | "starting"
  | "running"
  | "finalizing"
  | "completed"
  | "failed"
  | "cancelled"
  | "lost"
  | "interrupted";
export interface RunMetadata {
  schemaVersion: 1;
  sessionId: string;
  instanceId: string;
  pid: number;
  processStart: string | null;
  host: string;
  bootId: string | null;
  origin: "cli" | "workbench";
  gameName: string;
  board: string;
  startedAt: string;
  heartbeatAt: string;
  endedAt?: string;
  state: RunState;
  control?: { url: string; token: string };
  errorCode?: string;
}
export interface CompletionReceipt {
  schemaVersion: 1;
  sessionId: string;
  endedAt: string;
  files: string[];
}
export interface ConsoleChunk {
  seq: number;
  timestamp: string;
  text: string;
}
export interface SessionEntry {
  sessionId: string;
  board: string;
  gameName?: string;
  origin?: "cli" | "workbench";
  startedAt: string;
  endedAt?: string;
  state: RunState | "legacy";
  game: "decided" | "unfinished" | "unknown";
  recording: "running" | "complete" | "partial" | "legacy";
  winner?: string | null;
  finishReason?: string;
  canStop: boolean;
  canReplay: boolean;
  errorCode?: string;
  /** 删除确认绑定当前文件版本；缺省表示该旧摘要尚未支持删除。 */
  revision?: string;
  canDelete?: boolean;
  deleteBlock?: string;
}
export interface BoardCard {
  id: string;
  size: number;
  roles: { role: string; count: number }[];
  supported: boolean;
  diagnostic?: Diagnostic;
  source: "local" | "example";
  /** 只包含已通过板子 parser 的公开规则，不转发损坏文档的未知字段。 */
  rules?: JsonObject;
  mechanisms?: JsonObject;
  roleOptions?: JsonObject;
}
/** 已保存游戏的公开摘要；Agent 指令及任何连接认证都不进入目录卡片。 */
export interface GameCard {
  id: string;
  source: "local";
  revision?: string;
  board?: string;
  size?: number;
  defaultAgent?: string;
  roleAgents: Record<string, string>;
  seatAgents: Record<string, string>;
  diagnostic?: Diagnostic;
}
export const ACTIVE_RUN_STATES: readonly RunState[] = ["starting", "running", "finalizing"];
