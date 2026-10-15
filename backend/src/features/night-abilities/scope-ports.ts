/**
 * 负责公开原夜能力原体捕获与未付资格接口。
 * 输入为原 World、角色、来源和夜号；输出为原 scope。scope 的纯 ownerCurrent／已付效果当前性与未付 isEligible 分别保持，不在公共出口新增统一退休、关窗或深层 DTO 校验。
 * 本入口只具名重导原单一模块，保留函数、类、对象及类型的原声明绑定；不包装调用或重新注册。
 * 顶层只加载原模块及其原依赖，不聚合其他 owner；调用方仍在原 callee／参数位置读取，原错误和已写前缀照常传播。
 */
export { captureNightAbilityScope } from "./ability-scope";
