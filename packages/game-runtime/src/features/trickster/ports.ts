/**
 * 负责公开诡术师状态读／脱离副本与原共享清理、名单查询端口。输入为原角色或 World／day；
 * 输出为本族唯一 reader／project、清理单位和原名单复验。方法与状态实现仍归同族唯一 owner。
 * 时点保留阶段 priority=100 的开夜和经理放逐前终结；正常完成／中止、finished 当日映射与原体生命仍归 frame。
 * 公开知识读不授库存／放逐写权；最终映射输出在原放逐点同步消费 frame 的唯一 exileResolved。
 * 返回同一原输出，不复制付款或提前发表；异常沿原调用栈传播，不增加关闭去重或许可。
 * 不另存魔术师移交标志、不推进阶段、记录或渲染；初始化／历史 writer 不作为跨族公开许可。
 */
export { TricksterNightUnit, tricksterNightTerminal } from "./night-lifecycle";
export type { TricksterNightRuntime } from "./night-lifecycle";
export { assertTricksterRosterCurrent, resolveTricksterExile } from "./night-frame";
export { getTricksterState, projectTricksterState } from "./state-slot";
