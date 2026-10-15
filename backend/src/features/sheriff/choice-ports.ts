/**
 * 负责公开死亡持徽选择的完整请求与提交接口。
 * 输入为原警徽、死亡许可、provider 和构造端口；输出为原转移或销毁结果。F02 每请求完成、组件／特殊 frame 全付款点及 finally 原错误优先仍由同一 choice owner 负责。
 * 本入口只具名重导原单一模块，保留函数、类、对象及类型的原声明绑定；不包装调用或重新注册。
 * 顶层只加载原模块及其原依赖，不聚合其他 owner；调用方仍在原 callee／参数位置读取，原错误和已写前缀照常传播。
 */
export {
  resolveSheriffBadge,
} from "./badge-choice";
