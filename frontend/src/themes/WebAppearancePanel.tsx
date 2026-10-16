/**
 * 负责网页主题与减少动效的显式设置。输入为宿主外观控制器和语言，输出本机偏好变更。
 * 网页外观只改变 CSS，不重建视频计划、不修改播放游标；主题显示名来自同一纯 JSON 注册表。
 */
import { text, type Locale } from "@ai-werewolf-arena/game-text";
import { resolveTheme, THEME_IDS, type ThemeId } from "./index";
import type { WebAppearanceController } from "./useWebAppearance";

export function WebAppearancePanel({
  locale,
  controller,
}: {
  locale: Locale;
  controller: WebAppearanceController;
}) {
  return (
    <section className="panel appearance-panel">
      <h2>{text(locale, "replay.appearance")}</h2>
      <p>{text(locale, "replay.video_theme_independent")}</p>
      <label>
        {text(locale, "replay.web_theme")}
        <select
          aria-label={text(locale, "replay.web_theme")}
          value={controller.theme.id}
          onChange={(event) => controller.setTheme(event.target.value as ThemeId)}
        >
          {THEME_IDS.map((id) => (
            <option key={id} value={id}>
              {resolveTheme(id).definition.label[locale]}
            </option>
          ))}
        </select>
      </label>
      <label className="checkbox-label">
        <input
          type="checkbox"
          checked={controller.appearance.reduceMotion}
          onChange={(event) => controller.setReduceMotion(event.target.checked)}
        />
        {text(locale, "replay.reduce_motion")}
      </label>
      <div className="theme-swatches" aria-hidden="true">
        {["canvas", "panel", "accent", "wolf", "good"].map((color) => (
          <span key={color} style={{ background: `var(--awa-${color})` }} />
        ))}
      </div>
    </section>
  );
}
