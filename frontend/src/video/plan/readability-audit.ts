/**
 * 负责默认视频播报的机械可读性诊断。输入为真实编译场景与权威生命覆盖，输出不含原话的固定问题码。
 * 只检查可证明的待确认页、无结构长公告与空行动字段；不把玩家原话的关键词当问题，也不代替浏览器量高与人工看图。
 */
import type { VideoScene } from "../types";

export const READABILITY_ISSUES = [
  "provisional-life-report",
  "long-unstructured-announcement",
  "empty-generic-action",
] as const;
export type ReadabilityIssue = (typeof READABILITY_ISSUES)[number];

export function auditSceneReadability(
  scene: VideoScene,
  committedDeaths: boolean,
): ReadabilityIssue[] {
  if (scene.kind === "speech" || scene.bodyLayout === "text" || scene.emphasis.length) return [];
  const issues: ReadabilityIssue[] = [];
  if (committedDeaths && scene.visual?.life?.playerIds.length && !scene.visual.life.committed)
    issues.push("provisional-life-report");
  const blocks = scene.content?.blocks ?? [];
  // 80字符是待审工作量阈值，不假装知道实际换行；有专属字段布局的名单不再按原长句误报。
  if (
    scene.kind !== "action" &&
    scene.kind !== "ballot" &&
    scene.body.length > 80 &&
    blocks.every((block) => block.kind === "record")
  )
    issues.push("long-unstructured-announcement");
  if (
    blocks.some(
      (block) =>
        block.kind === "action" &&
        block.actorId === undefined &&
        !block.requestedTargetIds.length &&
        !block.effectiveTargetKnown &&
        !block.recipientIds.length,
    )
  )
    issues.push("empty-generic-action");
  return issues;
}
