/**
 * 负责保留核心层板子 schema 的兼容入口；唯一结构定义及校验器属于 game-contract。
 * 输入为共享配置格式，导出同一个严格 schema，不读取配置文件、不合并默认值或判断组合可运行性。
 * 结构校验不等于运行许可，也不承诺任意 Proxy 的读取没有副作用。
 */
export { boardConfigSchema } from "@ai-werewolf-arena/game-contract";
