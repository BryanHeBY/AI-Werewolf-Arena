/**
 * 负责导出天亮后的中断窗口标识。输入来自 ActionWindow 定义，供后端调用方在白天发言之前引用。
 * 本文件仅提供常量，不读取玩家、授予权限或执行中断；启用条件、提交顺序和失败处理归实际阶段流程。
 */
import { ActionWindow } from "../../../core/domain/model";

export const onDaybreakHook = ActionWindow.OnDaybreak;
