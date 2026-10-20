/**
 * 负责向本地工作台提供已有复盘页面；输入为已解析归档，输出共用播放器和外观控制。
 * 这里只装配现有组件，不读取本地配置、创建进程或复制投影算法；播放状态仍归原工作台。
 */
import { useState, useEffect, type CSSProperties } from "react";
import type { ReplayDocument } from "@ai-werewolf-arena/replay-contract";
import type { Locale } from "@ai-werewolf-arena/game-text";
import { ReplayWorkspace } from "./replay/ReplayWorkspace";
import { type WebAppearanceController } from "./themes/useWebAppearance";
import { themeToCssVariables, type ThemeTone } from "./themes";
import { DEFAULT_REPLAY_TIME_ZONE } from "./replay/replay-display";
export function WorkbenchReplay({
  replay,
  locale,
  appearance,
  tone = "day",
}: {
  replay: ReplayDocument;
  locale: Locale;
  appearance: WebAppearanceController;
  tone?: ThemeTone;
}) {
  const [display, setDisplay] = useState({ locale, timeZone: DEFAULT_REPLAY_TIME_ZONE });
  useEffect(() => setDisplay((current) => ({ ...current, locale })), [locale]);
  return (
    <div
      className="app-surface"
      data-web-theme={appearance.theme.id}
      data-reduced-motion={appearance.appearance.reduceMotion}
      style={themeToCssVariables(appearance.theme, tone) as CSSProperties}
    >
      <ReplayWorkspace
        replay={replay}
        display={display}
        onDisplayChange={(next) => setDisplay((current) => ({ ...current, ...next }))}
        webAppearance={appearance}
      />
    </div>
  );
}
