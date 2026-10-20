/**
 * 负责读取请求中的日次与细粒度流程名。输入为已有 ActionRequest；输出为供提示、
 * 工具反馈和记录使用的数字／字符串，不修改请求，也不查询 World 或授予行动权限。
 * 保留原类型转换与兼容回退；这些显示字段不能替代机制的原请求身份或当前性校验。
 */
import { ActionRequest } from "./model";

/**
 * 读取规范化后的回合日次。
 *
 * `context.day` 是唯一日次字段。
 * 保留 Number 转换；非有限值回退为 0，此处不额外验证整数或游戏日是否合法。
 */
export function getActionRequestDay(request: ActionRequest): number {
  const parsed = Number(request.context.day);
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * 读取 Agent 可见的细粒度流程名。
 *
 * 主阶段始终由 `request.phase` 表示；`context.stage` 是唯一细粒度流程字段。
 * 旧输入缺少 stage 时依次回退 actionWindow、phase；使用空值回退，空字符串不被替换。
 */
export function getActionRequestStage(request: ActionRequest): string {
  return String(request.context.stage ?? request.actionWindow ?? request.phase);
}
