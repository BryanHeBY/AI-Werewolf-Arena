/**
 * 负责公开自爆候选的完整领域提交接口。
 * 输入为原 World、自爆候选、窗口标识、phase 与事件；输出为原提交结果。原内置演员守卫、首付与婚约／猎魔特殊前缀保持原顺序；本接口不接 current 回调，不把候选预检当作已经完成或新增清理事务。
 * 本入口只具名重导原单一模块，保留函数、类、对象及类型的原声明绑定；不包装调用或重新注册。
 * 顶层只加载原模块及其原依赖，不聚合其他 owner；调用方仍在原 callee／参数位置读取，原错误和已写前缀照常传播。
 */
export { commitSelfDestructSelection } from "./commit";
export { protectedBlastDeathPublication } from "./protected-publication";
