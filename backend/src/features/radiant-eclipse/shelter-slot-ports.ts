/**
 * 负责公开庇护的完整受信状态槽契约。
 * 输入为调用方原已准备状态或原实例；输出为同一个 SHELTER_STATE_SLOT 对象。对象含 prepare／schema／install／allowedWrites／checkpoint／invalidations，确实包含受信写能力；原 prepare 与严格 reader 接受集合不同，不能伪称只读或完整行动校验。
 * 本入口只具名重导原单一模块，保留函数、类、对象及类型的原声明绑定；不包装调用或重新注册。
 * 顶层只加载原模块及其原依赖，不聚合其他 owner；调用方仍在原 callee／参数位置读取，原错误和已写前缀照常传播。
 */
export { SHELTER_STATE_SLOT } from "./shelter-state-slot";
