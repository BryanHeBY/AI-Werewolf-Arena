/**
 * 负责公开遗言政策授予的默认机制与上下文类型。
 * 输入为原死因、来源阶段和初始波上下文；输出为原默认单例及原类型绑定。默认实例仍只在原 getDefaultLastWordsMechanism 调用的首次空值分支惰性创建；本接口不替代真实发言窗口或开放死亡许可。
 * 本入口只具名重导原单一模块，保留函数、类、对象及类型的原声明绑定；不包装调用或重新注册。
 * 顶层只加载原模块及其原依赖，不聚合其他 owner；调用方仍在原 callee／参数位置读取，原错误和已写前缀照常传播。
 */
export type {
  LastWordsGrantContext,
} from "./last-words-mechanism";
export {
  getDefaultLastWordsMechanism,
} from "./last-words-mechanism";
