/**
 * 负责广播版式的纯样式工具。输入为颜色、字号和显式文本，输出原有透明色、局部衬及保守行数。
 * 这里只估排版占幅，不解释台词、改字幕分页或推进事实时钟。
 */
import type { CSSProperties } from "react";
import type { SceneAppearance } from "./contracts";

export const quiet: CSSProperties = { minWidth: 0, overflowWrap: "anywhere" };
export const twoLines: CSSProperties = {
  display: "-webkit-box",
  WebkitLineClamp: 2,
  WebkitBoxOrient: "vertical",
  overflow: "hidden",
};
export const alpha = (color: string, opacity: number) =>
  /^#[\da-f]{6}$/i.test(color)
    ? `${color}${Math.round(opacity * 255)
        .toString(16)
        .padStart(2, "0")}`
    : color;

export function textRows(value: string, width: number, font: number) {
  let rows = 1,
    line = 0;
  for (const glyph of value) {
    if (glyph === "\n") {
      rows++;
      line = 0;
      continue;
    }
    const advance = font * (/[^\x00-\x7f]/.test(glyph) || /[MWmw@#%&]/.test(glyph) ? 1 : 0.65);
    if (line + advance > width) {
      rows++;
      line = 0;
    }
    line += advance;
  }
  return rows;
}

export function localSurface(
  appearance: SceneAppearance,
  scale: number,
  opacity = appearance.night
    ? appearance.surface.readingOpacityNight
    : appearance.surface.readingOpacityDay,
): CSSProperties {
  const { theme, surface } = appearance;
  return {
    backgroundColor: alpha(surface.readingColor, opacity),
    color: surface.readingText,
    borderLeft: `${theme.definition.frame.width * scale}px solid ${alpha(theme.definition.frame.color, 0.7)}`,
    ...(theme.options.paperTexture === true
      ? {
          backgroundImage: `repeating-linear-gradient(0deg, ${alpha(surface.readingText, 0.018)} 0px, ${alpha(surface.readingText, 0.018)} 1px, transparent 1px, transparent 4px)`,
        }
      : {}),
  };
}
