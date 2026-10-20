/**
 * 负责公开死亡枪工具规格、参数修复与预检贡献。
 * 输入为原工具候选和校验上下文；输出为原规格、修复结果或拒绝代码。规格和校验不扣枪、不产生死亡许可，实际付款由结算 owner 负责。
 * 本入口只具名重导原单一模块，保留函数、类、对象及类型的原声明绑定；不包装调用或重新注册。
 * 顶层只加载原模块及其原依赖，不聚合其他 owner；调用方仍在原 callee／参数位置读取，原错误和已写前缀照常传播。
 */
export { DEATH_SHOT_REPAIR, DEATH_SHOT_TOOL_SPECS, validateDeathShot } from "./death-shot";
