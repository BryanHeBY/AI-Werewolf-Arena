/** 负责客户端视图需要的目录数据类型；输入服务端公开摘要，输出表单和列表使用的数据结构，不包含认证或控制令牌。 */
import type { BoardCard } from "@ai-werewolf-arena/workbench-contract";
import type { WorkbenchTextKey } from "@ai-werewolf-arena/game-text/workbench";
export type Translator = (key: WorkbenchTextKey) => string;
export interface AgentSummary {
  name: string;
  backend: string;
  kind?: string;
  provider?: string;
  model?: string;
}
export interface Catalog {
  games: string[];
  defaultAgent?: string;
  agents: AgentSummary[];
  backends: { name: string; kind?: string }[];
  boards: BoardCard[];
}
export type Page = "home" | "games" | "boards" | "agents" | "logs" | "replay";
