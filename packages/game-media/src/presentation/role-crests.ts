/**
 * 负责 64 个正式 RoleId 的显式金属蚀刻纹章登记。输入为已披露的角色 ID，输出静态小尺寸图形资料；未知 ID 返回 null。
 * 纹章与 LLM 头像、当前阵营、能力副本及查验报告独立；家族仅是美术复用分类，不授予技能或推断隐藏身份。
 */
import type { RoleId } from "@ai-werewolf-arena/game-contract";

const motifs = {
  pack_attack: "M8 6L6 17M13 5L10 19M18 6L14 18",
  civic_ballot: "M6 12H18V19H6ZM9 12V6H15V12M10 9L12 11L15 7",
  inspection_camp: "M12 5A5 5 0 1 0 12 15A5 5 0 1 0 12 5ZM12 15V20M9 20H15",
  inspection_role: "M7 5H17V19H7ZM10 9H14M10 12H14M10 15H13",
  inspection_pair:
    "M8 6A4 4 0 1 0 8 14A4 4 0 1 0 8 6ZM16 6A4 4 0 1 0 16 14A4 4 0 1 0 16 6ZM8 14V18H16V14",
  potion: "M9 5H15M10 5V9L7 15V19H17V15L14 9V5M8 15H16",
  protection: "M12 5L18 8V12Q17 17 12 20Q7 17 6 12V8ZM12 8V16",
  death_action: "M6 9H18V13H13L11 19H8L10 13H6ZM15 9V6M7 7H11",
  reveal_survival: "M6 7Q12 3 18 7V13Q12 21 6 13ZM8 10H10M14 10H16M10 15H14",
  duel: "M7 5L16 17M17 5L8 17M5 15L9 19M15 19L19 15M11 7L13 7",
  relation_link: "M10 8L8 6Q3 8 6 13L11 17M14 16L16 18Q21 16 18 11L13 7M9 15L15 9",
  animal_signal: "M7 10Q3 13 7 16M10 8Q4 13 10 18M13 6Q5 13 13 20M17 10V16L20 13Z",
  inheritance: "M7 6H17V10L12 14L7 10ZM12 14V20M8 18H16",
  copy_resource: "M6 5H15V16H6ZM10 9H19V20H10M9 8H12",
  gift_resource: "M5 10H19V18H5ZM12 10V18M4 7H20V10H4ZM12 7Q5 2 7 5ZM12 7Q19 2 17 5Z",
  affiliation: "M7 5V20M7 6H18L15 10L18 14H7",
  identity_choice: "M5 6H11V18H5ZM13 6H19V18H13M8 9V15M16 9V15",
  independent_survival: "M7 7L8 14L12 19L16 14L17 7L13 9H11ZM10 14H14",
  reflection: "M7 5L12 9L17 5V14L12 19L7 14ZM6 11H16M13 8L16 11L13 14",
  suppression: "M7 5H17V10L12 13L7 10ZM7 19H17V14L12 11L7 14M6 6L18 18",
  mapping: "M5 7H10V17H5ZM14 7H19V17H14M8 11H16M13 8L16 11L13 14",
  modifier: "M5 8H13M9 4V12M13 17H20M7 16L9 18L7 20",
  expression: "M5 6H19V15H12L8 19V15H5ZM8 9H16M9 12H14",
  delayed_life: "M7 5H17M7 19H17M8 5V9L16 15V19M16 5V9L8 15V19",
  secret_decision: "M5 7H19V18H5ZM5 7L12 13L19 7M10 15H14",
} as const;
export type RoleCrestFamily = keyof typeof motifs;
/** 简约技能图复用既有语义刻痕，不携带任何本体角色 ID。 */
export function roleFamilyMotif(family: RoleCrestFamily): string {
  return motifs[family];
}
export interface RoleCrestDefinition {
  family: RoleCrestFamily;
  motif: string;
  detail: string;
  awakened: boolean;
}
const crest = (family: RoleCrestFamily, detail = "", awakened = false): RoleCrestDefinition => ({
  family,
  motif: motifs[family],
  detail,
  awakened,
});

// 显式键表使新增正式角色必须补登记；特殊变体保留小刻痕，文字身份仍是主要可读信息。
export const ROLE_CRESTS = {
  wolf: crest("pack_attack"),
  villager: crest("civic_ballot", "M8 3H16"),
  seer: crest("inspection_camp"),
  witch: crest("potion"),
  hunter: crest("death_action"),
  guard: crest("protection"),
  idiot: crest("reveal_survival"),
  wolf_king: crest("death_action", "M7 4L9 2L12 4L15 2L17 4"),
  white_wolf_king: crest("death_action", "M6 4H18M9 2V5M15 2V5"),
  knight: crest("duel"),
  gravekeeper: crest("inspection_camp", "M5 19H19M5 17V19M19 17V19"),
  dreamer: crest("relation_link", "M5 4H9M7 2V6"),
  wolf_beauty: crest("relation_link", "M17 3L20 6L17 9L14 6Z"),
  bear: crest("animal_signal", "M15 5L17 3L19 5"),
  hidden_wolf: crest("inheritance", "M6 3H10M14 3H18"),
  gargoyle: crest("inspection_role", "M6 4L3 7L6 10M18 4L21 7L18 10"),
  psychic: crest("inspection_role", "M9 3H15M12 1V4"),
  mirror_girl: crest("inspection_role", "M5 5V19M19 5V19"),
  mechanical_wolf: crest("copy_resource", "M17 4H20V7"),
  miracle_merchant: crest("gift_resource", "M8 20H16"),
  black_market_merchant: crest("gift_resource", "M8 20H16M12 19V22"),
  hybrid: crest("affiliation", "M17 17L20 20M20 17L17 20"),
  thief: crest("identity_choice", "M8 3H16"),
  shapeshifter: crest("identity_choice", "M6 3H10M14 3H18"),
  lonely_girl: crest("affiliation", "M17 18H20M18.5 16.5V19.5"),
  wild_child: crest("inheritance", "M5 16L3 19M19 16L21 19"),
  ghost_bride: crest("relation_link", "M7 3H17M9 1V4M15 1V4"),
  cupid: crest("relation_link", "M9 3L12 6L15 3"),
  cursed_fox: crest("independent_survival", "M6 3L9 6M18 3L15 6"),
  demon_hunter: crest("duel", "M4 9L2 12L4 15M20 9L22 12L20 15"),
  pure_white_girl: crest("inspection_role", "M9 21H15"),
  wolf_witch: crest("inspection_role", "M7 21H10M14 21H17"),
  evil_knight: crest("reflection", "M8 3H16"),
  red_moon_apostle: crest("suppression", "M6 4Q12 0 18 4"),
  alchemist: crest("potion", "M4 12H6M18 12H20M12 20V22"),
  raven_claw_wolf: crest("inheritance", "M5 4L3 8M19 4L21 8"),
  radiant_count: crest("protection", "M8 3V1M12 3V0M16 3V1"),
  eclipse_maid: crest("copy_resource", "M8 2H16M10 2V4M14 2V4"),
  night_noble: crest("relation_link", "M8 3H16M12 1V4"),
  fragrant_phantom: crest("relation_link", "M4 4Q8 0 10 4M14 4Q18 0 20 4"),
  nightmare: crest("suppression", "M4 8L2 12L4 16M20 8L22 12L20 16"),
  magician: crest("mapping", "M7 3L9 1L11 3M13 3L15 1L17 3"),
  trickster: crest("mapping", "M4 20H10M14 20H20"),
  wolf_sorcerer: crest("mapping", "M8 3H16"),
  order_prince: crest("civic_ballot", "M7 3L10 5L12 2L14 5L17 3"),
  time_wolf_consort: crest("reflection", "M8 2H16M12 1V4"),
  day_scholar: crest("modifier", "M17 4V8M15 6H19"),
  night_mentor: crest("modifier", "M17 3Q13 6 17 9"),
  debater: crest("civic_ballot", "M3 4H7M17 4H21"),
  silence_elder: crest("expression", "M8 19L16 5"),
  crow: crest("civic_ballot", "M17 4L21 2L20 7"),
  white_cat: crest("delayed_life", "M6 6L5 2L9 5M18 6L19 2L15 5"),
  fox_cub: crest("suppression", "M5 4L7 1L10 4M14 4L17 1L19 4"),
  pufferfish: crest("death_action", "M3 9V15M21 9V15M9 2H15"),
  warden: crest("secret_decision", "M9 4H15M12 2V6"),
  awakened_idiot: crest("protection", "M9 10H10M14 10H15", true),
  awakened_seer: crest("inspection_pair", "", true),
  awakened_wolf_king: crest("death_action", "M5 3L8 5M19 3L16 5", true),
  awakened_hidden_wolf: crest("copy_resource", "M4 17L7 20", true),
  awakened_wolf_beauty: crest("relation_link", "M17 3L20 6L17 9L14 6Z", true),
  awakened_witch: crest("secret_decision", "M9 4H15M10 2V4M14 2V4", true),
  awakened_hunter: crest("death_action", "M6 3L12 1L18 3", true),
  awakened_guard: crest("protection", "M3 6V17M21 6V17", true),
  awakened_knight: crest("duel", "M7 21H17", true),
} satisfies Record<RoleId, RoleCrestDefinition>;

export function getRoleCrest(role: string): RoleCrestDefinition | null {
  return Object.hasOwn(ROLE_CRESTS, role) ? ROLE_CRESTS[role as RoleId] : null;
}

/** 仅消费当前投影已披露身份；未知底牌只接受已公开翻牌，不读取原归档或未来角色。 */
export function visibleIdentityRole(player: { role: string; publicRole?: string }): string {
  const role = player.role === "unknown" ? player.publicRole : player.role;
  return role && getRoleCrest(role) ? role : "unknown";
}
