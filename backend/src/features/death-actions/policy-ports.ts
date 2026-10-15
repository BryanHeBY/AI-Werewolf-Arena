/**
 * 负责公开原生死亡枪的配置与纯展示政策。
 * 输入为原角色死亡政策与配置值；输出为原 schema 配置贡献或原文案。该接口不授枪权、不读取实际库存，也不提前消费配置 getter。
 * 本入口只具名重导原单一模块，保留函数、类、对象及类型的原声明绑定；不包装调用或重新注册。
 * 顶层只加载原模块及其原依赖，不聚合其他 owner；调用方仍在原 callee／参数位置读取，原错误和已写前缀照常传播。
 */
export {
  deathActionConfiguration,
  renderDeathActionPolicy,
} from "./death-action-policy";
