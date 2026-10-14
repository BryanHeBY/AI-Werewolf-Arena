/**
 * 负责向普通狼人夜阶段公开贵族刀口事实发布的实际同步函数。
 * 输入由调用方在原已接受刀口时点传入；输出保原函数绑定，不包装、提前查询或新增权限。
 * 写事件与必需记录归具体发布 owner，失败保已写前缀；投票、库存和生命写权留原所有者。
 */
export { publishNobleNightKnife } from "./night-knife-publication";
export type { NobleNightKnifePublicationRuntime } from "./night-knife-publication";
