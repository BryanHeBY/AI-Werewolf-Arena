import { ActionRequest } from "./model";

/**
 * 读取规范化后的回合日次。
 *
 * `context.day` 是唯一日次字段。
 */
export function getActionRequestDay(request: ActionRequest): number {
  const parsed = Number(request.context.day);
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * 读取 Agent 可见的细粒度流程名。
 *
 * 主阶段始终由 `request.phase` 表示；`context.stage` 是唯一细粒度流程字段。
 */
export function getActionRequestStage(request: ActionRequest): string {
  return String(request.context.stage ?? request.actionWindow ?? request.phase);
}
