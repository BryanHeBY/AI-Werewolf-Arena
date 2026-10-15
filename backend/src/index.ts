/**
 * 后端公共导出入口。
 * 供测试脚本、服务层和外部调用方统一引入核心能力。
 * 这里只重导应用、AI、core、game 与预设配置的现有出口；不启动 CLI、加载私有运行配置或创建对局。
 */
export * from "./app";
export * from "./ai";
export * from "./core";
export * from "./game";
export * from "./runtime/scenarios";
