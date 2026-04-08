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

export { sixPlayerMvpConfig } from "./scenarios/six_player_mvp";
export { twelvePlayerStandardConfig } from "./scenarios/twelve_player_standard";

export { NoopActionProvider, ScriptedActionProvider } from "./v3/action_providers";
