/**
 * 负责64种正式角色的主题美术配色与日夜色板。输入仅为已允许展示的角色ID、主题和阅读表面，输出纯色值及CSS变量。
 * 颜色描述角色美术，不判断当前阵营、复制技能或隐藏身份；未知角色固定中性，阵营标签和行动高亮由各自拥有者处理。
 */
import type { RoleId } from "@ai-werewolf-arena/game-contract";

export type RoleColorKey =
  | "blood"
  | "rose"
  | "crown"
  | "iron"
  | "dusk"
  | "sage"
  | "azure"
  | "amethyst"
  | "teal"
  | "ochre"
  | "steel"
  | "ivory"
  | "violet"
  | "amber"
  | "slate"
  | "neutral";
export interface ThemeRoleColors {
  roles: Record<RoleId, RoleColorKey>;
  palette: Record<"day" | "night", Record<RoleColorKey, string>>;
}

/** 显式覆盖全部正式角色；新角色必须由主题作者选择美术归属，不按名字片段或当前阵营猜色。 */
export const ROLE_COLOR_KEYS = {
  wolf: "blood",
  villager: "sage",
  seer: "azure",
  witch: "amethyst",
  hunter: "ochre",
  guard: "teal",
  idiot: "ivory",
  wolf_king: "crown",
  white_wolf_king: "crown",
  knight: "steel",
  gravekeeper: "slate",
  dreamer: "violet",
  wolf_beauty: "rose",
  bear: "ochre",
  hidden_wolf: "dusk",
  gargoyle: "iron",
  psychic: "azure",
  mirror_girl: "ivory",
  mechanical_wolf: "iron",
  miracle_merchant: "amber",
  black_market_merchant: "amber",
  hybrid: "neutral",
  thief: "slate",
  shapeshifter: "slate",
  lonely_girl: "violet",
  wild_child: "sage",
  ghost_bride: "violet",
  cupid: "violet",
  cursed_fox: "amber",
  demon_hunter: "steel",
  pure_white_girl: "ivory",
  wolf_witch: "dusk",
  evil_knight: "iron",
  red_moon_apostle: "blood",
  alchemist: "teal",
  raven_claw_wolf: "blood",
  radiant_count: "teal",
  eclipse_maid: "dusk",
  night_noble: "dusk",
  fragrant_phantom: "rose",
  nightmare: "dusk",
  magician: "azure",
  trickster: "steel",
  wolf_sorcerer: "dusk",
  order_prince: "amber",
  time_wolf_consort: "rose",
  day_scholar: "amber",
  night_mentor: "dusk",
  debater: "amber",
  silence_elder: "sage",
  crow: "slate",
  white_cat: "ivory",
  fox_cub: "dusk",
  pufferfish: "ochre",
  warden: "amber",
  awakened_idiot: "ivory",
  awakened_seer: "azure",
  awakened_wolf_king: "crown",
  awakened_hidden_wolf: "iron",
  awakened_wolf_beauty: "rose",
  awakened_witch: "amethyst",
  awakened_hunter: "ochre",
  awakened_guard: "teal",
  awakened_knight: "steel",
} satisfies Record<RoleId, RoleColorKey>;

export function createThemeRoleColors(): ThemeRoleColors {
  // 暗面使用明亮而低饱和的刻字色，亮面采用同色相深色；卡片底色与边框只表达活动状态。
  const day = {
    blood: "#882f41",
    rose: "#84324d",
    crown: "#783e2c",
    iron: "#6c434c",
    dusk: "#733e53",
    sage: "#3b553f",
    azure: "#2a5271",
    amethyst: "#5f4277",
    teal: "#245752",
    ochre: "#67491e",
    steel: "#375165",
    ivory: "#594d34",
    violet: "#5e475e",
    amber: "#69481d",
    slate: "#41505c",
    neutral: "#494f54",
  } satisfies Record<RoleColorKey, string>;
  const night = {
    blood: "#f3b4bb",
    rose: "#f0b4ca",
    crown: "#ecba99",
    iron: "#dfbbc1",
    dusk: "#dcbcc6",
    sage: "#b6cba2",
    azure: "#a3c9e8",
    amethyst: "#d3bce7",
    teal: "#9dcfc0",
    ochre: "#dec08b",
    steel: "#b5c7d8",
    ivory: "#dfd2ad",
    violet: "#d2bdd9",
    amber: "#dfbf8f",
    slate: "#b8c7cf",
    neutral: "#bec5c9",
  } satisfies Record<RoleColorKey, string>;
  return {
    roles: { ...ROLE_COLOR_KEYS },
    palette: {
      day: { ...day },
      night: { ...night },
    },
  };
}

/** 旧计划可缺新增token；只补美术默认值，不读取归档或重编译历史。 */
export function roleAppearance(
  theme: { definition: { roleColors?: ThemeRoleColors } },
  tone: "day" | "night",
  visibleRole: string,
) {
  const colors = theme.definition.roleColors ?? createThemeRoleColors();
  const key = Object.hasOwn(colors.roles, visibleRole)
    ? colors.roles[visibleRole as RoleId]
    : "neutral";
  return colorFamilyAppearance(theme, tone, key);
}

/** 角色与动作引用同套主题色板，但各自独立选择色系；公共能力不需要读取玩家底牌。 */
export function colorFamilyAppearance(
  theme: { definition: { roleColors?: ThemeRoleColors } },
  tone: "day" | "night",
  key: RoleColorKey,
) {
  return { key, ink: (theme.definition.roleColors ?? createThemeRoleColors()).palette[tone][key] };
}

/** CSS角色变量仅接受正式ID；未知值共享中性变量，避免任意字符串进入CSS变量名。 */
export function roleColorVariable(visibleRole: string, fallback = "currentColor") {
  const id = Object.hasOwn(ROLE_COLOR_KEYS, visibleRole) ? visibleRole : "unknown";
  return `var(--awa-role-${id}, ${fallback})`;
}
export function themeRoleCssVariables(
  theme: Parameters<typeof roleAppearance>[0],
  tone: "day" | "night",
): Record<`--awa-${string}`, string> {
  return Object.fromEntries(
    [...Object.keys(ROLE_COLOR_KEYS), "unknown"].map((role) => [
      `--awa-role-${role}`,
      roleAppearance(theme, tone, role).ink,
    ]),
  );
}
