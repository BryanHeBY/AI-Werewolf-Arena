/**
 * 向后端公开对局装配与玩家轮次记录的应用入口。输入为显式配置、World 或原决策数据，
 * 输出为装配结果与记录适配；具体角色结算不归本出口，记录结果也不授予行动权限。
 */
export { bootstrapGame } from "./bootstrap";
export type { BootstrapResult } from "./bootstrap";
export { PlayerRoundRecorder } from "./player-round-recorder";
