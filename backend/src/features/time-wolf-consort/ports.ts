/**
 * 提供蚀时狼妃具体 pipeline 移交、经理终结、反射目标读取与玩家状态投影入口。
 * 输入为委托的原 World 读取及经理 World／日期；输出是清理单元、终结端口、运行类型和原名单断言。
 * 查询错误原样传播，单元只在原晚移交后抑制 pipeline abort；优先级 50 的阶段开启仍独立。
 * close 与重复 abort 保持原时点和 frame 错误；反射目标读视图不授付款或提交权限。
 * 原已付效果命令在旧位置消费同一提交凭证；本出口不渲染文字或创建另一生命周期所有者。
 */
export { TimeConsortNightUnit, timeConsortNightTerminal } from "./night-lifecycle";
export type { TimeConsortNightRuntime } from "./night-lifecycle";
export { isTimeConsortBoard, assertTimeConsortRosterCurrent } from "./night-frame";
export { resolveTimeConsortTarget } from "./night-frame";
export type { TimeConsortReceipt } from "./night-frame";
export { commitTimeConsortEffect } from "./effects";

/** 原槽同引用读取和脱离知识投影；历史／耗尽只说明已告知数据，不提供写入或付款入口。 */
export { getTimeConsortState, projectTimeConsortState } from "./state-slot";
