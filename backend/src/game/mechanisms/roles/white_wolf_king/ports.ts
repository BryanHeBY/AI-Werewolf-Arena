/**
 * 提供白狼王状态、消耗与玩家投影绑定，输入为原角色或捕获数据，输出为原引用或玩家数据副本。
 * 白天／投票窗口在提交之前复验资格，所选提交才写资源；本入口不复制／冻结数据、推进阶段或提交死亡。
 * 失败和失效仍由实际 owner 按原终态处理，公开命令与 readonly 类型都不自行授予行动许可。
 */
export { getWhiteWolfKingState, consumeWhiteWolfDetonation, projectWhiteWolfKingState } from "./state";
