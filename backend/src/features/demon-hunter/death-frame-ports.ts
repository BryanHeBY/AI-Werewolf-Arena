/**
 * 负责公开猎魔板子自爆提交与警徽审计 frame 接口。
 * 输入为原 World、玩家和原事件／回调；输出为原自爆／封夜提交结果（day／sealsNight）、警徽可读断言或 frame。frame 是实际权威能力，写入、清理和审计的原顺序与异常前缀不由本端口包装。
 * 本入口只具名重导原单一模块，保留函数、类、对象及类型的原声明绑定；不包装调用或重新注册。
 * 顶层只加载原模块及其原依赖，不聚合其他 owner；调用方仍在原 callee／参数位置读取，原错误和已写前缀照常传播。
 */
export {
  assertDemonBadgeReadable,
  commitDemonRedMoonBlast,
  openDemonBadgeFrame,
} from "./authority";
