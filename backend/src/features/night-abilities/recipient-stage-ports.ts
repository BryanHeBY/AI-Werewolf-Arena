/**
 * 负责公开受赠夜能力的完整执行阶段与当夜提交记录。
 * 输入为原阶段上下文和原受赠来源；输出为原阶段执行及其提交记录。该 owner 保选择、预检、首付、后续效果和记录顺序，查询提交记录不等于新授行动权限。
 * 本入口只具名重导原单一模块，保留函数、类、对象及类型的原声明绑定；不包装调用或重新注册。
 * 顶层只加载原模块及其原依赖，不聚合其他 owner；调用方仍在原 callee／参数位置读取，原错误和已写前缀照常传播。
 */
export {
  hasRecipientNightCommit,
  recipientAbilityStage,
  recordRecipientNightCommit,
} from "./recipient-ability-stage";
