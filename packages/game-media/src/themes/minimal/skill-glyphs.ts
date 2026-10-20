/**
 * 负责简约主题的纯技能图选择。输入为已校验视觉意图，输出既有语义刻痕及明确工具标识或空回退。
 * 审计与实际渲染共用此选择，不读取帧、当前角色、DOM或本地化台词，不能把图形当作规则效果证据。
 */
import { roleFamilyMotif, type RoleCrestFamily } from "../../presentation/role-crests";
import type { VideoVisualIntent, VideoVisualFamily } from "../../video/types";
const families: Record<VideoVisualFamily, RoleCrestFamily | null> = {
  affiliation: "affiliation",
  animal_signal: "animal_signal",
  civic_ballot: "civic_ballot",
  copy_resource: "copy_resource",
  death_action: null,
  delayed_life: "delayed_life",
  duel: "duel",
  expression: "expression",
  game_result: null,
  gift_resource: "gift_resource",
  god_announcement: null,
  identity_choice: "identity_choice",
  independent_survival: "independent_survival",
  inheritance: "inheritance",
  inspection_camp: "inspection_camp",
  inspection_pair: "inspection_pair",
  inspection_role: "inspection_role",
  life_settlement: "delayed_life",
  mapping: "mapping",
  modifier: "modifier",
  pack_attack: "pack_attack",
  phase_transition: null,
  player_dialogue: "expression",
  potion: "potion",
  protection: "protection",
  reflection: "reflection",
  relation_link: "relation_link",
  resource_inventory: "potion",
  reveal_survival: "reveal_survival",
  secret_decision: "secret_decision",
  suppression: "suppression",
};
export function minimalSkillGlyph(
  intent: VideoVisualIntent | undefined,
): { id: string; motif: string } | null {
  if (!intent || intent.fallbackReason) return null;
  const family = families[intent.family];
  // 形态明示工具优先于家族；这是行动工具，不是本体身份或死亡证明。
  const tool = intent.deathTool ?? intent.duelKind;
  const choice = [
    "pack_attack/recorded_individual_choice",
    "pack_attack/wolf_vote_window",
    "pack_attack/self_destruct_declared",
    "pack_attack/self_destruct_resolved",
  ].includes(intent.template);
  const motif =
    tool === "gun"
      ? roleFamilyMotif("death_action")
      : tool === "claw"
        ? roleFamilyMotif("pack_attack")
        : tool === "patrol"
          ? roleFamilyMotif("secret_decision")
          : tool === "retaliation"
            ? roleFamilyMotif("animal_signal")
            : tool === "demon_hunter"
              ? "M3 7Q12 1 21 7M3 7L12 11L21 7M12 3V21M8 17L12 21L16 17"
              : choice
                ? roleFamilyMotif("secret_decision")
                : intent.protection?.kind === "heal"
                  ? roleFamilyMotif("potion")
                  : family
                    ? roleFamilyMotif(family)
                    : null;
  return motif ? { id: tool ?? intent.family, motif } : null;
}
