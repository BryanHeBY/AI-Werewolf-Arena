/**
 * 提供野孩子准备状态、夜间单元和原生命死亡标记的公开入口。输入保留原 World、日期和玩家序号；
 * 输出是原准备结果、关闭能力或绑定上的死亡标记。死亡标记在实际 Alive 修改之前写入，
 * 权限与失败、关闭状态由具体生命周期所有者校验。本入口不复制状态、不修改阵营，
 * 也不替代后续有序死亡波中的榜样转换。
 */
export { hasActiveWildChild, wildChildReady, openWildChildNight } from "./lifecycle";

export { recordWildChildDeathCommit } from "./lifecycle";
