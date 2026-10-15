/**
 * 负责导出每位玩家发言之后的中断窗口标识。输入来自 ActionWindow 定义，供后端调用方引用。
 * 本文件仅提供常量，不读取玩家、授予权限或执行中断；是否启用、提交顺序和失败处理归实际阶段流程。
 */
import { ActionWindow } from "../../../core/domain/model";

export const onPerSpeechGapHook = ActionWindow.OnPerSpeechGap;
