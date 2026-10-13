/**
 * 提供狼巫具体耦合清理、原生名单查询及玩家状态投影入口。
 * 输入为原 World／日期与魔术师只读移交视图；输出保留清理单元、经理终结端口与名单断言。
 * 开启仍由优先级 100 的阶段拥有，出口不授予目标或库存写者；原 frame 错误在原时点传播。
 * 查询不渲染、不记录，也不为共享移交值建立第二个所有者。
 */
export { WolfSorcererNightUnit, wolfSorcererNightTerminal } from "./night-lifecycle";
export type { WolfSorcererNightRuntime } from "./night-lifecycle";
export { assertWolfSorcererRosterCurrent } from "./night_frame";

export { getWolfSorcererState } from "./state";
