/**
 * V3 后端公共导出入口。
 * 供测试脚本、服务层和外部调用方统一引入核心能力。
 */
export { GameContainer } from "./app/container";
export { bootstrapGame } from "./app/bootstrap";

export {
  Camp,
  Role,
  Phase,
  ActionWindow,
  StatusMark,
  WinCondition,
  PotionType,
} from "./domain/model";

export type {
  ActionProvider,
  ActionRequest,
  BoardConfig,
  ToolCall,
  RuntimeSnapshot,
  NightSummary,
  DaySummary,
  VotingSummary,
  GameEvent,
} from "./domain/model";

export { World } from "./domain/world";
export { PhaseManager } from "./engine/phase_manager";
export { ToolGateway } from "./gateway/tool_gateway";
export { V3SessionManager } from "./server/v3_session_manager";

export { sixPlayerMvpConfig } from "./scenarios/six_player_mvp";
export { twelvePlayerStandardConfig } from "./scenarios/twelve_player_standard";

export {
  NoopActionProvider,
  ScriptedActionProvider,
  BaselineBotActionProvider,
} from "./v3/action_providers";
