/**
 * 负责公开本人夜行动历史写入与幸运目标政策查询。
 * 输入为原 World、演员、日次、行动种类、目标、能力与 lucky／recipient 政策；输出为原目标判定或本人历史写入。历史和库存当前许可独立，原读取与记录写入的失败前缀保持，不接收事件端口或构造第二日志。
 * 本入口只具名重导原单一模块，保留函数、类、对象及类型的原声明绑定；不包装调用或重新注册。
 * 顶层只加载原模块及其原依赖，不聚合其他 owner；调用方仍在原 callee／参数位置读取，原错误和已写前缀照常传播。
 */
export { luckyTargetAllowed, recordOwnNightAction } from "./night-action-history";
