/**
 * 向运行装配和外部消费者导出 SDK／ACP、共同玩家观察与受限回退策略。mock／脚本／Baseline 是明确特权驱动，生产回退经观察接口接入。此出口不复制状态、扩展资源权限或执行模型调用。
 */
export * from "./providers/action_providers";
export * from "./llm/llm_action_provider";
export * from "./acp/acp_action_provider";
export * from "./game_tool_protocol";
export * from "./player/contracts";
export * from "./player/player_prompt_policy";

export * from "./reporting";

export { ObservationFallbackStrategy } from "./providers/observation-fallback";
export type {
  ObservedPlayerStrategy,
  PlayerObservation,
} from "../../game/observation/player-observation";
