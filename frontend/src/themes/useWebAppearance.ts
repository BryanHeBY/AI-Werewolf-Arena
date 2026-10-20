/**
 * 负责网页外观偏好的本机持久化。输入为用户主题／减少动效选择，输出已解析网页主题与更新命令。
 * 只读写独立 localStorage 键，不修改视频项目主题、播放帧或归档；存储不可用及历史坏值安全回退。
 */
import { useEffect, useMemo, useState } from "react";
import {
  DEFAULT_WEB_THEME,
  parseThemeSelection,
  resolveTheme,
  type ThemeId,
  type ThemeSelection,
} from "./index";
export const WEB_APPEARANCE_STORAGE_KEY = "awa.web-appearance.v1";
export interface WebAppearance {
  theme: ThemeSelection;
  reduceMotion: boolean;
}
function initial(defaultTheme: ThemeId): WebAppearance {
  const fallback: WebAppearance = {
    theme: { id: defaultTheme },
    reduceMotion:
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true,
  };
  try {
    if (typeof localStorage === "undefined") return fallback;
    const raw = localStorage.getItem(WEB_APPEARANCE_STORAGE_KEY);
    if (!raw) return fallback;
    const value: unknown = JSON.parse(raw);
    if (
      !value ||
      typeof value !== "object" ||
      !("theme" in value) ||
      !("reduceMotion" in value) ||
      typeof value.reduceMotion !== "boolean"
    )
      return fallback;
    return { theme: parseThemeSelection(value.theme), reduceMotion: value.reduceMotion };
  } catch {
    return fallback;
  }
}
export function useWebAppearance(defaultTheme: ThemeId = DEFAULT_WEB_THEME) {
  const [appearance, setAppearance] = useState<WebAppearance>(() => initial(defaultTheme));
  const theme = useMemo(() => resolveTheme(appearance.theme), [appearance.theme]);
  useEffect(() => {
    try {
      localStorage.setItem(WEB_APPEARANCE_STORAGE_KEY, JSON.stringify(appearance));
    } catch {
      /* 隐私模式或存储配额不阻止当前页面采用用户选择。 */
    }
  }, [appearance]);
  return {
    appearance,
    theme,
    setTheme: (id: ThemeId) => setAppearance((current) => ({ ...current, theme: { id } })),
    setReduceMotion: (reduceMotion: boolean) =>
      setAppearance((current) => ({ ...current, reduceMotion })),
  };
}
export type WebAppearanceController = ReturnType<typeof useWebAppearance>;
