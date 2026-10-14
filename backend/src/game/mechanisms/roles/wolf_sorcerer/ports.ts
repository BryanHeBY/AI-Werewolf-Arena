/**
 * 提供狼术师具体耦合清理、原生名单查询及玩家状态投影入口。
 * 输入为原 World／日期与魔术师只读移交视图；输出保留清理单元、经理终结端口与名单断言。
 * 开启仍由优先级 100 的阶段拥有，出口不授予目标或库存写者；原 frame 错误在原时点传播。
 * 查询不渲染、不记录，也不为共享移交值建立第二个所有者。
 * 单元的关闭终态与失败前缀仍由夜间生命周期维护，出口不重开已结束的夜间窗口。
 */
export { WolfSorcererNightUnit, wolfSorcererNightTerminal } from "./night-lifecycle";
export type { WolfSorcererNightRuntime } from "./night-lifecycle";
export { assertWolfSorcererRosterCurrent } from "./night_frame";

/** 同绑定 live 读取保原引用，知识投影脱离；两者均不授库存／交换提交或阶段许可。 */
export { getWolfSorcererState, projectWolfSorcererState } from "./state-slot";
