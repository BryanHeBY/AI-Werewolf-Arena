/**
 * 提供格式化调用方使用的中文词典及消息类型出口，来源是 catalog 的 zhCN 对象和契约包。
 * 输出保留同一普通原型、浅冻结字典及中文 literal 类型，不重新拼装语言数据。
 * 本公开入口不生成机器 ID、验证玩家参数或推断角色／阶段状态。
 */
export { zhCN } from "./messages/catalog";
export type { MessageKey } from "@ai-werewolf-arena/game-contract";
