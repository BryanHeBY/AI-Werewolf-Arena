/**
 * 负责公开警徽唯一写方及原接收资格查询。
 * 输入为原 World、原持徽者、目标及事件；输出为原警长查询、资格或转移／销毁提交。票重与警徽按原字段序逐项写入；特殊 frame 与事实失败不伪装成原子回滚。
 * 本入口只具名重导原单一模块，保留函数、类、对象及类型的原声明绑定；不包装调用或重新注册。
 * 顶层只加载原模块及其原依赖，不聚合其他 owner；调用方仍在原 callee／参数位置读取，原错误和已写前缀照常传播。
 */
export {
  badgeSuccessorEligible,
  commitSheriffBadgeChoice,
  findSheriffId,
  transferOrDestroySheriffBadge,
} from "./badge";
