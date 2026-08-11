import { ActionRequest } from "./model";

/**
 * 读取规范化后的回合日次。
 *
 * 新协议使用 `context.day`；保留 `current_day` 仅为读取已有记录和旧调用方。
 */
export function getActionRequestDay(request: ActionRequest): number {
  const parsed = Number(request.context.day ?? request.context.current_day);
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * 读取 Agent 可见的细粒度流程名。
 *
 * 主阶段始终由 `request.phase` 表示；`context.stage` 是唯一的新写入字段。
 * 后续分支只用于兼容尚未迁移的调用方。
 */
export function getActionRequestStage(request: ActionRequest): string {
  return String(
    request.context.stage ??
      request.context.phase ??
      request.actionWindow ??
      request.context.window ??
      request.phase,
  );
}
