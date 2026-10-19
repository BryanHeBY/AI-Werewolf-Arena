/**
 * 负责动作语义与主题色系的显式对应。输入为已校验的动作家族、工具及旧计划动作类型，输出主题色；不读取行动者身份。
 * 群体狼刀统一血红，复制/赠予能力沿用被执行动作的颜色；颜色不证明命中、阵营、原生角色或查验结果。
 */
import type { VideoScene, VideoVisualFamily, VideoVisualIntent } from "../video/types";
import { colorFamilyAppearance, type RoleColorKey, type ThemeRoleColors } from "./role-colors";

type ActionTool = NonNullable<VideoVisualIntent["deathTool"] | VideoVisualIntent["duelKind"]>;
export interface ThemeActionColors {
  families: Record<VideoVisualFamily, RoleColorKey>;
  tools: Record<ActionTool, RoleColorKey>;
}

export function createThemeActionColors(): ThemeActionColors {
  return {
    families: {
      affiliation: "ivory",
      animal_signal: "ochre",
      civic_ballot: "amber",
      copy_resource: "iron",
      death_action: "neutral",
      delayed_life: "ivory",
      duel: "steel",
      expression: "neutral",
      game_result: "neutral",
      gift_resource: "amber",
      god_announcement: "neutral",
      identity_choice: "slate",
      independent_survival: "amber",
      inheritance: "amber",
      inspection_camp: "azure",
      inspection_pair: "azure",
      inspection_role: "azure",
      life_settlement: "neutral",
      mapping: "azure",
      modifier: "amber",
      pack_attack: "blood",
      phase_transition: "neutral",
      player_dialogue: "neutral",
      potion: "amethyst",
      protection: "teal",
      reflection: "steel",
      relation_link: "violet",
      resource_inventory: "amethyst",
      reveal_survival: "ivory",
      secret_decision: "amber",
      suppression: "dusk",
    },
    tools: {
      gun: "ochre",
      claw: "blood",
      patrol: "crown",
      retaliation: "ochre",
      knight: "steel",
      awakened_knight: "steel",
      demon_hunter: "steel",
    },
  };
}

const legacyKeys = {
  "wolf-vote": "blood",
  "wolf-knife": "blood",
  inspect: "azure",
  heal: "amethyst",
  poison: "amethyst",
  guard: "teal",
  exile: "amber",
  protection: "teal",
  generic: "neutral",
} satisfies Record<NonNullable<VideoScene["action"]>["kind"], RoleColorKey>;

export function actionAppearance(
  theme: { definition: { roleColors?: ThemeRoleColors; actionColors?: ThemeActionColors } },
  tone: "day" | "night",
  scene: Pick<VideoScene, "visual" | "action">,
) {
  const colors = theme.definition.actionColors ?? createThemeActionColors();
  const intent = scene.visual;
  const tool = intent?.deathTool ?? intent?.duelKind;
  // 动作家族已经足以确定颜色，不借当前/最终底牌染色；明示枪/爪等工具优先，未带工具的狼队刀票统一血红。
  const key = intent
    ? intent.fallbackReason
      ? "neutral"
      : tool
        ? colors.tools[tool]
        : intent.protection?.kind === "heal"
          ? colors.families.potion
          : colors.families[intent.family]
    : scene.action
      ? legacyKeys[scene.action.kind]
      : "neutral";
  return colorFamilyAppearance(theme, tone, key);
}
