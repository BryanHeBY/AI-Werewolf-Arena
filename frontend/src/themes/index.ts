/**
 * 负责网页和视频共用的纯 JSON 主题定义、选项解析与插槽命名。输入为已登记主题 ID 及显式选项，输出独立的主题数据和 CSS 变量。
 * 消费者为网页工作台、视频编译器与场景宿主；主题不读取浏览器偏好、不判断游戏阶段或玩家身份，网页持久化与 React 插槽实现由各宿主单独装配。
 */
import { text } from "@ai-werewolf-arena/game-text";
import { createThemeVisualTokens, type ThemeVisualTokens } from "./tokens";
import { createThemeRoleColors, themeRoleCssVariables, type ThemeRoleColors } from "./role-colors";
import { createThemeActionColors, type ThemeActionColors } from "./action-colors";
export { roleAppearance, roleColorVariable, themeRoleCssVariables } from "./role-colors";
export { actionAppearance } from "./action-colors";
export type { ThemeRoleColors, RoleColorKey } from "./role-colors";
export type { ThemeActionColors } from "./action-colors";
export type * from "./tokens";
export type ThemeId = "gothic-v1" | "minimal-v1";
export type ThemeTone = "day" | "night";
export type ThemeOptionValue = boolean | string | number;
export type ThemeSlot =
  | "background"
  | "frame"
  | "seatBadge"
  | "sceneHeading"
  | "transition"
  | "playerCard"
  | "speech"
  | "ballot"
  | "actionEffect";
export type ThemeOptionDefinition =
  { type: "boolean"; default: boolean } | { type: "choice"; default: string; values: string[] };
export interface ThemePalette {
  canvas: string;
  canvasText: string;
  canvasMuted: string;
  panel: string;
  paper: string;
  ink: string;
  text: string;
  muted: string;
  border: string;
  accent: string;
  accentText: string;
  good: string;
  wolf: string;
  neutral: string;
  danger: string;
  success: string;
}
export interface ThemeDefinition extends ThemeVisualTokens {
  roleColors: ThemeRoleColors;
  actionColors: ThemeActionColors;
  id: ThemeId;
  version: 1;
  label: { "zh-CN": string; en: string };
  palette: { day: ThemePalette; night: ThemePalette };
  fonts: { body: string; heading: string; mono: string };
  radii: { panel: number; card: number };
  options: Record<string, ThemeOptionDefinition>;
  /** 值为注册键，组件进入宿主 bundle，永远不进入主题 JSON。 */
  slots: Record<ThemeSlot, string>;
}
export interface ThemeSelection {
  id: ThemeId;
  options?: Record<string, ThemeOptionValue>;
}
export interface ResolvedTheme {
  id: ThemeId;
  definition: ThemeDefinition;
  options: Record<string, ThemeOptionValue>;
}
export type ThemeSlotRegistry<T> = Readonly<Record<string, T>>;
export const DEFAULT_WEB_THEME: ThemeId = "minimal-v1";
export const DEFAULT_VIDEO_THEME: ThemeId = "gothic-v1";

const mono = '"SFMono-Regular", Consolas, monospace';
const sans = '"Noto Sans SC", "Microsoft YaHei", ui-sans-serif, system-ui, sans-serif';
const serif = '"Noto Serif SC", "Songti SC", "SimSun", Georgia, serif';
const slots = (id: ThemeId): Record<ThemeSlot, string> => ({
  background: `${id}/background`,
  frame: `${id}/frame`,
  seatBadge: `${id}/seatBadge`,
  sceneHeading: `${id}/sceneHeading`,
  transition: `${id}/transition`,
  playerCard: `${id}/playerCard`,
  speech: `${id}/speech`,
  ballot: `${id}/ballot`,
  actionEffect: `${id}/actionEffect`,
});
const gothicDay: ThemePalette = {
  canvas: "#505b67",
  canvasText: "#edf0f3",
  canvasMuted: "#d0d7dd",
  panel: "#e3e7ea",
  paper: "#eef0ef",
  ink: "#20262b",
  text: "#242a31",
  muted: "#5c6871",
  border: "#9ba7af",
  accent: "#77343e",
  accentText: "#f3efea",
  good: "#35576b",
  wolf: "#8f3d4a",
  neutral: "#626b72",
  danger: "#a44552",
  success: "#45675f",
};
const gothicNight: ThemePalette = {
  canvas: "#101723",
  canvasText: "#e4e9ed",
  canvasMuted: "#b7c4cf",
  panel: "#1e2938",
  paper: "#dbe1e4",
  ink: "#252a30",
  text: "#e4e9ed",
  muted: "#b7b9bc",
  border: "#657083",
  accent: "#a9bfd0",
  accentText: "#15202a",
  good: "#8ab9cb",
  wolf: "#df8790",
  neutral: "#b6b1a6",
  danger: "#f1a0a6",
  success: "#a3c7a0",
};
const minimalDay: ThemePalette = {
  canvas: "#f2f4f7",
  canvasText: "#162131",
  canvasMuted: "#526174",
  panel: "#ffffff",
  paper: "#ffffff",
  ink: "#162131",
  text: "#162131",
  muted: "#526174",
  border: "#cbd3df",
  accent: "#274f85",
  accentText: "#ffffff",
  good: "#28627b",
  wolf: "#a1374b",
  neutral: "#677284",
  danger: "#a72d44",
  success: "#2d6c48",
};
const minimalNight: ThemePalette = {
  canvas: "#111722",
  canvasText: "#edf1f6",
  canvasMuted: "#b2bfcd",
  panel: "#1b2533",
  paper: "#edf0f4",
  ink: "#172131",
  text: "#edf1f6",
  muted: "#b2bfcd",
  border: "#48576c",
  accent: "#9fc5ff",
  accentText: "#12233b",
  good: "#8bbfd7",
  wolf: "#ed9aa6",
  neutral: "#b2bfcd",
  danger: "#ffabb7",
  success: "#a0d6b6",
};
const definitions: Record<ThemeId, ThemeDefinition> = {
  "gothic-v1": {
    ...createThemeVisualTokens(true),
    roleColors: createThemeRoleColors(),
    actionColors: createThemeActionColors(),
    id: "gothic-v1",
    version: 1,
    label: { "zh-CN": text("zh-CN", "theme.gothic_name"), en: text("en", "theme.gothic_name") },
    palette: { day: gothicDay, night: gothicNight },
    fonts: { body: sans, heading: serif, mono },
    radii: { panel: 8, card: 5 },
    options: {
      paperTexture: { type: "boolean", default: false },
      ornamentalFrames: { type: "boolean", default: false },
      waxSeals: { type: "boolean", default: false },
      largeText: { type: "boolean", default: false },
      reducedMotion: { type: "boolean", default: false },
    },
    slots: slots("gothic-v1"),
  },
  "minimal-v1": {
    ...createThemeVisualTokens(false),
    roleColors: createThemeRoleColors(),
    actionColors: createThemeActionColors(),
    id: "minimal-v1",
    version: 1,
    label: { "zh-CN": text("zh-CN", "theme.minimal_name"), en: text("en", "theme.minimal_name") },
    palette: { day: minimalDay, night: minimalNight },
    fonts: { body: sans, heading: sans, mono },
    radii: { panel: 14, card: 9 },
    options: {
      density: { type: "choice", default: "comfortable", values: ["comfortable", "compact"] },
      highContrast: { type: "boolean", default: false },
      largeText: { type: "boolean", default: false },
      reducedMotion: { type: "boolean", default: false },
    },
    slots: slots("minimal-v1"),
  },
};
export const THEME_IDS: readonly ThemeId[] = ["gothic-v1", "minimal-v1"];
function plain(value: unknown): value is Record<string, unknown> {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null)
  );
}
function fail(): never {
  throw new Error("theme_selection_invalid");
}
export function parseThemeSelection(value: unknown): ThemeSelection {
  if (
    !plain(value) ||
    Object.getOwnPropertyNames(value).some((key) => !["id", "options"].includes(key))
  )
    fail();
  // TS 项目也可传入对象；非枚举 accessor 不能绕过白名单后在读取 id 时执行。
  for (const key of Object.getOwnPropertyNames(value))
    if (!("value" in Object.getOwnPropertyDescriptor(value, key)!)) fail();
  if (!Object.hasOwn(value, "id") || !THEME_IDS.includes(value.id as ThemeId)) fail();
  const id = value.id as ThemeId;
  if (!Object.hasOwn(value, "options") || value.options === undefined) return { id };
  if (!plain(value.options)) fail();
  const options: Record<string, ThemeOptionValue> = {};
  for (const key of Object.getOwnPropertyNames(value.options)) {
    const descriptor = Object.getOwnPropertyDescriptor(value.options, key)!;
    const schema = Object.hasOwn(definitions[id].options, key)
      ? definitions[id].options[key]
      : undefined;
    if (!schema || !("value" in descriptor)) fail();
    const option = descriptor.value;
    if (
      schema.type === "boolean"
        ? typeof option !== "boolean"
        : typeof option !== "string" || !schema.values.includes(option)
    )
      fail();
    options[key] = option;
  }
  return { id, options };
}
export function resolveTheme(
  selection: ThemeSelection | ThemeId = DEFAULT_VIDEO_THEME,
): ResolvedTheme {
  const parsed = parseThemeSelection(typeof selection === "string" ? { id: selection } : selection);
  const definition = structuredClone(definitions[parsed.id]);
  const options = Object.fromEntries(
    Object.entries(definition.options).map(([key, schema]) => [
      key,
      parsed.options?.[key] ?? schema.default,
    ]),
  );
  return { id: parsed.id, definition, options };
}
/** 旧 version1 已编译计划补齐新增语义 token；保留作者已有值，不重编译事件或修改输入计划。 */
export function normalizeResolvedTheme(theme: ResolvedTheme): ResolvedTheme {
  const defaults = resolveTheme(theme.id);
  const saved = structuredClone(theme);
  const base = defaults.definition;
  const previous = saved.definition;
  return {
    ...defaults,
    ...saved,
    options: { ...defaults.options, ...saved.options },
    definition: {
      ...base,
      ...previous,
      roleColors: {
        ...base.roleColors,
        ...previous.roleColors,
        roles: { ...base.roleColors.roles, ...previous.roleColors?.roles },
        palette: {
          day: { ...base.roleColors.palette.day, ...previous.roleColors?.palette?.day },
          night: { ...base.roleColors.palette.night, ...previous.roleColors?.palette?.night },
        },
      },
      actionColors: {
        families: { ...base.actionColors.families, ...previous.actionColors?.families },
        tools: { ...base.actionColors.tools, ...previous.actionColors?.tools },
      },
      palette: {
        day: { ...base.palette.day, ...previous.palette?.day },
        night: { ...base.palette.night, ...previous.palette?.night },
      },
      fonts: { ...base.fonts, ...previous.fonts },
      radii: { ...base.radii, ...previous.radii },
      options: { ...base.options, ...previous.options },
      slots: { ...base.slots, ...previous.slots },
      typography: { ...base.typography, ...previous.typography },
      surface: {
        ...base.surface,
        ...previous.surface,
        palette: {
          day: { ...base.surface.palette.day, ...previous.surface?.palette?.day },
          night: { ...base.surface.palette.night, ...previous.surface?.palette?.night },
        },
      },
      frame: {
        ...base.frame,
        ...previous.frame,
        activity: { ...base.frame.activity, ...previous.frame?.activity },
      },
      connector: { ...base.connector, ...previous.connector },
      effect: { ...base.effect, ...previous.effect },
      motion: {
        ...base.motion,
        ...previous.motion,
        standard: { ...base.motion.standard, ...previous.motion?.standard },
      },
    },
  };
}
export function themePalette(theme: ResolvedTheme, tone: ThemeTone): ThemePalette {
  return theme.definition.palette[tone];
}
/** 阅读颜色由表面拥有，避免透明哥特白天误用原浅色 panel 的深色正文。 */
export function themeSurface(theme: ResolvedTheme, tone: ThemeTone) {
  return { ...theme.definition.surface, ...theme.definition.surface.palette[tone] };
}
/** 插槽是可选增强；主题切换只选择注册项，不执行或把组件写入可序列化计划。 */
export function getThemeSlot<T>(
  registry: ThemeSlotRegistry<T>,
  theme: ResolvedTheme,
  slot: ThemeSlot,
): T | undefined {
  const key = theme.definition.slots[slot];
  return Object.hasOwn(registry, key) ? registry[key] : undefined;
}
export function themeToCssVariables(
  theme: ResolvedTheme,
  tone: ThemeTone,
): Record<`--awa-${string}`, string> {
  const palette = themePalette(theme, tone);
  // 网页字体独立别名避免全局 CSS face 抢占同页视频的项目字体；两者仍加载同一授权字节。
  const webFont = (stack: string) =>
    stack
      .replace('"Noto Sans SC"', '"AWA Web Noto Sans SC"')
      .replace('"Noto Serif SC"', '"AWA Web Noto Serif SC"');
  return {
    ...Object.fromEntries(Object.entries(palette).map(([key, value]) => [`--awa-${key}`, value])),
    ...themeRoleCssVariables(theme, tone),
    "--awa-font-body": webFont(theme.definition.fonts.body),
    "--awa-font-heading": webFont(theme.definition.fonts.heading),
    "--awa-font-mono": theme.definition.fonts.mono,
    "--awa-radius-panel": `${theme.definition.radii.panel}px`,
    "--awa-radius-card": `${theme.definition.radii.card}px`,
    "--awa-motion-duration": `${theme.definition.motion.durationMs}ms`,
    "--awa-web-body-size": `${theme.definition.typography.webBody}px`,
    "--awa-web-name-size": `${theme.definition.typography.webName}px`,
    "--awa-web-role-size": `${theme.definition.typography.webRole}px`,
    "--awa-frame-width": `${theme.definition.frame.secondaryWidth}px`,
    "--awa-frame-active-width": `${theme.definition.frame.activeWidth}px`,
  };
}
