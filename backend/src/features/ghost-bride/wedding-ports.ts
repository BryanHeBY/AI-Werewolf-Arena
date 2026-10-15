/**
 * 负责公开婚约对狼队、自爆与警徽的具体协作接口。
 * 输入为原 World、婚约成员和原操作参数；输出为原准备状态、成员查询、吞徽提交或吞徽状态。查询、知识与实际吞徽写入各保原政策，不把已付 chat／knife 统一按请求 envelope 撤回。
 * 本入口只具名重导原单一模块，保留函数、类、对象及类型的原声明绑定；不包装调用或重新注册。
 * 顶层只加载原模块及其原依赖，不聚合其他 owner；调用方仍在原 callee／参数位置读取，原错误和已写前缀照常传播。
 */
export {
  ghostBrideReady,
  swallowWeddingBadges,
  weddingBadgeSwallowed,
  weddingMember,
  weddingSetup,
} from "./authority";
