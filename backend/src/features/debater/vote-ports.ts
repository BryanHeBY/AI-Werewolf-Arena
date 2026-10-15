/**
 * 负责公开杠精辩论权限与投票阻断的既有权威查询。
 * 输入为原 World 和玩家参数；输出为原 authority 或投票阻断结果。返回 authority 保持原引用与能力面，不把本端口宣称为裁剪后的只读 DTO 或新许可。
 * 本入口只具名重导原单一模块，保留函数、类、对象及类型的原声明绑定；不包装调用或重新注册。
 * 顶层只加载原模块及其原依赖，不聚合其他 owner；调用方仍在原 callee／参数位置读取，原错误和已写前缀照常传播。
 */
export {
  debateAuthority,
  debateVoteBlocked,
} from "./authority";
