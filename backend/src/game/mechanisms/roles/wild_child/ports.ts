/**
 * 提供野孩子准备状态、夜间单元和原生命死亡标记的公开入口。输入保留原 World、日期和玩家序号；
 * 输出是原准备结果、关闭能力或绑定上的死亡标记。死亡标记在实际 Alive 修改之前写入，
 * 权限与失败、关闭状态由具体生命周期所有者校验。本入口不复制状态、不修改阵营，
 * 已提交整波的具体贡献仍按首次榜样死亡和原生命验证转换，在梦记录／遗言前运行；
 * 不是晚 deathHook 或新的死亡提交器，失败保留榜样事实及原已提交前缀。
 * 玩家知识及请求 scope／工具读取仍使用原函数绑定，不重新捕获榜样或生成死亡授权。
 */
export { hasActiveWildChild, wildChildReady, openWildChildNight } from "./lifecycle";

export { recordWildChildDeathCommit } from "./lifecycle";

/** 具名登记同一完整 owner 函数，不包装调用、不复制榜样绑定或重新判断生命。 */
export { resolveWildChildDeathWave } from "./lifecycle";

export { projectWildChild } from "./lifecycle";

export { wildChildRequestScope } from "./lifecycle";

export { readWildChildTool } from "./state";
