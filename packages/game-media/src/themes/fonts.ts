/**
 * 负责登记随应用分发的授权本地字体，以及项目字体对内置同 family 的显式替换。输入为已准备项目字体，输出独立字体列表。
 * 静态 URL 由 Vite／Remotion 收集同一 WOFF2 字节；完整来源、原版权与 SHA256 在 fonts/manifest.json，不读宿主 OS 字体。
 */
export interface ThemeFontFace {
  family: string;
  src: string;
  weight?: string;
}
export const BUILTIN_FONT_FACES: readonly ThemeFontFace[] = [
  {
    family: "Noto Sans SC",
    src: new URL("./fonts/NotoSansSC-VF.woff2", import.meta.url).href,
    weight: "100 900",
  },
  {
    family: "Noto Serif SC",
    src: new URL("./fonts/NotoSerifSC-VF.woff2", import.meta.url).href,
    weight: "200 900",
  },
];

export function resolveVideoFontFaces(project: readonly ThemeFontFace[] = []): ThemeFontFace[] {
  const family = (name: string) => name.trim().toLowerCase();
  const custom = new Set(project.map((font) => family(font.family)));
  // 同 family 的全部显式字重由项目拥有，避免内置可变字体与作者静态字重竞争匹配。
  return [...BUILTIN_FONT_FACES.filter((font) => !custom.has(family(font.family))), ...project].map(
    (font) => ({ ...font }),
  );
}
