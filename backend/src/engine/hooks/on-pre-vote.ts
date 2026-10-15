/**
 * 负责导出放逐投票之前的中断窗口标识。输入来自 ActionWindow 定义，供后端调用方引用该时点。
 * 本文件仅提供常量，不读取玩家、授予权限或执行中断；实际调用顺序、启用条件和失败处理归阶段管理器。
 */
import { ActionWindow } from "../../domain/model";

export const onPreVoteHook = ActionWindow.OnPreVote;
