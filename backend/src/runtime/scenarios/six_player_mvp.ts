/**
 * 负责向运行装配及场景调用方提供既有板子预设。
 * 固定六人基础牌组，关闭警长与四个钩子，并按数组顺序声明屠城、狼达半两项目标。
 * 输入为本模块固定声明，输出为原 BoardConfig 数据；不在此解析、验证或冻结配置。
 * 预设不代表任意角色组合受支持，也不创建 World、支付资源或授予行动权限；规范化与有限支持由调用方继续执行。
 */
import { BoardConfig, Role, WinCondition } from "../../core/domain/model";

/** 六人基础输入供夜昼流转与守卫／预言家场景消费；本声明本身不执行验证。 */
export const sixPlayerMvpConfig: BoardConfig = {
  boardSize: 6,
  enableSheriff: false,
  winConditions: [WinCondition.SlaughterCity, WinCondition.WolfReachHalf],
  hooks: {
    onDaybreak: false,
    onPreElection: false,
    onPreVote: false,
    onPerSpeechGap: false,
  },
  roleSetups: [
    { role: Role.Wolf, count: 2 },
    { role: Role.Villager, count: 2 },
    { role: Role.Seer, count: 1 },
    { role: Role.Guard, count: 1 },
  ],
};
