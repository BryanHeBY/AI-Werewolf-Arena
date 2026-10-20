/**
 * 负责兼容既有项目使用的统一视频入口，保持原编排与渲染导出。
 * 新消费者分别使用 plan／render；本兼容入口包含 React 依赖，不用于纯数据命令。
 */
export * from "./plan";
export * from "./render";
