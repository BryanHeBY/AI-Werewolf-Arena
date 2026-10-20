/**
 * 负责将已校验视觉意图映射为哥特主题道具。输入为typed scene，输出既有素材标识或中性记录回退。
 * 仅选择美术，不按台词、事件名前缀或当前身份猜技能，也不将道具当作效果或权限证据。
 */
import { outcomeEmblem } from "../../presentation/scene-content";
import type { VideoScene, VideoVisualFamily } from "../../video/types";
import type { GothicArtId } from "../../video/GothicArt";
const familyArt: Record<VideoVisualFamily, GothicArtId> = {
  affiliation: "oath-contract",
  animal_signal: "beast-totem",
  civic_ballot: "raven-quill",
  copy_resource: "sealed-grimoire",
  death_action: "flintlock",
  delayed_life: "clock-lock",
  duel: "dueling-blades",
  expression: "raven-quill",
  game_result: "judgement-seal",
  gift_resource: "sealed-grimoire",
  god_announcement: "judgement-seal",
  identity_choice: "sealed-grimoire",
  independent_survival: "clock-lock",
  inheritance: "oath-contract",
  inspection_camp: "inspect",
  inspection_pair: "inspect",
  inspection_role: "inspect",
  life_settlement: "judgement-seal",
  mapping: "mapping-gates",
  modifier: "oath-contract",
  pack_attack: "blood-wolf-claw",
  phase_transition: "judgement-seal",
  player_dialogue: "raven-quill",
  potion: "heal",
  protection: "iron-ward",
  reflection: "mapping-gates",
  relation_link: "bond-rings",
  resource_inventory: "heal",
  reveal_survival: "judgement-seal",
  secret_decision: "oath-contract",
  suppression: "clock-lock",
};
/** 显式子型选择，不能根据事件名的前后缀或玩家台词猜技能。 */
export type VictoryArtId = `victory-${Exclude<ReturnType<typeof outcomeEmblem>, "unknown">}`;
export function sceneArt(
  scene: VideoScene,
  options: { revealed?: boolean } = {},
): GothicArtId | VictoryArtId | "potion-pair" | "record" {
  const intent = scene.visual;
  if (!intent || intent.fallbackReason) return "record";
  if (intent.family === "game_result") {
    // 镜头携带终态不代表当前帧已经揭晓；未显式获准时始终使用中性封印。
    if (!options.revealed) return "judgement-seal";
    const emblem = outcomeEmblem(intent.victory?.outcome, intent.victory?.winner);
    return emblem === "unknown" ? "judgement-seal" : `victory-${emblem}`;
  }
  // 明示工具属于本次行动形式，不能被狼群／复制等机制家族默认图覆盖；也不据此补原生技能来源。
  if (intent.deathTool)
    return (
      {
        gun: "flintlock",
        claw: "blood-wolf-claw",
        patrol: "oath-contract",
        retaliation: "beast-totem",
      } as const
    )[intent.deathTool];
  if (intent.duelKind)
    return intent.duelKind === "demon_hunter" ? "demon-crossbow" : "dueling-blades";
  if (intent.potion) return intent.potion;
  if (intent.protection) return intent.protection.kind === "heal" ? "heal" : "iron-ward";
  if (intent.report) return intent.report.kind === "range" ? "beast-totem" : "inspect";
  if (intent.family === "death_action") {
    // 已知请求窗口只指定该种行动形式；未知枪/爪来源不能从当前角色补齐。
    if (intent.template === "death_action/hunter_shot_window") return "flintlock";
    if (intent.template === "death_action/awakened_claw_bequest_window") return "blood-wolf-claw";
    if (intent.template === "death_action/awakened_patrol_window") return "oath-contract";
    if (intent.template === "death_action/puffer_reaction_window") return "beast-totem";
    return "record";
  }
  if (intent.family === "resource_inventory") return "potion-pair";
  if (intent.family === "potion")
    return scene.action?.kind === "heal"
      ? "heal"
      : scene.action?.kind === "poison"
        ? "poison"
        : "potion-pair";
  switch (intent.template) {
    case "pack_attack/recorded_individual_choice":
    case "pack_attack/wolf_vote_window":
    case "pack_attack/self_destruct_declared":
    case "pack_attack/self_destruct_resolved":
      return "oath-contract";
    case "death_action/puffer_reaction_window":
      return "beast-totem";
    case "reflection/committed_effect_not_automatic_death":
      return "clock-lock";
    default:
      return familyArt[intent.family];
  }
}
