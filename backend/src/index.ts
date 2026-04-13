/**
 * V3 后端公共导出入口。
 * 供测试脚本、服务层和外部调用方统一引入核心能力。
 */
export * from "./app";
export * from "./ai";
export * from "./core";
export * from "./game";
export * from "./scenarios";
export { V3SessionManager } from "./server/v3_session_manager";
