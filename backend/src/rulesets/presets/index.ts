/**
 * 负责旧内置六／十二人板子与覆盖解析器的具名导出，供后端既有程序消费者使用。
 * 输出保持原三条导出及顺序；不汇总全部玩法预设，也不替代版本化配置或 ruleset 支持性检查。
 */
export { sixPlayerMvpConfig } from "./six-player-mvp";
export { twelvePlayerStandardConfig } from "./twelve-player-standard";
export { resolveBoardConfig } from "./board-config-resolver";
