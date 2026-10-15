/**
 * 负责向运行装配及场景调用方提供既有板子预设。
 * 固定十二人基础牌组及四钩子开关；只启用投票前自爆窗口，不由其它钩子开关自动扩展窗口。
 * 输入为本模块固定声明，输出为原 BoardConfig 数据；不在此解析、验证或冻结配置。
 * 预设不代表任意角色组合受支持，也不创建 World、支付资源或授予行动权限；规范化与有限支持由调用方继续执行。
 */
import { ActionWindow, BoardConfig, Role, WinCondition } from "../../core/domain/model";

/** 十二人基础输入供警长、白痴／猎人及白天中断场景消费；本声明本身不执行验证。 */
export const twelvePlayerStandardConfig: BoardConfig = {
  boardSize: 12,
  enableSheriff: true,
  winConditions: [WinCondition.SlaughterSide, WinCondition.WolfReachHalf],
  hooks: {
    onDaybreak: true,
    onPreElection: true,
    onPreVote: true,
    onPerSpeechGap: true,
  },
  selfDestruct: {
    enabledWindows: [ActionWindow.OnPreVote],
  },
  roleSetups: [
    { role: Role.Wolf, count: 4 },
    { role: Role.Villager, count: 4 },
    { role: Role.Seer, count: 1 },
    { role: Role.Witch, count: 1 },
    { role: Role.Hunter, count: 1 },
    { role: Role.Idiot, count: 1 },
  ],
};
