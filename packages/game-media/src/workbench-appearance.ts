/**
 * 负责向统一工作台公开现有主题、字体与同源美术素材；输入主题选择，输出原主题变量及静态资源地址。
 * 网页偏好仍归原 useWebAppearance，不复制视频色板或更改成片主题；消费者不经此入口读取配置或启动渲染。
 */
export { useWebAppearance, type WebAppearanceController } from "./themes/useWebAppearance";
export {
  themeToCssVariables,
  resolveTheme,
  THEME_IDS,
  DEFAULT_VIDEO_THEME,
  type ThemeId,
  type ThemeTone,
} from "./themes";
export const workbenchArt = {
  day: new URL("./video/assets/gothic/fog-day.png", import.meta.url).href,
  night: new URL("./video/assets/gothic/fog-night.png", import.meta.url).href,
  emblem: new URL("./video/assets/gothic/identity-medallion-v1.png", import.meta.url).href,
};
