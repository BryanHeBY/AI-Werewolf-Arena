/**
 * 负责结构化播报字段的共享语义颜色。输入为主题显式颜色与已披露阵营，输出展示色；Web默认读取现有CSS变量。
 * danger表示生命出局，wolf表示明确阵营，两者语义独立；未知阵营不从角色、台词或头像反推。
 */
import type { AnnouncementCamp } from "./announcement-content";

export interface SemanticColors {
  good: string;
  wolf: string;
  thirdParty: string;
  unknown: string;
  accent: string;
  muted: string;
  danger: string;
}
export function semanticColors(colors: Partial<SemanticColors> = {}): SemanticColors {
  return {
    good: "var(--awa-good, #39758b)",
    wolf: "var(--awa-wolf, #b52e42)",
    thirdParty: "var(--awa-neutral, #8666a5)",
    unknown: "var(--awa-muted, #718096)",
    accent: "var(--awa-accent, #9b6d17)",
    muted: "var(--awa-muted, #718096)",
    danger: "var(--awa-wolf, #b52e42)",
    ...colors,
  };
}
export function announcementCampColor(camp: AnnouncementCamp, colors: SemanticColors): string {
  return camp === "good"
    ? colors.good
    : camp === "wolf"
      ? colors.wolf
      : camp === "third_party"
        ? colors.thirdParty
        : colors.unknown;
}

/** 视频暗衬不能依赖Web的CSS变量；由当前主题显式提供同一套语义色，第三方阵营复用主题中性色。 */
export function paletteSemanticColors(
  palette: { good: string; wolf: string; neutral: string; accent: string },
  muted: string,
): SemanticColors {
  return {
    good: palette.good,
    wolf: palette.wolf,
    thirdParty: palette.neutral,
    unknown: muted,
    accent: palette.accent,
    muted,
    danger: palette.wolf,
  };
}
